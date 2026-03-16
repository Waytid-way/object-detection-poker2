# Poker Card Detector - Workspace Instructions

**Project**: Texas Hold'em Vision (Poker Card Detector)  
**Team**: AIE223  
**Tech Stack**: Python + Flask + YOLO11n + Vanilla JavaScript  
**Status**: Production-ready backend, fully integrated frontend

---

## 🏗️ Project Architecture

### Backend (Python/Flask)
- **Framework**: Flask 2.3+ (lightweight web server)
- **ML Model**: YOLO11n (Ultralytics) for real-time object detection
- **Port**: 5000 (localhost), exposes via ngrok for public HTTPS access

### Frontend (Web UI)
- **Stack**: HTML5 + CSS3 + Vanilla JavaScript (no frameworks)
- **Features**: 
  - Drag-drop file upload (images/videos)
  - Live webcam streaming
  - Real-time detection with bounding boxes
  - Poker hand analysis (10 hand ranks + 3 draw types)
  - Card deduplication across frames
  - Responsive dark theme

---

## 📁 File Structure & Purpose

### Root Level
| File | Purpose | Notes |
|------|---------|-------|
| `app.py` | Flask backend server | Main entry point; handles `/detect` endpoint |
| `requirements.txt` | Python dependencies | pip install -r requirements.txt |
| `best.pt` | YOLO11n model weights | Required; binary file (not in git) |
| `start-ngrok.sh` / `start-ngrok.bat` | Public tunnel scripts | For HTTPS/webcam access |
| `README-START.md` | Quick start guide (Thai) | Setup & run instructions |
| `REPORT.md` | Project documentation (Thai) | Architecture & deliverables |

### `/templates`
- **index.html**: Single-page app HTML template
  - Hero header with project title
  - Dropzone for file uploads
  - Media preview (image/video)
  - Analysis panel with results
  - Toolbar with confidence threshold slider

### `/static`
- **app.js** (~1000 lines):
  - DOM manipulation & state management
  - File upload/webcam/video handlers
  - YOLO inference API calls
  - Bounding box rendering (canvas)
  - Poker hand evaluation logic
  - Draws/outs calculation
  - Frame debouncing (stable detections over N frames)
  - **Key functions**:
    - `detectFromImage()` - single image inference
    - `runWebcamDetectionLoop()` - continuous webcam frames
    - `runVideoDetectionLoop()` - video file processing
    - `evaluatePokerHand()` - hand ranking logic
    - `renderDetections()` - bounding box overlay

