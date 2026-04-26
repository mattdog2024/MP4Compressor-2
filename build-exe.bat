@echo off
cd /d "%~dp0"
echo Building EXE, please wait 3-5 minutes...
node_modules\.bin\electron-builder --win portable
echo Done! Check the dist folder.
pause
