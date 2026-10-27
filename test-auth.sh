#!/bin/bash
# Test Ruckus ONE API Authentication
# Usage: ./test-auth.sh <client_id> <client_secret>

CLIENT_ID="$1"
CLIENT_SECRET="$2"
TENANT_ID="<REDACTED>"

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "Usage: ./test-auth.sh <client_id> <client_secret>"
    exit 1
fi

echo "Testing authentication endpoints..."
echo ""

echo "=== Test 1: api.ruckus.cloud/oauth2/token/{tenantId} ==="
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "https://api.ruckus.cloud/oauth2/token/${TENANT_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  -d "grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}"
echo ""

echo "=== Test 2: ruckus.cloud/oauth2/token/{tenantId} ==="
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "https://ruckus.cloud/oauth2/token/${TENANT_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  -d "grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}"
echo ""

echo "=== Test 3: api.ruckus.cloud/token (username/password style) ==="
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "https://api.ruckus.cloud/token" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${CLIENT_ID}\",\"password\":\"${CLIENT_SECRET}\"}"
echo ""

echo "Done."
