@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo    HARVEY - Local AI Gift Hub Setup (Windows)
echo    Helpful Assistant Ready to Virtually Excel You
echo ============================================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Running without admin rights. Some features may not work.
    echo [INFO] For best results, right-click and "Run as administrator"
    echo.
    pause
)

:: Get the directory where the script is located
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
cd /d "%PROJECT_DIR%"

echo [1/6] Checking system requirements...
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Node.js not found. Installing via winget...
    winget install OpenJS.NodeJS.LTS -e --silent
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to install Node.js automatically.
        echo [INFO] Please install Node.js manually from: https://nodejs.org/
        pause
        exit /b 1
    )
    :: Refresh PATH
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
) else (
    for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js found: %%i
)

echo.
echo [2/6] Checking for Ollama...
echo.

:: Check if Ollama is installed
where ollama >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Ollama not found. Downloading and installing...

    :: Download Ollama installer
    curl -L -o "%TEMP%\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to download Ollama.
        echo [INFO] Please install manually from: https://ollama.com/download
        pause
        exit /b 1
    )

    :: Run Ollama installer
    echo [INFO] Running Ollama installer...
    "%TEMP%\OllamaSetup.exe" /VERYSILENT /NORESTART

    :: Wait for installation to complete
    timeout /t 10 /nobreak >nul

    :: Add Ollama to PATH
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
) else (
    echo [OK] Ollama is already installed
)

echo.
echo [3/6] Starting Ollama service...
echo.

:: Start Ollama in the background
start "" /B ollama serve >nul 2>&1
timeout /t 5 /nobreak >nul
echo [OK] Ollama service started

echo.
echo [4/6] Downloading Gemma 27B model (this may take a while ~16GB)...
echo.

:: Pull the Gemma 27B model
ollama pull gemma2:27b
if %errorLevel% neq 0 (
    echo [WARNING] Failed to pull gemma2:27b, trying alternative...
    ollama pull gemma:27b
)

echo.
echo [5/6] Installing Node.js dependencies...
echo.

:: Install npm dependencies
call npm install
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [6/6] Starting Harvey server...
echo.

:: Create startup script
echo @echo off > "%PROJECT_DIR%\start-harvey.bat"
echo cd /d "%PROJECT_DIR%" >> "%PROJECT_DIR%\start-harvey.bat"
echo start "" /B ollama serve >> "%PROJECT_DIR%\start-harvey.bat"
echo timeout /t 3 /nobreak ^>nul >> "%PROJECT_DIR%\start-harvey.bat"
echo node server/index.js >> "%PROJECT_DIR%\start-harvey.bat"

echo [OK] Created start-harvey.bat for future use

:: Start the server
start "" http://localhost:3847
node server/index.js

pause
