@echo off
title Campo Branco - Instalador
cls
echo ========================================
echo   INICIANDO INSTALADOR DO CAMPO BRANCO
echo ========================================
echo.
echo Verificando ferramentas necessarias...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit
)

if not exist node_modules (
    echo Instalando dependencias do projeto (Isso acontece apenas na primeira vez)...
    call npm install
)

echo.
echo Iniciando assistente...
node scripts/deploy.js

pause
