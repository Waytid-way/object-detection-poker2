@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    echo Starting Flask app at http://127.0.0.1:5000
    py -3 app.py
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo Starting Flask app at http://127.0.0.1:5000
    python app.py
    goto :eof
)

echo Python was not found in PATH
pause
