# Plan: Image Loading Optimization (Quick Wins Only)

Created: 2026-01-30
Status: Approved

## Overview

Optimize image loading for the Little Dinos Game by focusing on quick wins: compressing and converting the images that are actually used in the game, adding lazy loading, and configuring cache headers.

## Current Situation

| Metric | Current Value | Issue |
|--------|---------------|-------|
| Total images | 460 files | Many unused/backup files |
| Total size | 627 MB | Extremely large |
| Format | 100% PNG | No modern format support |
| Largest file | 4.0 MB (menu_background) | Uncompressed |
| Loading strategy | Eager | All images load immediately |
| Optimization | None | No compression or minification |

**Critical files causing slow loads:**
- `menu_background.png` - 4.0 MB
- `long_menu_button.png` - 2.3 MB
- `hint_icon.png` - 2.1 MB

## Requirements

- [x] Reduce total image payload size by 50%+
- [x] Implement lazy loading for off-screen images
- [x] Add WebP format support with PNG fallback
- [x] Improve perceived loading speed
- [x] Maintain visual quality (65-80% quality threshold)
- [x] Keep changes backward compatible
- [x] Move unused images to separate folder

## Scope

This plan focuses on **Quick Wins Only**:
1. Move unused images to `/public/images/unused`
2. Compress PNGs (only used files)
3. Generate WebP versions (only used files)
4. Add `loading="lazy"` to non-critical images
5. Configure cache headers on Netlify

---

## Images Actually Used in the Game

Based on user corrections, here is the precise list of images that need optimization:

### Core Game Images (~45 files)

**Terrain:**
- `empty1.png` through `empty9.png` (9 files)
- `mountain1.png` through `mountain5.png` (5 files)

**Units:**
- `dino1.png` through `dino8.png` (8 files)

**Buildings:**
- `base.png`, `base1.png` through `base8.png` (9 files - base + player-colored versions)
- `habitation.png` (1 file)
- `temple.png` (1 file)
- `well.png` (1 file)
- `storage.png` (1 file)
- `obelisk.png` (1 file)

### UI Images (~30 files)

**Backgrounds:**
- `background.png` (1 file)
- `menu_background.png` (1 file)
- `ingame_menu_background.png` (1 file)

**Buttons:**
- `long_menu_button.png` (1 file)
- `long_setup_btn.png` (1 file)
- `long_setup_btn_clean.png` (1 file)
- `big_button.png` (1 file)
- `small_button.png` (1 file)
- `plate_no_border.png` (1 file)

**Icons:**
- `arrow.png` (1 file)
- `arrow_white.png` (1 file)
- `plus.png` (1 file)
- `minus.png` (1 file)
- `exit_icon.png` (1 file)
- `field_icon.png` (1 file)
- `human_icon.png` (1 file)
- `bot_icon.png` (1 file)
- `dino_icon.png` (1 file)
- `dino_icon_plus.png` (1 file)
- `tower_icon.png` (1 file)
- `tower_icon_plus.png` (1 file)
- `speed_icon.png` (1 file)
- `speed_icon_max.png` (1 file)
- `radius_icon.png` (1 file)
- `visibility_speed_relation_icon.png` (1 file)
- `visibility_speed_no_relation_icon.png` (1 file)
- `open_eye.png` (1 file)
- `closed_eye.png` (1 file)
- `show_speed_icon.png` (1 file)
- `hide_speed_icon.png` (1 file)
- `dino_birth_icon.png` (1 file)
- `dino_birth_kill_icon.png` (1 file)
- `settings_icon.png` (1 file)
- `hint_icon.png` (1 file)
- `icon.png` (1 file)
- `warning_sign.png` (1 file)

**Panels:**
- `panel.png` (1 file)
- `error_plate.png` (1 file)

**Total: ~75 used images**

---

## Implementation Steps

### Step 0: Move Unused Images to Separate Folder

**Description**: Organize unused images into a separate folder to keep the main images folder clean and reduce confusion. Only moves files directly in `/public/images/`, does NOT touch the `work_materials` subfolder.

