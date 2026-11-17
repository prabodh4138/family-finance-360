# Family Finance 360 - Production Runner Script
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Family Finance 360 - Production Runner           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Apply database migrations
Write-Host "`n[1/3] Ensuring database schema is up-to-date with Neon..." -ForegroundColor Yellow
Set-Location "$Root\backend"
& .\.venv\Scripts\python.exe -m alembic upgrade head

# 2. Build production frontend
Write-Host "`n[2/3] Building production frontend bundle..." -ForegroundColor Yellow
Set-Location "$Root\frontend"
npm run build

# 3. Start services
Write-Host "`n[3/3] Launching production servers..." -ForegroundColor Green
$BackendProc = Start-Process -FilePath "$Root\backend\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" -WorkingDirectory "$Root\backend" -PassThru
$FrontendProc = Start-Process -FilePath "npm" -ArgumentList "run preview -- --host 127.0.0.1 --port 5173" -WorkingDirectory "$Root\frontend" -PassThru

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  Application is ready for production use!" -ForegroundColor Green
Write-Host "  Web App:       http://localhost:5173" -ForegroundColor White
Write-Host "  API Service:   http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:      http://localhost:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Backend Process ID:  $($BackendProc.Id)" -ForegroundColor Gray
Write-Host "Frontend Process ID: $($FrontendProc.Id)" -ForegroundColor Gray
