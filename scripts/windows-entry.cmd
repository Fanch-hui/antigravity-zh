@echo off
setlocal
chcp 65001 >nul
set "AGY_ZH_WORK_DIR=D:\agy-zh-win64"
if not exist "%AGY_ZH_WORK_DIR%\tmp" mkdir "%AGY_ZH_WORK_DIR%\tmp"
if not exist "%AGY_ZH_WORK_DIR%\cache" mkdir "%AGY_ZH_WORK_DIR%\cache"
set "TEMP=%AGY_ZH_WORK_DIR%\tmp"
set "TMP=%TEMP%"
set "NODE_COMPILE_CACHE=%AGY_ZH_WORK_DIR%\cache\node"
set "NPM_CONFIG_CACHE=%AGY_ZH_WORK_DIR%\cache\npm"
set "PSModuleAnalysisCachePath=%AGY_ZH_WORK_DIR%\cache\powershell-analysis"
cd /d "%~dp0.."
node bin\agy-zh.mjs %* --work-dir "%AGY_ZH_WORK_DIR%"
set "AGY_ZH_EXIT=%ERRORLEVEL%"
pause
exit /b %AGY_ZH_EXIT%
