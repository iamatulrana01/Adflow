# Start AdFlow locally (requires MongoDB on localhost:27017)
# Run ai-classifier separately: cd services/ai-classifier && uvicorn app.main:app --reload

$env:MONGODB_URI = "mongodb://localhost:27017/adflow"
$env:AI_CLASSIFIER_URL = "http://localhost:8000"
$env:MONITORING_URL = "http://localhost:3002"
$env:USE_MOCK_LLM = "true"

Write-Host "Starting campaign-api on :3001..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\services\campaign-api'; npm start"

Start-Sleep -Seconds 2

Write-Host "Starting monitoring-service on :3002..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\services\monitoring-service'; npm start"

Start-Sleep -Seconds 2

Write-Host "Starting frontend on :5173..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend'; npm run dev"

Write-Host ""
Write-Host "AdFlow local stack starting. Also run:"
Write-Host "  cd services/ai-classifier"
Write-Host "  uvicorn app.main:app --reload --port 8000"
Write-Host ""
Write-Host "Dashboard: http://localhost:5173"
