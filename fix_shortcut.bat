@echo off
echo ============================================
echo  Reparar acceso directo de IngenIA
echo ============================================
echo.
echo Este script crea/repara el acceso directo en el Escritorio.
echo Debe ejecutarse desde la carpeta de instalacion de IngenIA.
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0fix_shortcut.ps1"