**Commands**:
```bash
cd frontend/public/images

# Create unused folder
mkdir -p unused

# NOTE: All commands below only move files in the current directory (not recursive)
# The work_materials subfolder is left untouched

# Move terrain variants
mv empty0.png emptyb.png unused/ 2>/dev/null || true
mv mountain0.png mountain.png unused/ 2>/dev/null || true

# Move dino variations and UI versions
mv dino*b.png dino*c.png dino*d.png dino*s.png unused/ 2>/dev/null || true
mv dino0*.png unused/ 2>/dev/null || true

# Move building number variants (keep base1-8 for player colors)
mv base0.png unused/ 2>/dev/null || true
mv habitation[0-9]*.png unused/ 2>/dev/null || true
mv temple[0-9]*.png unused/ 2>/dev/null || true
mv well[0-9]*.png unused/ 2>/dev/null || true
mv storage[0-9]*.png unused/ 2>/dev/null || true
mv obelisk[0-9]*.png unused/ 2>/dev/null || true

# Move background variants
mv background[0-9]*.png unused/ 2>/dev/null || true

# Move UI variants
mv gray_plate.png unused/ 2>/dev/null || true
mv arrow[0-9]*.png unused/ 2>/dev/null || true
mv plus[0-9]*.png unused/ 2>/dev/null || true
mv minus[0-9]*.png unused/ 2>/dev/null || true
mv exit_icon[0-9]*.png unused/ 2>/dev/null || true
mv speed_icon_max[0-9]*.png unused/ 2>/dev/null || true
mv visibility_speed_relation_icon[0-9]*.png unused/ 2>/dev/null || true
mv visibility_speed_no_relation_icon[0-9]*.png unused/ 2>/dev/null || true
mv hint_icon[0-9]*.png unused/ 2>/dev/null || true
mv lens.png wall.png unused/ 2>/dev/null || true
mv panel[0-9]*.png unused/ 2>/dev/null || true
mv error_plate[0-9]*.png unused/ 2>/dev/null || true

# Move _g5 variants (design alternatives)
mv *_g5*.png unused/ 2>/dev/null || true

# Move backup files and source files (only in current directory)
mv *.png~ unused/ 2>/dev/null || true
mv *.kra unused/ 2>/dev/null || true
mv *.kra~ unused/ 2>/dev/null || true
```

---

### Step 1: Compress Used PNG Files

**Description**: Use `pngquant` to compress only the images actually used in the game. Quality threshold: 65-80%.

**Commands**:
```bash
# Install pngquant (macOS)
brew install pngquant

cd frontend/public/images

# Compress all used images
# Terrain
pngquant --quality=65-80 --ext .png --force empty[1-9].png mountain[1-5].png

# Units
pngquant --quality=65-80 --ext .png --force dino[1-8].png

# Buildings
pngquant --quality=65-80 --ext .png --force \
  base.png base[1-8].png \
  habitation.png temple.png well.png storage.png obelisk.png

# Backgrounds
pngquant --quality=65-80 --ext .png --force \
  background.png menu_background.png ingame_menu_background.png

# UI elements
pngquant --quality=65-80 --ext .png --force \
  long_menu_button.png long_setup_btn.png long_setup_btn_clean.png \
  big_button.png small_button.png plate_no_border.png \
  arrow.png arrow_white.png plus.png minus.png exit_icon.png \
  field_icon.png human_icon.png bot_icon.png \
  dino_icon.png dino_icon_plus.png tower_icon.png tower_icon_plus.png \
  speed_icon.png speed_icon_max.png radius_icon.png \
  visibility_speed_relation_icon.png visibility_speed_no_relation_icon.png \
  open_eye.png closed_eye.png show_speed_icon.png hide_speed_icon.png \
  dino_birth_icon.png dino_birth_kill_icon.png \
  settings_icon.png hint_icon.png icon.png warning_sign.png \
  panel.png error_plate.png
```

