# =============================================================
# MerPrest - Script de desarrollo (Windows / PowerShell)
# Levanta los 3 servicios en ventanas separadas.
# =============================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "==> Asegurando PostgreSQL..." -ForegroundColor Green
docker compose -f (Join-Path $Root "docker-compose.yml") up -d

Write-Host "==> Abriendo 3 terminales para los servicios..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend-rust'; cargo run"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend-python'; .\.venv\Scripts\uvicorn app.main:app --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend'; npm run dev"

Write-Host "Servicios lanzados:" -ForegroundColor Yellow
Write-Host "  API Rust   -> http://localhost:8080"
Write-Host "  API Python -> http://localhost:8000"
Write-Host "  Frontend   -> http://localhost:5173"
