@echo off
title GourmetOS Restaurant System
color 0A

echo ===================================================
echo       GourmetOS Restaurant Management System
echo ===================================================
echo.
echo Starting Server on port 4001...
echo.

cd /d "%~dp0\server"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Run compiled production server (No Python or Build Tools required)
node dist/server.js

if %errorlevel% neq 0 (
    echo.
    echo Server stopped with error.
    pause
)
