# Replicate Studio - Desktop Build Guide

## Prerequisites

- Node.js 18+ installed
- For macOS builds: macOS system
- For Windows builds: Windows system or macOS with Wine installed

## Build Commands

### Build for macOS (DMG)
```bash
npm run electron:build:mac
```

This will create:
- `release/Replicate Studio-1.0.0-arm64.dmg` (Apple Silicon)
- `release/Replicate Studio-1.0.0-x64.dmg` (Intel)
- `release/Replicate Studio-1.0.0-universal.dmg` (Universal)

### Build for Windows (EXE)
```bash
npm run electron:build:win
```

This will create:
- `release/Replicate Studio Setup 1.0.0.exe` (NSIS installer)

### Build for Both Platforms
```bash
npm run electron:build:all
```

## Icon Requirements

Before building, you need to provide app icons:

### macOS Icon (.icns)
Place your icon at: `public/icon.icns`
- Required sizes: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- You can generate .icns from PNG using online tools or Image2Icon app

### Windows Icon (.ico)
Place your icon at: `public/icon.ico`
- Required sizes: 16x16, 32x32, 48x48, 256x256
- You can generate .ico from PNG using online tools

### Creating Icons from PNG

If you have a 1024x1024 PNG logo:

1. **For macOS (.icns):**
   ```bash
   # Using iconutil (macOS only)
   mkdir icon.iconset
   sips -z 16 16     logo.png --out icon.iconset/icon_16x16.png
   sips -z 32 32     logo.png --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32     logo.png --out icon.iconset/icon_32x32.png
   sips -z 64 64     logo.png --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128   logo.png --out icon.iconset/icon_128x128.png
   sips -z 256 256   logo.png --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256   logo.png --out icon.iconset/icon_256x256.png
   sips -z 512 512   logo.png --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512   logo.png --out icon.iconset/icon_512x512.png
   sips -z 1024 1024 logo.png --out icon.iconset/icon_512x512@2x.png
   iconutil -c icns icon.iconset
   mv icon.icns public/
   ```

2. **For Windows (.ico):**
   - Use online converter like https://convertio.co/png-ico/
   - Or use ImageMagick: `convert logo.png -define icon:auto-resize=256,128,64,48,32,16 public/icon.ico`

## Development Mode

Test the Electron app in development:

```bash
npm run electron:dev
```

This will:
1. Start Vite dev server
2. Wait for it to be ready
3. Launch Electron in development mode with DevTools

## Output

All built applications will be in the `release/` directory.

## Notes

- The app includes an embedded Express server (server.js) that runs automatically
- API keys are stored locally using Zustand
- Results are stored in IndexedDB
- The app works completely offline after the initial model schema is loaded

## Troubleshooting

### macOS Code Signing
If you get code signing errors on macOS:
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run electron:build:mac
```

### Windows on macOS
To build Windows apps on macOS, you need Wine:
```bash
brew install wine-stable
npm run electron:build:win
```
