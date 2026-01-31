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

# Compress PNG files
compress_pngs() {
    echo -e "${YELLOW}Compressing PNG files...${NC}"
    local count=0
    local skipped=0

    # Find PNG files excluding unused folder
    while IFS= read -r -d '' file; do
        if pngquant --quality="$QUALITY_PNG" --ext .png --force "$file" 2>/dev/null; then
            ((count++))
            echo -e "${GREEN}✓${NC} Compressed: $(basename "$file")"
        else
            ((skipped++))
            echo -e "${YELLOW}⊘${NC} Skipped (already optimized or error): $(basename "$file")"
        fi
    done < <(find "$IMAGES_DIR" -maxdepth 1 -name "*.png" -print0)

    echo -e "${GREEN}PNG compression complete: $count files compressed, $skipped skipped${NC}"
}

# Generate WebP copies
generate_webp() {
    echo -e "${YELLOW}Generating WebP copies...${NC}"
    local count=0
    local skipped=0

    # Find PNG files excluding unused folder
    while IFS= read -r -d '' file; do
        local webp_file="${file%.png}.webp"

        # Skip if WebP already exists and is newer than PNG
        if [ -f "$webp_file" ] && [ "$webp_file" -nt "$file" ]; then
            ((skipped++))
            echo -e "${YELLOW}⊘${NC} Skipped (up to date): $(basename "$webp_file")"
            continue
        fi

        if cwebp -q "$QUALITY_WEBP" "$file" -o "$webp_file" 2>/dev/null; then
            ((count++))
            echo -e "${GREEN}✓${NC} Created: $(basename "$webp_file")"
        else
            echo -e "${RED}✗${NC} Failed: $(basename "$file")"
        fi
    done < <(find "$IMAGES_DIR" -maxdepth 1 -name "*.png" -print0)

    echo -e "${GREEN}WebP generation complete: $count files created, $skipped skipped${NC}"
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

    case "${1:-all}" in
        png)
            compress_pngs
            ;;
        webp)
            generate_webp
            ;;
        all)
            compress_pngs
            echo ""
            generate_webp
            ;;
        stats)
            show_stats
            ;;
        *)
            echo "Usage: $0 [png|webp|all|stats]"
            echo "  png   - Compress PNG files only"
            echo "  webp  - Generate WebP copies only"
            echo "  all   - Both compress PNGs and generate WebP (default)"
            echo "  stats - Show size statistics"
            exit 1
            ;;
    esac

    show_stats
    echo -e "\n${GREEN}Done!${NC}"
}

main "$@"
