# Replicate Studio

> Desktop application for Replicate API with dynamic model support and beautiful UI

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)
![React](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript)
![Electron](https://img.shields.io/badge/Electron-38.2.1-47848F?logo=electron)

## ✨ Features

- 🎨 **Dynamic Model Support** - Automatically loads models from Replicate Collections API
- 🔧 **Schema-Based Forms** - Generates input forms dynamically from OpenAPI schemas
- 💾 **Local Storage** - Saves results to IndexedDB for offline access
- 🖼️ **Gallery View** - Beautiful grid layout with image modal viewer
- 🎯 **Custom Models** - Support for any Replicate model via owner/model-name format
- 🌐 **Cross-Platform** - Available as web app and native desktop app (macOS/Windows)
- ⚡ **Real-time Updates** - Live prediction progress with polling
- 🎭 **Modern UI** - Glassmorphism design with smooth animations

## 📸 Screenshots

### Model Selection
Browse popular models or enter custom model names with auto-loaded collections.

### Dynamic Form Generation
Input forms are automatically generated based on each model's schema.

### Gallery with Modal Viewer
View your generated images and videos with detailed information panel.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Replicate API key ([Get one here](https://replicate.com/account/api-tokens))

### Installation

```bash
# Clone the repository
git clone https://github.com/LTXY12/replicate-studio.git
cd replicate-studio

# Install dependencies
npm install

# Start development server (Vite + Express proxy)
npm run dev
```

Open http://localhost:5173 in your browser and enter your Replicate API key.

### Desktop App

```bash
# Build macOS app
npm run electron:build:mac

# Build Windows app
npm run electron:build:win

# Build both platforms
npm run electron:build:all
```

Installers will be created in the `release/` folder.

## 🏗️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **Zustand** - State management
- **React Router** - Navigation
- **Dexie.js** - IndexedDB wrapper

### Backend
- **Express.js** - CORS proxy server
- **Node.js** - Runtime

### Desktop
- **Electron** - Native wrapper
- **electron-builder** - Build toolchain

## 📦 Project Structure

```
src/
├── components/          # React components
│   ├── ApiKeySetup.tsx    # API key input screen
│   ├── ModelSelector.tsx  # Model browsing and selection
│   ├── PredictionRunner.tsx # Model execution interface
│   ├── DynamicForm.tsx    # Schema-based form generator
│   └── Gallery.tsx        # Results gallery with modal
├── lib/                 # Utilities
│   ├── replicate.ts       # Replicate API client
│   └── storage.ts         # IndexedDB operations
├── types/               # TypeScript types
├── config/              # Configuration files
└── store/               # Zustand stores

electron/
├── main.cjs             # Electron main process
├── preload.cjs          # Preload script
└── server.cjs           # Bundled Express server

public/                  # Static assets (icons)
server.js                # Development Express proxy
```

## 🎯 Usage

### 1. Set API Key
Enter your Replicate API key on the first screen. It will be stored locally in your browser.

### 2. Select a Model
- Browse popular models from Collections API
- Filter by category (Image Generation, Video Generation, Image Editing)
- Or enter a custom model name in `owner/model-name` format

### 3. Configure Parameters
Fill in the dynamically generated form based on the model's schema. Upload images if required.

### 4. Run Prediction
Click "Run Model" and watch the real-time progress. Results are saved automatically.

### 5. View Gallery
Access your generated images and videos in the Gallery tab. Click to view full-size with details.

## 🔧 Development

### Available Scripts

- `npm run dev` - Start Vite dev server + Express proxy
- `npm run dev:vite` - Start Vite only
- `npm run server` - Start Express proxy only
- `npm run build` - Build for production
- `npm run electron:dev` - Run Electron in dev mode
- `npm run electron:build:mac` - Build macOS DMG
- `npm run electron:build:win` - Build Windows installer
- `npm run electron:build:all` - Build for all platforms

### Environment Variables

No `.env` file needed. API key is entered through the UI and stored in `localStorage`.

### Building Icons

Icons are auto-generated from `public/icon_1024.png`:
- macOS: `icon.icns` (multi-resolution)
- Windows: `icon.ico` (multi-size)

See [BUILD.md](./BUILD.md) for detailed build instructions.

## 🐛 Known Issues

1. **Development Mode**: Use `npm run dev` which runs both Vite and Express server. Don't run them separately.
2. **CORS Proxy**: Express server on port 3001 is required for API calls to avoid CORS errors.
3. **First Load**: Models are fetched from Collections API on first load. May take a few seconds.

## 📝 API Reference

This app uses the [Replicate HTTP API](https://replicate.com/docs/reference/http):

- `POST /predictions` - Create prediction
- `GET /predictions/:id` - Get prediction status
- `GET /collections/:slug` - Get collection models
- `GET /models/:owner/:name/versions` - Get model versions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Replicate](https://replicate.com) - For the amazing API
- [Electron](https://www.electronjs.org/) - For making desktop apps possible
- [Vite](https://vitejs.dev/) - For the blazing fast build tool
- [Tailwind CSS](https://tailwindcss.com/) - For the utility-first CSS framework

## 📧 Contact

- GitHub: [@LTXY12](https://github.com/LTXY12)
- Email: gravy-glimpse.0a@icloud.com

## 🔗 Links

- [Replicate Documentation](https://replicate.com/docs)
- [Electron Builder](https://www.electron.build/)
- [React Documentation](https://react.dev/)

---

**Made with ❤️ using React, TypeScript, and Electron**
