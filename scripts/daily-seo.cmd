@echo off
REM Chay bai SEO hang ngay, khong can phien Claude nao dang mo.
REM Toan bo huong dan chi tiet nam trong .claude\commands\daily-seo.md (UTF-8),
REM nen prompt o day co tinh giu ASCII de khong vo vi codepage cua cmd.

chcp 65001 > nul
cd /d F:\Projects\Websites\news-site
if not exist logs mkdir logs

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set STAMP=%DT:~0,4%-%DT:~4,2%-%DT:~6,2%

echo. >> logs\daily-seo.log
echo ===== %STAMP% %DT:~8,2%:%DT:~10,2% ===== >> logs\daily-seo.log

claude -p "Follow the workflow in .claude/commands/daily-seo.md exactly, end to end. Do not ask the user any questions - this is an unattended scheduled run." >> logs\daily-seo.log 2>&1

echo exit=%ERRORLEVEL% >> logs\daily-seo.log
