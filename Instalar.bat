@echo off
title Campo Branco - Instalador
color 0F
cls

echo ========================================
echo   INICIANDO INSTALADOR DO CAMPO BRANCO
echo ========================================
echo.

:: 1. Verificar Node.js
echo [1/3] Verificando ferramentas...
node -v >nul 2>&1
if %errorlevel% neq 0 goto ERROR_NODE

:: 2. Instalar Dependencias
if exist node_modules goto SKIP_INSTALL
echo [2/3] Instalando dependencias (Isso pode demorar um pouco)...
call npm install
if %errorlevel% neq 0 goto ERROR_INSTALL
echo Dependencias instaladas com sucesso.
goto START_WIZARD

:SKIP_INSTALL
echo [2/3] Dependencias ja instaladas. Pulasndo...

:START_WIZARD
:: 3. Iniciar Script de Deploy
echo.
echo [3/3] Iniciando assistente de configuracao...
echo.
node scripts/deploy.js
if %errorlevel% neq 0 goto ERROR_SCRIPT

goto END

:ERROR_NODE
echo.
echo [ERRO CRITICO] O Node.js nao foi encontrado no seu computador.
echo Para usar este instalador, voce precisa baixar e instalar o Node.js:
echo Link: https://nodejs.org/
echo.
echo Apos instalar, feche esta janela e tente novamente.
pause
exit

:ERROR_INSTALL
echo.
echo [ERRO] Falha ao instalar as dependencias do projeto.
echo Verifique sua conexao com a internet e tente novamente.
pause
exit

:ERROR_SCRIPT
echo.
echo [ERRO] O assistente de instalacao encontrou um problema e precisou fechar.
echo Leia as mensagens acima para identificar o erro.
pause
exit

:END
echo.
echo Instalador finalizado.
pause
