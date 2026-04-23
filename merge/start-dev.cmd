@echo off
setlocal

cd /d "%~dp0"

echo Starting backend...
start "SmartMedic Backend" cmd /k "cd backend && npm.cmd install && npm.cmd run dev"

echo Starting frontend...
start "SmartMedic Frontend" cmd /k "cd frontend_new && npm.cmd install && npm.cmd run dev -- --host"

echo.
echo Backend and frontend terminals launched.
echo Close the opened terminals to stop the servers.
