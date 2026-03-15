@echo off
cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=5000

where ngrok >nul 2>nul
if not %errorlevel%==0 (
    echo ngrok was not found in PATH
    echo Install ngrok and run: ngrok config add-authtoken ^<YOUR_TOKEN^>
    pause
    goto :eof
)

echo Starting ngrok tunnel for http://127.0.0.1:%PORT%
ngrok http %PORT%
