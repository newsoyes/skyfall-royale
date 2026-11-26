@echo off
chcp 65001 >nul
title Skyfall Royale - Dev Launcher (NEWSOYES)
cd /d "%~dp0"
echo ==================================================
echo   🪂 Skyfall Royale — 3D Battle Royale Launcher
echo ==================================================
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ Node.js ในเครื่อง! กรุณาดาวน์โหลดที่ https://nodejs.org/
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo กำลังติดตั้งแพ็กเกจทั้งหมดครั้งแรก (อาจใช้เวลา 1-2 นาที)...
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo [ERROR] ติดตั้งแพ็กเกจไม่สำเร็จ
        pause
        exit /b 1
    )
)
echo กำลังเปิดเซิร์ฟเวอร์เกม (พอร์ต 3333) และเว็บเกม (พอร์ต 5173)...
start "" "http://localhost:5173"
call npm.cmd run dev
pause
