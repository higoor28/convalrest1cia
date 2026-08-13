@echo off
cd /d "%~dp0"
py -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo Instalando biblioteca necessaria...
    py -m pip install -r requirements.txt
)
py unir_documentos_pdf.py
pause
