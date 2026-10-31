@echo off
setlocal
chcp 65001 >nul
set "PORT="
for /f "tokens=2 delims==" %%p in ('node "%~dp0..\01MAIN\ACTIVE\SERVER\launch.mjs"') do set "PORT=%%p"
if not defined PORT exit /b 1
echo คอนโซลเปิดแล้ว (พอร์ต %PORT%) ปิดหน้าต่างนี้ได้
exit /b
