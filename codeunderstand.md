# Code Understanding: `app.py` (4W1H)

## 1) What (คืออะไร?)
`app.py` คือไฟล์ **Backend หลักของระบบ** ที่ทำ 3 งานสำคัญ:
1. ตั้งค่า Flask app + ข้อจำกัดการอัปโหลดไฟล์
2. โหลดโมเดล YOLO (`best.pt`) ตอนเริ่มโปรแกรม
3. เปิด API `/` และ `/detect` เพื่อรับภาพแล้วคืนผลตรวจจับไพ่เป็น JSON

---

## 2) Who (ใครใช้งาน/เกี่ยวข้อง?)
- **Frontend (`static/app.js`)** เป็นผู้เรียก endpoint `/detect` ด้วย `fetch` + `FormData` (`image`, `confidence`)
- **ผู้ใช้ปลายทาง** อัปโหลดรูป/เปิดวิดีโอ/กล้องผ่านหน้าเว็บ แล้วผลจะวิ่งเข้ามาที่ backend นี้
- **โมเดล Ultralytics YOLO** ถูกเรียกใช้ใน backend เพื่อ inference จริง

---

## 3) When (ทำงานเมื่อไหร่?)
- ตอนเริ่มรัน `python app.py`:
  - สร้างโฟลเดอร์ `uploads/`
  - ตรวจว่ามี `best.pt`
  - โหลดโมเดลเข้าหน่วยความจำทันที
- ทุกครั้งที่ client ยิง `POST /detect`:
  - ตรวจ request -> เซฟไฟล์ -> infer -> deduplicate -> ส่งผลกลับ -> ลบไฟล์ชั่วคราว
- ตอนสั่งรันตรงไฟล์:
  - Flask dev server เปิดที่ `0.0.0.0:5000` และ `debug=True`

---

## 4) Where (อยู่ตรงไหน/แตะส่วนไหนของระบบ?)
- อยู่ที่ root ของโปรเจกต์ (`/workspace/object-detection-poker2/app.py`)
- ทำงานกับ:
  - โฟลเดอร์ `uploads/` สำหรับไฟล์ชั่วคราว
  - ไฟล์โมเดล `best.pt` ใน root
  - Template `templates/index.html` ผ่าน route `/`

---

## 5) How (ทำงานอย่างไร?)

### A) การรับไฟล์ + validate
- ต้องมี field ชื่อ `image` ไม่งั้นคืน 400
- ถ้าชื่อไฟล์ว่างก็คืน 400
- ใช้ `secure_filename` + UUID ลดความเสี่ยง path traversal และชนชื่อไฟล์

```python
if "image" not in request.files:
    return jsonify({"error": "No image file provided. Use field name 'image'."}), 400

file = request.files["image"]
if not file.filename:
    return jsonify({"error": "Empty filename."}), 400
```

### B) การประมวลผล confidence
- อ่านจาก `request.form["confidence"]`
- รองรับทั้งค่าร้อยละ (เช่น 50) และค่า 0–1 (เช่น 0.5)
- clamp ให้อยู่ในช่วง 0.0–1.0 ก่อนส่งเข้า YOLO

```python
requested_confidence = request.form.get("confidence", "").strip()
confidence = CONFIDENCE_THRESHOLD
if requested_confidence:
    parsed_confidence = float(requested_confidence)
    confidence = parsed_confidence / 100 if parsed_confidence > 1 else parsed_confidence
    confidence = max(0.0, min(confidence, 1.0))
```

### C) การแปลงผล YOLO เป็น JSON ที่ frontend ใช้ได้ตรง ๆ
- อ่าน class id, confidence, และกล่องจาก `xyxyn`
- แปลงเป็น `%` เพื่อ render CSS ได้ง่าย:
  - `left`, `top`, `width`, `height` อยู่ในสเกล 0–100
  - `confidence` ก็เป็นเปอร์เซ็นต์ 0–100

```python
raw_detections.append({
    "class":      label,
    "confidence": round(confidence * 100, 1),
    "box": {
        "left":   round(x1 * 100, 2),
        "top":    round(y1 * 100, 2),
        "width":  round((x2 - x1) * 100, 2),
        "height": round((y2 - y1) * 100, 2),
    }
})
```

