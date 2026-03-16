# Quick Start

หลังเปิดคอมใหม่ ให้รันโปรเจกต์ตามนี้

## Local App

ถ้าใช้ WSL หรือ bash:

```bash
cd /mnt/c/Users/com/Documents/AIE223/object-detection-poker2
python app.py
```

ถ้าใช้ Windows:

- เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วรัน `python app.py`

แอปจะขึ้นที่ `http://127.0.0.1:5000`

## ngrok

เปิด local app ไว้ก่อน แล้วค่อยเปิดอีกหน้าต่างหนึ่งมารัน:

```bash
cd /mnt/c/Users/com/Documents/AIE223/object-detection-poker2
./start-ngrok.sh
```

หรือบน Windows:

- ดับเบิลคลิก `start-ngrok.bat`

แล้วใช้ URL `https://...ngrok-free.app` ที่ ngrok แสดง

## Notes

- ⚠️ **อย่าลืม**: ต้องวาง `best.pt` ในโฟลเดอร์โปรเจกต์ก่อนรัน app ถ้าไม่มี จะ error
- ถ้าหน้าเว็บไม่อัปเดต ให้กด `Ctrl+Shift+R` (Ctrl+R for Mac)
- ถ้าจะใช้กล้อง (webcam) ต้องเปิดผ่าน URL ของ ngrok ที่เป็น `https://...`
- ถ้า `ngrok` ยังไม่เคยตั้งค่า ให้รัน: `ngrok config add-authtoken <YOUR_TOKEN>` ก่อน
