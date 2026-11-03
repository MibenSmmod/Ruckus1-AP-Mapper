#!/bin/bash
# Test Ruckus ONE API Authentication
# Usage: ./test-auth.sh <tenant_id> <client_id>
#
# The client secret is read from R1_CLIENT_SECRET or a hidden prompt, and is
# sent to curl on stdin — never as a command-line argument, so it stays out of
# shell history and the process list.

TENANT_ID="$1"
CLIENT_ID="$2"

if [ -z "$TENANT_ID" ] || [ -z "$CLIENT_ID" ]; then
    echo "Usage: ./test-auth.sh <tenant_id> <client_id>"
    echo "Client secret: set R1_CLIENT_SECRET or enter it at the prompt."
    exit 1
fi

CLIENT_SECRET="${R1_CLIENT_SECRET:-}"
if [ -z "$CLIENT_SECRET" ]; then
    read -r -s -p "Client secret: " CLIENT_SECRET
    echo ""
fi
if [ -z "$CLIENT_SECRET" ]; then
    echo "No client secret provided."
    exit 1
fi

# URL-encode a value for the form body (bash-only, no external tools).
urlencode() {
    local s="$1" out="" c i
    for ((i = 0; i < ${#s}; i++)); do
        c="${s:i:1}"
        case "$c" in
            [a-zA-Z0-9.~_-]) out+="$c" ;;
            *) out+=$(printf '%%%02X' "'$c") ;;
        esac
    done
    printf '%s' "$out"
}

FORM_BODY="grant_type=client_credentials&client_id=$(urlencode "$CLIENT_ID")&client_secret=$(urlencode "$CLIENT_SECRET")"

echo "Testing authentication endpoints..."
echo ""

echo "=== Test 1: api.ruckus.cloud/oauth2/token/{tenantId} ==="
printf '%s' "$FORM_BODY" | curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "https://api.ruckus.cloud/oauth2/token/${TENANT_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  --data-binary @-
echo ""

echo "=== Test 2: ruckus.cloud/oauth2/token/{tenantId} ==="
printf '%s' "$FORM_BODY" | curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "https://ruckus.cloud/oauth2/token/${TENANT_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  --data-binary @-
echo ""

echo "Done."