### D) Dedup ต่อ class (logic เฉพาะโดเมนไพ่)
- ถ้าตรวจเจอไพ่ class เดียวกันหลายกรอบ จะเก็บเฉพาะกรอบที่ confidence สูงสุด

```python
best_per_class = {}
for det in raw_detections:
    cls = det['class']
    if cls not in best_per_class:
        best_per_class[cls] = det
    else:
        if det['confidence'] > best_per_class[cls]['confidence']:
            best_per_class[cls] = det

detections = list(best_per_class.values())
```

### E) Error + Cleanup
- error ใด ๆ จะคืน `{"error": ...}` ด้วย HTTP 500
- `finally` จะลบไฟล์ temp เสมอ ป้องกันไฟล์ค้าง

```python
except Exception as e:
    return jsonify({"error": str(e)}), 500

finally:
    # ลบ temp file เสมอ ไม่ว่าจะสำเร็จหรือ exception
    if temp_path and os.path.exists(temp_path):
        os.remove(temp_path)
```

---

## สรุปสั้น ๆ ของไฟล์นี้
`app.py` เป็น “ศูนย์กลาง backend inference” ที่ออกแบบมาให้เรียบง่ายและใช้งานจริงได้ทันที: validate ดี, output format ชัด, มี dedup logic, และ cleanup resource ครบ.

---

# Code Understanding: `templates/index.html` (4W1H)

## 1) What (คืออะไร?)
`templates/index.html` คือไฟล์ **โครงสร้างหน้าเว็บหลัก (Single Page UI)** ของโปรเจกต์ ทำหน้าที่เป็นจุดรวม component ฝั่งผู้ใช้ เช่นโซนอัปโหลด, พื้นที่แสดงสื่อ, เครื่องมือปรับ confidence, ปุ่มควบคุมกล้อง/ล้างข้อมูล, และ panel วิเคราะห์ผลไพ่.

---

## 2) Who (ใครใช้งาน/เกี่ยวข้อง?)
- **Flask (`app.py`)** เป็นผู้ render ไฟล์นี้ผ่าน route `GET /`.
- **JavaScript (`static/app.js`)** ใช้ element id ในไฟล์นี้เพื่อ bind event, ส่งข้อมูลไป `/detect`, และอัปเดตผลแบบ real-time.
- **ผู้ใช้ปลายทาง** ใช้หน้าเว็บนี้ในการอัปโหลดรูป/วิดีโอหรือเปิด webcam เพื่อให้ระบบตรวจจับไพ่.

---

## 3) When (ทำงานเมื่อไหร่?)
- ทำงานเมื่อผู้ใช้เปิดหน้าแรกของแอป (`/`) แล้ว Flask render template นี้.
- หลังหน้าโหลดเสร็จ `app.js` จะเริ่ม initialize behavior ต่าง ๆ กับ element ในหน้านี้ทันที (เช่น upload, drag-drop, slider, webcam).
- ระหว่างใช้งาน หน้าเดียวนี้จะถูกอัปเดตสถานะ/ผลลัพธ์ต่อเนื่อง โดยไม่ต้องเปลี่ยนหน้า.

---

## 4) Where (อยู่ตรงไหน/แตะส่วนไหนของระบบ?)
- ตำแหน่งไฟล์: `templates/index.html` (โฟลเดอร์มาตรฐาน Flask template)
- อ้าง static assets ผ่าน `url_for`:
  - CSS: `static/style.css`
  - JS: `static/app.js`
- มี id สำคัญที่เป็น contract ร่วมกับ `app.js` เช่น `dropzone`, `fileInput`, `displayImage`, `displayVideo`, `confSlider`, `webcamBtn`, `clearBtn`, `resultAnalysis` ฯลฯ

---

## 5) How (ทำงานอย่างไร?)

### A) Page shell + hero
- โครงหลักครอบด้วย `.app-shell` และส่วน `header.hero` เพื่อสื่อสารชื่อระบบและคำอธิบายการใช้งาน.

### B) Input stage (อัปโหลด/แสดงสื่อ)
- ส่วน `#dropzone` รับทั้ง click และ drag-drop.
- `#fileInput` รับไฟล์ `image/*,video/*`.
- `#mediaWrapper` มีทั้ง `<img id="displayImage">` และ `<video id="displayVideo">` สำหรับแสดงสื่อที่เลือก.
- มี `<canvas id="hiddenCanvas">` ซ่อนไว้เพื่อจับเฟรมวิดีโอ/เว็บแคมส่งตรวจจับ.

