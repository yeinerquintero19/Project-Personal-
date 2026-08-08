# =============================================================
# MerPrest - Script de setup e instalación (Windows / PowerShell)
# Uso: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# =============================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Step($msg)  { Write-Host "==> $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "!! $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Test-Cmd([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Step "Verificando herramientas instaladas..."
if (-not (Test-Cmd docker)) { Fail "Docker no está instalado. https://www.docker.com/products/docker-desktop/" }
if (-not (Test-Cmd cargo))  { Fail "Rust no está instalado. https://rustup.rs" }
if (-not (Test-Cmd python)) { Fail "Python 3 no está instalado. https://www.python.org/downloads/" }
if (-not (Test-Cmd node))   { Fail "Node.js no está instalado. https://nodejs.org" }
Step "Todo listo: Docker, Rust, Python, Node OK"

Step "1/4 Levantando PostgreSQL con Docker..."
docker compose -f (Join-Path $Root "docker-compose.yml") up -d
Start-Sleep -Seconds 5

Step "2/4 Configurando backend Rust..."
$rustEnv = Join-Path $Root "backend-rust\.env"
if (-not (Test-Path $rustEnv)) {
  Copy-Item (Join-Path $Root "backend-rust\.env.example") $rustEnv
  Warn "Creado backend-rust\.env con valores por defecto"
}
Push-Location (Join-Path $Root "backend-rust")
try { cargo build }
catch { Warn "cargo build falló (revisa la instalación de Rust)" }
Pop-Location

Step "3/4 Configurando backend Python..."
$pyEnv = Join-Path $Root "backend-python\.env"
if (-not (Test-Path $pyEnv)) {
  Copy-Item (Join-Path $Root "backend-python\.env.example") $pyEnv
  Warn "Creado backend-python\.env con valores por defecto"
}
$venv = Join-Path $Root "backend-python\.venv"
if (-not (Test-Path $venv)) { python -m venv $venv }
& (Join-Path $venv "Scripts\pip.exe") install -r (Join-Path $Root "backend-python\requirements.txt")

Step "4/4 Instalando frontend..."
Push-Location (Join-Path $Root "frontend")
try { npm install } catch { Warn "npm install falló" }
Pop-Location

Write-Host ""
Step "¡Setup completado!"
Write-Host "  API Rust   : cd backend-rust; cargo run          -> http://localhost:8080"
Write-Host "  API Python : backend-python\.venv\Scripts\uvicorn app.main:app --port 8000"
Write-Host "  Frontend   : cd frontend; npm run dev            -> http://localhost:5173"
