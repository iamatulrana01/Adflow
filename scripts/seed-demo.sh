#!/bin/sh
API="${API_URL:-http://localhost:3001}"

curl -s -X POST "$API/api/campaigns/ingest/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "campaigns": [
      {"name":"Enterprise Q4 Launch","budget":80000,"channel":"display","description":"enterprise brand"},
      {"name":"Cart Abandon Retarget","budget":4000,"channel":"social","description":"retarget cart abandon"},
      {"name":"Performance Social","budget":12000,"channel":"social","description":"standard performance"},
      {"name":"Pilot Test","budget":600,"channel":"search","description":"pilot test"}
    ]
  }' | python -m json.tool 2>/dev/null || cat

echo "\nDone. Open http://localhost:5173"