```html
<div id="dropzone" class="panel dropzone" role="button" tabindex="0" aria-label="อัปโหลดรูปหรือวิดีโอ">
    <input type="file" id="fileInput" class="hidden" accept="image/*,video/*">

    <div id="uploadPrompt" class="upload-prompt">
        <div class="upload-badge">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
        </div>
        <p class="upload-title">Drag and drop หรือคลิกเพื่อเลือกไฟล์</p>
        <p class="upload-copy">ภาพจะส่งเข้า `/detect` ทันที ส่วนวิดีโอและ webcam จะส่งเป็นเฟรมต่อเนื่อง</p>
    </div>

    <div id="scannerOverlay" class="scanner-overlay hidden" aria-hidden="true">
        <div class="scanner-line"></div>
        <p>Analyzing cards...</p>
    </div>

    <div id="mediaWrapper" class="media-wrapper hidden">
        <div id="mediaStage" class="media-stage">
            <img id="displayImage" class="media-element hidden" alt="Preview">
            <video id="displayVideo" class="media-element hidden" autoplay muted playsinline></video>
        </div>
        <canvas id="hiddenCanvas" class="hidden"></canvas>
    </div>
</div>
```

### C) Toolbar controls
- slider `#confSlider` สำหรับตั้ง threshold 0–100.
- `#confValueDisplay` แสดงค่าปัจจุบันเป็นเปอร์เซ็นต์.
- switch `#toggleBoxes` สำหรับเปิด/ปิดการแสดงกรอบ bounding boxes.

```html
<div class="panel toolbar">
    <div class="threshold-group">
        <div class="toolbar-header">
            <label for="confSlider">Confidence Threshold</label>
            <span id="confValueDisplay" class="value-chip">50%</span>
        </div>
        <input type="range" id="confSlider" min="0" max="100" value="50">
    </div>

    <label class="switch-group" for="toggleBoxes">
        <span>แสดงกรอบ</span>
        <span class="switch">
            <input type="checkbox" id="toggleBoxes" checked>
            <span class="switch-ui"></span>
        </span>
    </label>
</div>
```

### D) Action buttons
- `#webcamBtn` ใช้เปิด/ปิดโหมดกล้อง.
- `#clearBtn` ใช้ reset สถานะ/ผลลัพธ์ใน UI.

### E) Analysis panel
- แสดงสถานะระบบผ่าน `#statusDot` และ `#statusText`.
- โหมดว่างใช้ `#emptyAnalysis`.
- โหมดมีผลลัพธ์ใช้ `#resultAnalysis` และประกอบด้วย:
  - จำนวนไพ่ (`#cardCount`)
  - ไพ่ที่ตรวจพบ (`#visualCardsContainer`)
  - best hand (`#bestHandResult`, `#bestHandCards`)
  - draws/outs (`#drawsContainer`, `#drawsResult`)
  - tips (`#tipsContainer`, `#tipsTitle`, `#tipsBody`, `#closeTipsBtn`)

```html
<section class="panel analysis-panel">
    <div class="analysis-header">
        <div>
            <p class="panel-kicker">Board Analysis</p>
            <h2>Current Table State</h2>
        </div>
        <div class="status-cluster">
            <span id="statusDot" class="status-dot is-idle"></span>
            <span id="statusText">พร้อมใช้งาน</span>
        </div>
    </div>

    <div id="emptyAnalysis" class="empty-analysis">
        <p id="emptyAnalysisTitle" class="empty-title">พร้อมสแกนไพ่</p>
        <p id="emptyAnalysisCopy" class="empty-copy">อัปโหลดรูป เปิดกล้อง หรือใช้วิดีโอเพื่อเริ่มวิเคราะห์บน frontend จริง</p>
    </div>

    <div id="resultAnalysis" class="results hidden">
        <section class="result-block">
            <div class="result-row">
                <p class="result-label">Detected Cards</p>
                <p class="result-meta"><span id="cardCount">0</span> ใบ</p>
            </div>
            <div id="visualCardsContainer" class="visual-cards"></div>
        </section>

        <section class="result-block highlight-block">
            <p class="result-label">Current Best Hand</p>
            <div id="bestHandResult" class="best-hand-result"></div>
            <div id="bestHandCards" class="best-hand-cards"></div>
        </section>

        <section id="drawsContainer" class="result-block draws-block hidden">
            <p class="result-label">Draws / Outs</p>
            <div id="drawsResult" class="draws-result"></div>
        </section>

        <section id="tipsContainer" class="result-block tips-block hidden">
            <div class="result-row">
                <p class="result-label">Tips</p>
                <button id="closeTipsBtn" class="tip-close-btn" type="button" aria-label="ซ่อนคำอธิบาย">ปิด</button>
            </div>
            <h3 id="tipsTitle" class="tips-title"></h3>
            <p id="tipsBody" class="tips-body"></p>
        </section>
    </div>
</section>
```