- **style.css** (~500 lines):
  - Dark theme (bg: #060606, accent: red #e11d2f)
  - Grid/flexbox layout (hero, sidebar, main content)
  - Custom slider/toggle controls
  - Responsive design (mobile-friendly)
  - Fonts: IBM Plex Sans Thai + Space Grotesk

### `/uploads`
- Temporary directory for uploaded files
- Auto-created by Flask
- Files deleted after inference completes

---

## 🚀 Quick Start

### Local Development
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start Flask server (runs on http://127.0.0.1:5000)
python app.py

# 3. Open browser to http://127.0.0.1:5000
```

### Public Access (Webcam Required)
```bash
# Terminal 1: Start Flask
python app.py

# Terminal 2: Start ngrok tunnel
# Windows:
start-ngrok.bat

# macOS/Linux:
./start-ngrok.sh

# Copy ngrok URL (https://...-free.app) and use in browser
```

---

## 🔧 Key Implementation Details

### Backend (`app.py`)

#### `/detect` Endpoint (POST)
- **Input**: Multipart form with `image` field (JPEG/PNG)
- **Process**:
  1. Validate & secure filename
  2. Save temp file to `/uploads`
  3. Run YOLO inference at confidence threshold
  4. Extract bounding boxes (normalized 0-1 coords)
  5. **Deduplication**: Keep only highest confidence per card class
  6. Delete temp file
- **Output**: JSON with detected cards, confidence, coordinates
- **Error handling**: Returns 400/500 with error message

#### Confidence Threshold
- Default: 0.5 (50%)
- User-adjustable: 0-100%
- Converted to 0-1 range for YOLO

### Frontend (`app.js`)

#### Detection Flow
1. **Upload**: File → validate → send to `/detect` → parse JSON
2. **Webcam**: Continuous loop (120ms interval), each frame to `/detect`
3. **Video**: Frame extraction via canvas (200ms interval)

#### Frame Stabilization
- **Problem**: YOLO predictions flicker across frames
- **Solution**: Require 2 consecutive frames with same detection before rendering
- **Clear condition**: 3 frames without detection → clear results

#### Poker Hand Evaluation
- **Input**: List of detected card names (e.g., "AS", "KH", "QD", etc.)
- **Logic**:
  - Rank extraction: A=14, K=13, ..., 2=2
  - Suit extraction: S/H/D/C
  - Hand evaluation: Royal Flush → High Card (10 ranks)
  - Draw detection: Flush Draw, OESD, Gutshot (3 types)
- **Output**: Best hand name + rank + drawing cards list

#### Canvas Rendering
- Create canvas overlay on media element
- Draw rectangles for each detection
- Include card name + confidence label
- Rendering throttled to prevent lag

---

## ⚡ Performance Considerations

| Aspect | Detail |
|--------|--------|
| **Max upload** | 16 MB (set in Flask) |
| **Model inference** | ~50-100ms per image (GPU-dependent) |
| **Webcam FPS** | ~8-10 FPS (120ms interval) |
| **Frame stabilization** | 2-frame buffer (prevents flickering) |
| **Canvas rendering** | Throttled (detect → render once per update) |

---

## 🎯 Common Tasks

### Add a New Card Class
1. Train/retrain YOLO model on new card type
2. Export as `best.pt`
3. Update `HAND_TIPS` in `app.js` if new suit/rank
4. Frontend auto-detects new classes from model output

### Change Confidence Default
- **Backend**: Edit `CONFIDENCE_THRESHOLD = 0.5` in `app.py` line 14
- **Frontend**: Edit `value="50"` in `index.html` confidence slider

### Adjust Detection Sensitivity
- **Webcam speed**: Change `WEBCAM_DETECTION_DELAY_MS` in `app.js` (milliseconds)
- **Frame stability**: Change `STABLE_DETECTION_FRAMES` in `app.js` (number of frames)

### Deploy to Production
- Replace Flask dev server with production WSGI (Gunicorn)
- Set `debug=False` in `app.py` line ~150
- Use ngrok for testing; reverse proxy (nginx) for production
- Ensure `best.pt` is accessible in production

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'flask'` | `pip install -r requirements.txt` |
| `FileNotFoundError: best.pt not found` | Ensure `best.pt` exists in project root |
| ngrok tunnel fails | Run `ngrok config add-authtoken <TOKEN>` first |
| Browser shows blank page | Check Flask server is running (port 5000 open?) |
| Detections not showing | Check confidence threshold (may be too high) |
| Webcam permission denied | Allow browser to access camera in OS settings |

---

## 📝 Code Standards

- **Backend**: Flask conventions; keep endpoint logic minimal
- **Frontend**: Vanilla JS; avoid frameworks unless necessary
- **Comments**: Thai + English (project-specific)
- **File organization**: Templates, static, backend at root level
- **Git**: Ignore `uploads/`, `best.pt`, `.venv/`, `__pycache__/`

---

## 🔐 Security Notes

- **Path traversal protection**: `secure_filename()` used in app.py
- **File size limit**: 16 MB max upload
- **CORS**: Not explicitly configured (frontend on same origin currently)
- **ngrok**: Free tier rate-limited; auth token required for production

---

## 📌 Related Files

- GitHub: https://github.com/Waytid-way/object-detection-poker
- YOLO Docs: https://docs.ultralytics.com/
- Flask Docs: https://flask.palletsprojects.com/
