<img width="1250" height="1250" alt="S-T-Station Logo" src="https://github.com/user-attachments/assets/589dbbf5-9df1-41d9-813a-e37ad1a2f3b3" />

# S-T-Station Music Library

[![GitHub last commit](https://img.shields.io/github/last-commit/Gandorini/Music-Libary-ST-Station)](https://github.com/Gandorini/Music-Libary-ST-Station/commits/main)
[![GitHub repo size](https://img.shields.io/github/repo-size/Gandorini/Music-Libary-ST-Station)](https://github.com/Gandorini/Music-Libary-ST-Station)

A comprehensive web platform for managing, sharing, and accessing sheet music and musical notations. S-T-Station empowers musicians, students, and teachers with powerful tools to organize and explore digital sheet music collections.

## 🎵 Overview

S-T-Station is designed to bridge the gap between traditional sheet music and modern digital workflows. Whether you're a student building your repertoire, a teacher managing lesson materials, or a musician organizing your collection, S-T-Station provides an intuitive interface for all your sheet music needs.

## ✨ Key Features

- 📚 **Comprehensive Sheet Music Library** - Store and organize your entire sheet music collection in one place
- 🎼 **Smart Organization** - Filter and sort by instrument, composer, genre, difficulty level, and more
- 🔍 **Advanced Search** - Quickly find the exact piece you're looking for
- 👁️ **Digital Viewer** - View and annotate sheet music directly in your browser
- 📤 **Upload & Share** - Easily add new pieces to your library and share with others
- 🎹 **Optical Music Recognition (OMR)** - Convert scanned sheet music to digital format using Audiveris integration
- 📱 **Responsive Design** - Access your library from any device

## 🖼️ Screenshots

### Landing Page
<img width="1849" height="983" alt="S-T-Station Landing Page" src="https://github.com/user-attachments/assets/d4655305-0b09-4746-94a0-d6805ee7f2aa" />

## 🛠️ Tech Stack

**Frontend:**
- React.js with TypeScript
- Vite (Build tool and dev server)

**Backend:**
- Python (API/Backend logic)
- Node.js runtime environment

**Additional Tools:**
- Audiveris 5.5.3 (Optical Music Recognition)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16. x or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Python](https://www.python.org/) (v3.8 or higher)
- Java Runtime Environment (required for Audiveris)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Gandorini/Music-Libary-ST-Station.git
cd Music-Libary-ST-Station
```

### 2. Install Frontend Dependencies

```bash
npm install
# or
yarn install
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set Up Audiveris

Audiveris is included in the `/audiveris-5.5.3/` directory. Follow these steps:

1. Navigate to the Audiveris directory:
   ```bash
   cd audiveris-5.5.3
   ```

2. Follow the installation instructions in the Audiveris README
3. Ensure Java Runtime Environment is properly configured

For detailed Audiveris setup, refer to:  [Audiveris Documentation](https://github.com/Audiveris/audiveris)

### 5. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
API_URL=http://localhost:5000

# Database Configuration (if applicable)
DATABASE_URL=your_database_url

# Audiveris Path
AUDIVERIS_PATH=./audiveris-5.5.3
```

### 6. Build the Project

```bash
npm run build
```

### 7. Start the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The application should now be running at `http://localhost:3000` (or the port specified in your `.env` file).

## 📖 Usage

### Uploading Sheet Music

1. Click the "Upload" button in the navigation bar
2. Select your PDF or image file
3. Add metadata (title, composer, instrument, etc.)
4. Click "Submit" to add to your library

### Using OMR (Optical Music Recognition)

1. Upload a scanned image of sheet music
2. Select "Process with OMR" option
3. Audiveris will convert the image to a digital music format
4. Review and edit the converted notation

### Organizing Your Library

- Use filters in the sidebar to browse by category
- Create custom playlists or collections
- Tag pieces for easy retrieval
- Share collections with other users

  
### Reporting Issues

If you encounter bugs or have feature requests, please [open an issue](https://github.com/Gandorini/Music-Libary-ST-Station/issues) with: 
- A clear, descriptive title
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots if applicable

## 📄 License

This project uses multiple licenses:

- **Audiveris**:  Licensed under AGPL v3 (see `/audiveris-5.5.3/LICENSE`)
- **S-T-Station Platform**: Please refer to the repository license or contact the maintainer

## 🙏 Acknowledgments

- [Katka](https://www.facebook.com/katkastreetart/) - Audiveris logo design
- [Audiveris Team](https://github.com/Audiveris/audiveris) - Optical Music Recognition software
- All contributors who have helped shape this project

## 📞 Contact & Support

- **Repository**: [Gandorini/Music-Libary-ST-Station](https://github.com/Gandorini/Music-Libary-ST-Station)
- **Issues**: [GitHub Issues](https://github.com/Gandorini/Music-Libary-ST-Station/issues)
- **Maintainer**: [@Gandorini](https://github.com/Gandorini)

## 🗺️ Roadmap

Future enhancements planned:

- [ ] Mobile applications (iOS/Android)
- [ ] Real-time collaborative editing
- [ ] MIDI playback support
- [ ] Advanced music analysis tools
- [ ] Integration with popular music notation software
- [ ] Cloud storage synchronization

---

<p align="center">Made with ❤️ for musicians everywhere</p>