### F) Integration point
- ท้ายไฟล์โหลด `app.js` เพื่อให้ทุก element ที่ประกาศใน HTML ถูก bind พฤติกรรมได้หลัง DOM พร้อมใช้งาน.

---

## สรุปสั้น ๆ ของไฟล์นี้
`templates/index.html` เป็น “โครง UI กลาง” ที่กำหนดทั้ง layout และ id contract ให้ `app.js` ทำงานแบบ interactive ได้ครบทุกโหมด (ภาพ, วิดีโอ, webcam) และแสดงผลวิเคราะห์โป๊กเกอร์ในหน้าเดียว.

---

# Code Understanding: `static/style.css` (4W1H)

## 1) What (คืออะไร?)
`static/style.css` คือไฟล์ **กำหนดหน้าตา (presentation layer)** ของหน้าเว็บทั้งหมด ตั้งแต่ธีมสี, layout หลัก, คอมโพเนนต์ปุ่ม/การ์ด, สถานะระบบ, กล่องผลตรวจจับ (bounding box) ไปจนถึง responsive behavior บนหน้าจอเล็ก.

---

## 2) Who (ใครใช้งาน/เกี่ยวข้อง?)
- **`templates/index.html`** อ้างไฟล์นี้ผ่าน `url_for('static', filename='style.css')` เพื่อจัดสไตล์ให้ทุก element.
- **`static/app.js`** สร้าง/สลับ class หลายตัวที่ stylesheet นี้รองรับ เช่น `.hidden`, `.bounding-box`, สถานะ `.status-dot.is-*`, และ state ปุ่มกล้อง.
- **ผู้ใช้ปลายทาง** รับผลด้าน UX โดยตรงจากไฟล์นี้ เช่น dark theme, visual feedback, และการจัด layout ให้อ่านผลง่าย.

---

## 3) When (ทำงานเมื่อไหร่?)
- ทำงานทันทีที่หน้า `index.html` โหลด CSS เข้ามา.
- มีผลต่อเนื่องทุกครั้งที่ JS เปลี่ยน class หรือเพิ่ม node ใหม่ (เช่น render bounding box, เปลี่ยนสถานะ analyzing/live/success/error).
- มี media queries ที่ปรับ layout อัตโนมัติเมื่อความกว้างหน้าจอลดลง (responsive).

---

## 4) Where (อยู่ตรงไหน/แตะส่วนไหนของระบบ?)
- ตำแหน่งไฟล์: `static/style.css`
- ครอบคลุมโครงสร้างหลักจาก HTML ได้แก่:
  - shell และ hero (`.app-shell`, `.hero`)
  - พื้นที่อัปโหลด/แสดงผล (`.dropzone`, `.media-wrapper`, `.media-stage`)
  - panel วิเคราะห์ (`.analysis-panel`, `.status-dot`, `.results`)
  - ผลตรวจจับและองค์ประกอบ UI เฉพาะ (`.playing-card`, `.draw-chip`, `.tip-trigger`, `.bounding-box`)

---

## 5) How (ทำงานอย่างไร?)

### A) Theme + Layout
- ใช้ CSS variables (`:root`) กำหนดชุดสี, รัศมีมุม, และเงา เพื่อคุม design language ทั้งระบบ.
- ใช้ grid/flex สร้างโครง dashboard 2 คอลัมน์ และ fallback เป็นคอลัมน์เดียวบนจอเล็ก.

