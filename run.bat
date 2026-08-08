@echo off
cd /d %~dp0
echo Instalando dependencias (primera vez)...
python -m pip install -r requirements.txt --quiet
echo Iniciando MerPrest en http://127.0.0.1:8000
python -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
