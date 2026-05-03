#!/bin/bash

# Image Optimization Script
# Compresses PNG files and generates WebP copies
# Requirements: pngquant, cwebp (brew install pngquant webp)

set -e

IMAGES_DIR="public/images"
QUALITY_PNG="65-80"
QUALITY_WEBP="80"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_dependencies() {
    local missing=()

    if ! command -v pngquant &> /dev/null; then
        missing+=("pngquant")
    fi

    if ! command -v cwebp &> /dev/null; then
        missing+=("cwebp")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}Error: Missing required tools: ${missing[*]}${NC}"
        echo "Install with: brew install pngquant webp"
        exit 1
    fi
}

# Compress a single PNG file
compress_png() {
    local file="$1"
    local original_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    local temp_file="${file}.tmp"
    
    if pngquant --quality="$QUALITY_PNG" --output "$temp_file" "$file" 2>/dev/null; then
        local compressed_size=$(stat -f%z "$temp_file" 2>/dev/null || stat -c%s "$temp_file" 2>/dev/null)
        
        if [ "$compressed_size" -lt "$original_size" ]; then
            mv "$temp_file" "$file"
            local saved=$((original_size - compressed_size))
            local percent=$((saved * 100 / original_size))
            echo -e "${GREEN}✓${NC} Compressed: $(basename "$file") (saved ${percent}%)"
            return 0
        else
            rm -f "$temp_file"
            echo -e "${YELLOW}⊘${NC} Skipped (already optimized): $(basename "$file")"
            return 1
        fi
    else
        rm -f "$temp_file"
        echo -e "${YELLOW}⊘${NC} Skipped (error): $(basename "$file")"
        return 1
    fi
}

# Compress PNG files
compress_pngs() {
    local files=("$@")
    echo -e "${YELLOW}Compressing PNG files...${NC}"
    local count=0
    local skipped=0

    # If no files specified, find all PNG files
    if [ ${#files[@]} -eq 0 ]; then
        while IFS= read -r -d '' file; do
            files+=("$file")
        done < <(find "$IMAGES_DIR" -maxdepth 1 -name "*.png" -print0)
    fi

    for file in "${files[@]}"; do
        # Resolve full path if relative path or basename provided
        if [[ "$file" != /* ]] && [[ "$file" != "$IMAGES_DIR"/* ]]; then
            file="$IMAGES_DIR/$file"
        fi
        
        # Skip if file doesn't exist
        if [ ! -f "$file" ]; then
            echo -e "${RED}✗${NC} File not found: $file"
            continue
        fi
        
        # Only process PNG files
        if [[ "$file" != *.png ]]; then
            echo -e "${YELLOW}⊘${NC} Skipped (not a PNG): $(basename "$file")"
            continue
        fi

        if compress_png "$file"; then
            ((count++))
        else
            ((skipped++))
        fi
    done

    echo -e "${GREEN}PNG compression complete: $count files compressed, $skipped skipped${NC}"
}

# Generate WebP copy for a single PNG file
generate_webp_single() {
    local file="$1"
    local webp_file="${file%.png}.webp"

    # Skip if WebP already exists and is newer than PNG
    if [ -f "$webp_file" ] && [ "$webp_file" -nt "$file" ]; then
        echo -e "${YELLOW}⊘${NC} Skipped (up to date): $(basename "$webp_file")"
        return 1
    fi

    if cwebp -q "$QUALITY_WEBP" "$file" -o "$webp_file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Created: $(basename "$webp_file")"
        return 0
    else
        echo -e "${RED}✗${NC} Failed: $(basename "$file")"
        return 1
    fi
}

# Generate WebP copies
generate_webp() {
    local files=("$@")
    echo -e "${YELLOW}Generating WebP copies...${NC}"
    local count=0
    local skipped=0
    local failed=0

    # If no files specified, find all PNG files
    if [ ${#files[@]} -eq 0 ]; then
        while IFS= read -r -d '' file; do
            files+=("$file")
        done < <(find "$IMAGES_DIR" -maxdepth 1 -name "*.png" -print0)
    fi

    for file in "${files[@]}"; do
        # Resolve full path if relative path or basename provided
        if [[ "$file" != /* ]] && [[ "$file" != "$IMAGES_DIR"/* ]]; then
            file="$IMAGES_DIR/$file"
        fi
        
        # Skip if file doesn't exist
        if [ ! -f "$file" ]; then
            echo -e "${RED}✗${NC} File not found: $file"
            ((failed++))
            continue
        fi
        
        # Only process PNG files
        if [[ "$file" != *.png ]]; then
            echo -e "${YELLOW}⊘${NC} Skipped (not a PNG): $(basename "$file")"
            continue
        fi

        if generate_webp_single "$file"; then
            ((count++))
        else
            ((skipped++))
        fi
    done

    echo -e "${GREEN}WebP generation complete: $count files created, $skipped skipped"
    if [ $failed -gt 0 ]; then
        echo -e "${RED}, $failed failed${NC}"
    else
        echo -e "${NC}"
    fi
}

# Show size comparison
show_stats() {
    echo -e "\n${YELLOW}Size Statistics:${NC}"

    local png_size=$(find "$IMAGES_DIR" -maxdepth 1 -name "*.png" -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    local webp_size=$(find "$IMAGES_DIR" -maxdepth 1 -name "*.webp" -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    local png_count=$(find "$IMAGES_DIR" -maxdepth 1 -name "*.png" | wc -l | tr -d ' ')
    local webp_count=$(find "$IMAGES_DIR" -maxdepth 1 -name "*.webp" | wc -l | tr -d ' ')

    echo "PNG files:  $png_count files, $png_size"
    echo "WebP files: $webp_count files, $webp_size"
}

# Main
main() {
    echo -e "${GREEN}=== Image Optimization Script ===${NC}\n"

    # Change to frontend directory if not already there
    if [ ! -d "$IMAGES_DIR" ]; then
        if [ -d "frontend/$IMAGES_DIR" ]; then
            cd frontend
        else
            echo -e "${RED}Error: Cannot find $IMAGES_DIR directory${NC}"
            exit 1
        fi
    fi

    check_dependencies

    local mode="${1:-all}"
    shift  # Remove mode from arguments, remaining args are file names

    case "$mode" in
        png)
            compress_pngs "$@"
            ;;
        webp)
            generate_webp "$@"
            ;;
        all)
            compress_pngs "$@"
            echo ""
            generate_webp "$@"
            ;;
        stats)
            show_stats
            ;;
        *)
            echo "Usage: $0 [png|webp|all|stats] [image1.png image2.png ...]"
            echo ""
            echo "Modes:"
            echo "  png   - Compress PNG files only"
            echo "  webp  - Generate WebP copies only"
            echo "  all   - Both compress PNGs and generate WebP (default)"
            echo "  stats - Show size statistics"
            echo ""
            echo "Examples:"
            echo "  $0 all                    # Process all PNG files"
            echo "  $0 png dino1.png         # Compress only dino1.png"
            echo "  $0 webp base.png         # Generate WebP for base.png"
            echo "  $0 all dino1.png dino2.png  # Process specific files"
            exit 1
            ;;
    esac

    if [ "$mode" != "stats" ]; then
        show_stats
    fi
    echo -e "\n${GREEN}Done!${NC}"
}

main "$@"
