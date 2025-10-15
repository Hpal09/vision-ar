# Vision byDisrupt AR Demo

[![Pages](https://github.com/Hpal09/vision-ar/actions/workflows/pages.yml/badge.svg)](https://github.com/Hpal09/vision-ar/actions/workflows/pages.yml) [![License](https://img.shields.io/github/license/Hpal09/vision-ar)](LICENSE) [![Stars](https://img.shields.io/github/stars/Hpal09/vision-ar?style=social)](https://github.com/Hpal09/vision-ar/stargazers) [![Issues](https://img.shields.io/github/issues/Hpal09/vision-ar)](https://github.com/Hpal09/vision-ar/issues) [![Last commit](https://img.shields.io/github/last-commit/Hpal09/vision-ar)](https://github.com/Hpal09/vision-ar/commits/main)

An interactive Augmented Reality (AR) experience built with MindAR and Three.js that brings Dubai postcards to life with 3D models and interactive elements.

## 🌟 Features

- **Interactive AR Experience**: Point your camera at a Dubai postcard to activate the AR experience
- **3D Models**: Features the iconic Burj Khalifa building with smooth rotation animations
- **Animated Characters**:
  - **Rooey**: sequential loop — Hop with Arms Raised → Wave One Hand → Stand and Chat
  - **Griffin**: flies in a circle with subtle flapping/tilt
- **Rooey Speech Bubble**: Tap to open `engagesydney.com.au` in a new tab
- **Responsive Design**: Optimized for mobile devices and various screen sizes
- **Modern UI**: Clean scanning interface with smooth animations

## 🚀 Live Demo

Visit the live demo: [Vision byDisrupt AR Demo](https://hpal09.github.io/vision-ar/)

## 🛠️ Technologies Used

- **MindAR**: Web-based AR framework for image tracking
- **Three.js**: 3D graphics library for WebGL
- **HTML5/CSS3**: Modern web standards
- **JavaScript ES6+**: Modern JavaScript with modules

## 📱 Requirements

- **Device**: Smartphone or tablet with camera
- **Browser**: Modern browser with WebAR support (Chrome, Safari, Firefox)
- **Camera Permission**: Must allow camera access for AR functionality
- **Internet Connection**: Required for loading 3D models and textures

## 🎯 How to Use

1. **Open the Demo**: Navigate to the live demo URL on your mobile device
2. **Grant Permissions**: Allow camera access when prompted
3. **Point Camera**: Point your camera at a Dubai postcard image
4. **Interact**: Tap Rooey’s speech bubble to visit our Vision site, or explore the 3D scene
5. **Enjoy**: Watch Rooey’s looping animations, the flying griffin, and the rotating Burj Khalifa

## 🏗️ Project Structure

```
vision-ar/
├── index.html          # Main HTML file
├── app.js             # Main JavaScript application
├── style.css          # CSS styles
├── assets/            # 3D models and target images
│   └── targets/       # AR target images and 3D models
├── libs/              # External libraries
└── README.md          # This file
```

## 🔧 Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Hpal09/vision-ar.git
   cd vision-ar
   ```

2. **Open in browser**: Simply open `index.html` in a modern web browser

3. **Local development**: Use a local server for development:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

## 📋 Browser Compatibility

- ✅ **Chrome**: Full support (Android, Desktop)
- ✅ **Safari**: Full support (iOS, macOS)
- ✅ **Firefox**: Full support (Android, Desktop)
- ⚠️ **Edge**: Limited support
- ❌ **Internet Explorer**: Not supported

## 🎨 Customization

### Adding New 3D Models
1. Place your `.glb` or `.fbx` files in the `assets/targets/` folder
2. Update the model loading functions in `app.js`
3. Adjust positioning and scaling as needed

### Changing AR Targets
1. Replace the `postcard.mind` file in `assets/targets/`
2. Update the `imageTargetSrc` in the MindAR configuration
3. Ensure your target image has good contrast and unique features

### Modifying Animations
- Rooey’s sequence plays via an internal loop (hop → wave → stand). You can change clip names or order in `app.js`.
- Building rotation speed can be adjusted in `app.js` (Burj update in the render loop)
- Griffin’s path radius/speed/height wobble are configurable in `loadAnimatedGriffin()`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MindAR Team**: For the excellent WebAR framework
- **Three.js Community**: For the powerful 3D graphics library
- **byDisrupt Team**: For the creative vision and development

## 📞 Support

For support or questions about this project:
- **Website**: [byDisrupt](https://www.bydisrupt.com/)
- **Email**: Contact through our website
- **Issues**: Use GitHub Issues for bug reports and feature requests

## 🔮 Future Enhancements

- [ ] Support for multiple AR targets
- [ ] More interactive 3D models
- [ ] Sound effects and background music
- [ ] Social sharing features
- [ ] Analytics and user tracking
- [ ] Offline mode support

---

**Made with ❤️ by the byDisrupt Team**
