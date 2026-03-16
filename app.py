import os
import uuid
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
from ultralytics import YOLO


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

CONFIDENCE_THRESHOLD = 0.5
MODEL_PATH = "best.pt"

# Load model
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file '{MODEL_PATH}' not found. Please ensure the model file exists in the project directory.")

model = YOLO(MODEL_PATH)

# Routes
@app.route("/", methods=["GET"])
def index():
    """Serve หน้า frontend หลัก"""
    return render_template("index.html")


@app.route("/detect", methods=["POST"])
def detect():
    """
    รับไฟล์รูปภาพ → ทำ YOLO inference → Deduplicate → คืน JSON

    Deduplication: สำรับไพ่มีแต่ละใบแค่ 1 ใบ
    ถ้า detect ได้ class เดียวกัน 2 อัน → เก็บแค่อันที่ confidence สูงสุด
    """
    temp_path = None
    try:
        # ── 1. Validate request ───────────────
        if "image" not in request.files:
            return jsonify({"error": "No image file provided. Use field name 'image'."}), 400

        file = request.files["image"]
        if not file.filename:
            return jsonify({"error": "Empty filename."}), 400

        # ── 2. บันทึก temp file (secure_filename ป้องกัน path traversal) ──
        filename = secure_filename(file.filename or "")
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        temp_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        file.save(temp_path)

        # ── 3. Inference ──────────────────────
        requested_confidence = request.form.get("confidence", "").strip()
        confidence = CONFIDENCE_THRESHOLD
        if requested_confidence:
            parsed_confidence = float(requested_confidence)
            confidence = parsed_confidence / 100 if parsed_confidence > 1 else parsed_confidence
            confidence = max(0.0, min(confidence, 1.0))

        results = model(temp_path, conf=confidence)

        # ── 4. รวบรวม raw detections ทั้งหมด ──
        raw_detections = []
        for box in results[0].boxes:
            class_id   = int(box.cls[0])
            confidence = float(box.conf[0])
            label      = model.names[class_id]
            x1, y1, x2, y2 = box.xyxyn[0].tolist() # ใช้พิกัดแบบ Normalized (0-1)

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

        # ── 5. Deduplication: class เดียวกัน เก็บแค่ confidence สูงสุด ──
        best_per_class = {}
        for det in raw_detections:
            cls = det['class']
            if cls not in best_per_class:
                best_per_class[cls] = det
            else:
                if det['confidence'] > best_per_class[cls]['confidence']:
                    best_per_class[cls] = det

        detections = list(best_per_class.values())

        return jsonify({
            "success":    True,
            "count":      len(detections),
            "detections": detections,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # ลบ temp file เสมอ ไม่ว่าจะสำเร็จหรือ exception
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)




# Entry point
if __name__ == "__main__":
    # debug=True: auto-reload เมื่อแก้โค้ด + แสดง error detail บน browser
    # host='0.0.0.0': รับ connection จากทุก IP (ไม่ใช่แค่ localhost)
    app.run(host="0.0.0.0", port=5000, debug=True)

