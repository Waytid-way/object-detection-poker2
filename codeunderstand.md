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

### B) การประมวลผล confidence
- อ่านจาก `request.form["confidence"]`
- รองรับทั้งค่าร้อยละ (เช่น 50) และค่า 0–1 (เช่น 0.5)
- clamp ให้อยู่ในช่วง 0.0–1.0 ก่อนส่งเข้า YOLO

### C) การแปลงผล YOLO เป็น JSON ที่ frontend ใช้ได้ตรง ๆ
- อ่าน class id, confidence, และกล่องจาก `xyxyn`
- แปลงเป็น `%` เพื่อ render CSS ได้ง่าย:
  - `left`, `top`, `width`, `height` อยู่ในสเกล 0–100
  - `confidence` ก็เป็นเปอร์เซ็นต์ 0–100

### D) Dedup ต่อ class (logic เฉพาะโดเมนไพ่)
- ถ้าตรวจเจอไพ่ class เดียวกันหลายกรอบ จะเก็บเฉพาะกรอบที่ confidence สูงสุด

### E) Error + Cleanup
- error ใด ๆ จะคืน `{"error": ...}` ด้วย HTTP 500
- `finally` จะลบไฟล์ temp เสมอ ป้องกันไฟล์ค้าง

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

### C) Toolbar controls
- slider `#confSlider` สำหรับตั้ง threshold 0–100.
- `#confValueDisplay` แสดงค่าปัจจุบันเป็นเปอร์เซ็นต์.
- switch `#toggleBoxes` สำหรับเปิด/ปิดการแสดงกรอบ bounding boxes.

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

### B) Upload/Media Experience
- `dropzone` มี state `dragover` สำหรับ feedback ตอนลากไฟล์.
- มี `scanner-overlay` + animation line ช่วยสื่อสถานะกำลังประมวลผล.
- media stage ถูกจัดให้รองรับทั้งรูปและวิดีโอในพื้นที่เดียว.

### C) Analysis UI
- `status-dot` มีหลายสถานะ (`idle`, `analyzing`, `live`, `success`, `error`) และมี pulse animation ในโหมดที่กำลังทำงาน.
- โซนผลลัพธ์ถูกแยกเป็นบล็อกการ์ด (detected cards, best hand, draws, tips) เพื่อให้อ่านง่าย.

### D) Visual Representation ของผลตรวจจับ
- `.playing-card` ใช้สำหรับแสดงไพ่ที่ตรวจพบใน panel.
- `.bounding-box` + `.box-label` ใช้ซ้อนบนภาพ/วิดีโอเพื่อระบุตำแหน่งไพ่และ confidence.

### E) Responsive
- จุดตัด `@media (max-width: 1100px)` ปรับ dashboard เป็นคอลัมน์เดียว.
- จุดตัด `@media (max-width: 720px)` ลด spacing/ขนาดพื้นที่เพื่อให้ใช้งานบนมือถือได้ดีขึ้น.

---

## สรุปสั้น ๆ ของไฟล์นี้
`static/style.css` เป็นตัวกำหนดประสบการณ์การใช้งานทั้งหมดของ frontend: จากภาพรวมธีมและเลย์เอาต์ ไปจนถึง micro-interaction อย่างสถานะการสแกนและกรอบตรวจจับ ทำให้ผลจาก `app.js` ถูกสื่อสารกับผู้ใช้ได้ชัดและใช้งานจริงได้ลื่น.