**Expected Savings**: 40-60% size reduction

---

### Step 2: Generate WebP Versions for Used Images

**Description**: Create WebP versions for modern browsers (25-40% smaller than PNG).

**Commands**:
```bash
# Install cwebp
brew install webp

cd frontend/public/images

# Define list of used images and convert each
used_images=(
  # Terrain
  empty1.png empty2.png empty3.png empty4.png empty5.png
  empty6.png empty7.png empty8.png empty9.png
  mountain1.png mountain2.png mountain3.png mountain4.png mountain5.png
  # Units
  dino1.png dino2.png dino3.png dino4.png
  dino5.png dino6.png dino7.png dino8.png
  # Buildings
  base.png base1.png base2.png base3.png base4.png
  base5.png base6.png base7.png base8.png
  habitation.png temple.png well.png storage.png obelisk.png
  # Backgrounds
  background.png menu_background.png ingame_menu_background.png
  # Buttons
  long_menu_button.png long_setup_btn.png long_setup_btn_clean.png
  big_button.png small_button.png plate_no_border.png
  # Icons
  arrow.png arrow_white.png plus.png minus.png exit_icon.png
  field_icon.png human_icon.png bot_icon.png
  dino_icon.png dino_icon_plus.png tower_icon.png tower_icon_plus.png
  speed_icon.png speed_icon_max.png radius_icon.png
  visibility_speed_relation_icon.png visibility_speed_no_relation_icon.png
  open_eye.png closed_eye.png show_speed_icon.png hide_speed_icon.png
  dino_birth_icon.png dino_birth_kill_icon.png
  settings_icon.png hint_icon.png icon.png warning_sign.png
  # Panels
  panel.png error_plate.png
)

for f in "${used_images[@]}"; do
  if [ -f "$f" ]; then
    cwebp -q 80 "$f" -o "${f%.png}.webp"
  fi
done
```

---

### Step 3: Create WebP Helper Composable

**Files**: `frontend/src/composables/useOptimizedImage.js`

**Description**: Vue composable for loading WebP images with PNG fallback.

**Code**:
```javascript
// frontend/src/composables/useOptimizedImage.js

// Check WebP support once at load time
let supportsWebP = false

if (typeof window !== 'undefined') {
  const canvas = document.createElement('canvas')
  if (canvas.getContext && canvas.getContext('2d')) {
    supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }
}

/**
 * Get the optimal image path (WebP if supported, PNG fallback)
 * @param {string} baseName - Image name without extension
 * @returns {string} Full image path
 */
export function getImagePath(baseName) {
  const ext = supportsWebP ? 'webp' : 'png'
  return `/images/${baseName}.${ext}`
}

export function useOptimizedImage() {
  return {
    supportsWebP,
    getImagePath
  }
}
```

---

### Step 4: Update Components to Use WebP

**Files**: Multiple Vue components

**Description**: Update image loading to use `getImagePath()` for WebP support.

#### 4a. GameUnit.vue

Update from:
```vue
:src="`/images/${image}.png`"
```
To:
```vue
<script setup>
import { getImagePath } from '@/composables/useOptimizedImage'
</script>

:src="getImagePath(image)"
```

#### 4b. GameBuilding.vue

Same pattern as GameUnit.vue.

#### 4c. GameCell.vue

Update terrain image loading:
```vue
<script setup>
import { getImagePath } from '@/composables/useOptimizedImage'
</script>

:src="getImagePath(terrain.kind + terrain.idx)"
```

#### 4d. Other Components

Apply same pattern to:
- `GameMenuOverlay.vue`
- `GameSetup.vue`
- `InfoPanel.vue`
- `GameHelp.vue`
- `MenuHint.vue`
- `MenuError.vue`

For CSS `background-image`, we'll keep PNG for now (CSS doesn't support conditional WebP easily without additional complexity).

---

### Step 5: Add Native Lazy Loading

**Files**: Multiple Vue components

**Description**: Add `loading="lazy"` attribute to non-critical images.

**Changes**:

