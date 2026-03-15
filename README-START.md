# Quick Start

หลังเปิดคอมใหม่ ให้รันโปรเจกต์ตามนี้

## Local App

ถ้าใช้ WSL หรือ bash:

```bash
cd /mnt/c/Users/com/Documents/AIE223/object-detection-poker2
./start-local.sh
```

ถ้าใช้ Windows:

- ดับเบิลคลิก `start-local.bat`

แอปจะขึ้นที่ `http://127.0.0.1:5000`

## ngrok

เปิดอีกหน้าต่างหนึ่งแล้วรัน:

```bash
cd /mnt/c/Users/com/Documents/AIE223/object-detection-poker2
./start-ngrok.sh
```

หรือบน Windows:

- ดับเบิลคลิก `start-ngrok.bat`

แล้วใช้ URL `https://...ngrok-free.app` ที่ ngrok แสดง

## Notes

- ถ้าหน้าเว็บไม่อัปเดต ให้กด `Ctrl+Shift+R`
- ถ้าจะใช้กล้อง ให้เปิดผ่าน URL ของ ngrok ที่เป็น `https`
- ถ้า `ngrok` ยังไม่เคยตั้งค่า ให้รัน `ngrok config add-authtoken <YOUR_TOKEN>` ก่อน
