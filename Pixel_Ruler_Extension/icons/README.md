# 🔧 Extension Icons - Setup Required

This folder contains the SVG template and generator for the Pixel Ruler extension icons.

## ⚠️ Action Required

You need to generate PNG icons from the SVG template. The extension requires these specific files:

- `icon16.png` (16x16 pixels) - Toolbar icon
- `icon48.png` (48x48 pixels) - Extension management page  
- `icon128.png` (128x128 pixels) - Chrome Web Store

## 🚀 Quick Generation Methods

### Method 1: Online Converter (Easiest)
1. Go to [convertio.co/svg-png](https://convertio.co/svg-png/)
2. Upload `icon.svg`
3. Convert to PNG at sizes: 16x16, 48x48, 128x128
4. Rename files to `icon16.png`, `icon48.png`, `icon128.png`

### Method 2: Use the HTML Generator
1. Open `icon-generator.html` in your browser
2. Click the generate buttons for each size
3. Files will automatically download

### Method 3: ImageMagick (Command Line)
```bash
# Install ImageMagick first
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png  
magick icon.svg -resize 128x128 icon128.png
```

## 🎨 Icon Design

The icon features:
- **Primary Color**: #007acc (Blue)
- **Accent Color**: #ff6b35 (Orange) 
- **Elements**: Rulers, guides, measurement indicators
- **Style**: Clean, modern, professional

## ✅ Verification

After generating icons, your `icons/` folder should look like:
```
icons/
├── icon16.png   ✓
├── icon48.png   ✓  
├── icon128.png  ✓
├── icon.svg     ✓
├── icon-generator.html
└── README.md
```

The extension will not work properly without these PNG files!