For images that are NOT immediately visible (menus, help screens, overlays):

```vue
<img
  :src="getImagePath(image)"
  loading="lazy"
  decoding="async"
/>
```

**Apply to**:
- `GameMenuOverlay.vue` - All menu images
- `GameHelp.vue` - Help screen images
- `GameSetup.vue` - Setup screen icons (can be lazy)

**Do NOT apply to**:
- `GameCell.vue` terrain images (visible immediately)
- `GameGrid.vue` background (visible immediately)

---

### Step 6: Configure Netlify Cache Headers

**Files**: `frontend/netlify.toml`

**Description**: Set long cache duration for static images.

**Create/Update netlify.toml**:
```toml
[build]
  publish = "dist"

[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

### Step 7: Write Tests

**Files**: `frontend/tests/composables/useOptimizedImage.spec.js`

**Tests**:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('useOptimizedImage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getImagePath returns PNG path when WebP not supported', async () => {
    // Mock canvas to not support WebP
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => null
      })
    })

    const { getImagePath } = await import('@/composables/useOptimizedImage')
    expect(getImagePath('test')).toBe('/images/test.png')
  })

  it('getImagePath returns WebP path when supported', async () => {
    // Mock canvas to support WebP
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({}),
        toDataURL: () => 'data:image/webp;base64,...'
      })
    })

    const { getImagePath } = await import('@/composables/useOptimizedImage')
    expect(getImagePath('test')).toBe('/images/test.webp')
  })
})
```

---

### Step 8: Final Verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
# Check build size
du -sh frontend/dist/
du -sh frontend/dist/images/
```

**Manual Tests**:
1. Clear browser cache, load game - verify images load faster
2. Open DevTools Network tab - verify WebP is served in Chrome/Firefox
3. Open DevTools Network tab - verify PNG fallback works in Safari (if no WebP support)
4. Check lazy images load only when needed (open menu, help screen)
5. Test on slow 3G throttling (DevTools) - verify improved experience
6. Check repeat visits are instant (images cached)

---

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Used images count | ~75 files | ~75 files + WebP | Same PNG, added WebP |
| Used images size | ~50 MB | ~15-25 MB | 50-70% reduction |
| Initial page load | All images | Critical only | Faster TTI |
| Repeat visits | Full download | Cached (1 year) | Near-instant |
| Modern browsers | PNG only | WebP | 25-40% smaller |

---

## CI/CD Proposal for Future Images

When new images are added, the workflow could be:

1. **Manual approach (simple)**:
   - Add new PNG images
   - Run compression script before committing
   - Run WebP conversion script
   - Commit both PNG and WebP versions

2. **GitHub Action (automated)**:
   Add `.github/workflows/optimize-images.yml`:
   ```yaml
   name: Optimize Images
   on:
     push:
       paths:
         - 'frontend/public/images/**'

   jobs:
     optimize:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Install tools
           run: |
             sudo apt-get update
             sudo apt-get install -y pngquant webp
         - name: Compress PNGs
           run: |
             cd frontend/public/images
             pngquant --quality=65-80 --ext .png --force --skip-if-larger *.png || true
         - name: Generate WebP
           run: |
             cd frontend/public/images
             for f in *.png; do
               [ -f "${f%.png}.webp" ] || cwebp -q 80 "$f" -o "${f%.png}.webp"
             done
         - name: Commit changes
           run: |
             git config user.name "GitHub Actions"
             git config user.email "actions@github.com"
             git add frontend/public/images/
             git diff --cached --quiet || git commit -m "chore: optimize images"
             git push
   ```

**Recommendation**: Start with the manual approach. Add GitHub Action later if image updates become frequent.

---

## Notes

- Unused images moved to `/public/images/unused` folder - can be deleted later if confirmed unnecessary
- CSS background-image stays as PNG (WebP in CSS requires more complex solutions)
- Quality threshold of 65-80% provides good balance between size and visual quality
- The `immutable` cache header tells browsers the file will never change at that URL