```css
:root {
    --bg: #060606;
    --bg-soft: #101010;
    --panel: rgba(16, 16, 16, 0.82);
    --panel-border: rgba(255, 255, 255, 0.08);
    --text: #f7f7f7;
    --muted: #989898;
    --accent: #e11d2f;
    --accent-strong: #ff3348;
    --accent-soft: rgba(225, 29, 47, 0.14);
    --success: #f2f2f2;
    --radius-lg: 28px;
    --radius-md: 18px;
    --radius-sm: 12px;
    --shadow-panel: 0 26px 80px rgba(0, 0, 0, 0.42);
}

.dashboard {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.95fr);
    gap: 24px;
    align-items: start;
}
```

### B) Upload/Media Experience
- `dropzone` มี state `dragover` สำหรับ feedback ตอนลากไฟล์.
- มี `scanner-overlay` + animation line ช่วยสื่อสถานะกำลังประมวลผล.
- media stage ถูกจัดให้รองรับทั้งรูปและวิดีโอในพื้นที่เดียว.

```css
.dropzone {
    min-height: 560px;
    padding: 20px;
    border: 1px solid rgba(225, 29, 47, 0.25);
    outline: 1px dashed rgba(255, 255, 255, 0.12);
    outline-offset: -14px;
    cursor: pointer;
    transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.dropzone.dragover {
    transform: translateY(-2px);
    border-color: rgba(255, 51, 72, 0.5);
    background: rgba(30, 10, 12, 0.95);
}

.upload-prompt {
    min-height: 520px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 14px;
    text-align: center;
    padding: 48px 24px;
}

.media-wrapper {
    position: relative;
    display: flex;
    width: 100%;
    min-height: 520px;
    align-items: center;
    justify-content: center;
}
```

### C) Analysis UI
- `status-dot` มีหลายสถานะ (`idle`, `analyzing`, `live`, `success`, `error`) และมี pulse animation ในโหมดที่กำลังทำงาน.
- โซนผลลัพธ์ถูกแยกเป็นบล็อกการ์ด (detected cards, best hand, draws, tips) เพื่อให้อ่านง่าย.

```css
.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #686868;
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.24);
}

.status-dot.is-analyzing,
.status-dot.is-live {
    animation: pulse 1.2s infinite;
}

.status-dot.is-idle {
    background: #686868;
}

.status-dot.is-analyzing {
    background: var(--accent-strong);
}

.status-dot.is-live {
    background: #ff8090;
}

.status-dot.is-success {
    background: var(--success);
}

.status-dot.is-error {
    background: #8a1f2a;
}

.results {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.result-block {
    padding: 18px;
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.26);
    border: 1px solid rgba(255, 255, 255, 0.06);
}
```

### D) Visual Representation ของผลตรวจจับ
- `.playing-card` ใช้สำหรับแสดงไพ่ที่ตรวจพบใน panel.
- `.bounding-box` + `.box-label` ใช้ซ้อนบนภาพ/วิดีโอเพื่อระบุตำแหน่งไพ่และ confidence.

```css
.playing-card {
    position: relative;
    width: 62px;
    height: 90px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 5px;
    border-radius: 10px;
    background: white;
    box-shadow: 0 16px 24px rgba(0, 0, 0, 0.32);
    animation: pop-in 220ms ease backwards;
}

.bounding-box {
    position: absolute;
    z-index: 10;
    border: 2px solid var(--accent-strong);
    border-radius: 10px;
    box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.06),
        0 0 22px rgba(255, 51, 72, 0.4);
    pointer-events: none;
    transition: opacity 120ms ease;
}

.box-label {
    position: absolute;
    top: -28px;
    left: -2px;
    padding: 5px 10px;
    border-radius: 10px 10px 10px 2px;
    background: var(--accent);
    color: white;
    font-size: 0.76rem;
    font-weight: 700;
    white-space: nowrap;
}
```

### E) Responsive
- จุดตัด `@media (max-width: 1100px)` ปรับ dashboard เป็นคอลัมน์เดียว.
- จุดตัด `@media (max-width: 720px)` ลด spacing/ขนาดพื้นที่เพื่อให้ใช้งานบนมือถือได้ดีขึ้น.

---

## สรุปสั้น ๆ ของไฟล์นี้
`static/style.css` เป็นตัวกำหนดประสบการณ์การใช้งานทั้งหมดของ frontend: จากภาพรวมธีมและเลย์เอาต์ ไปจนถึง micro-interaction อย่างสถานะการสแกนและกรอบตรวจจับ ทำให้ผลจาก `app.js` ถูกสื่อสารกับผู้ใช้ได้ชัดและใช้งานจริงได้ลื่น.
