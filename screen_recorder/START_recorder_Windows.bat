@echo off
REM ====================================================
REM  Hotkey Screen Recorder - Windows launcher
REM  Palaiž recorder.py ar administratora tiesibam
REM  (vajadzigs, lai globalie hotkey stradatu)
REM ====================================================

REM Parbauda admin tiesibas; ja nav - parstarte ka admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Parstartēju ka administrators...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

REM Instale atkaribas ja vajag
python -m pip install -r requirements.txt

REM Palaiž rakstitaju
python recorder.py
pause
