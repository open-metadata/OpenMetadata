#!/bin/bash

# Get admin JWT token
echo "Getting admin JWT token..."
JWT_TOKEN=$(curl -s -X POST http://localhost:8585/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@openmetadata.org", "password": "admin"}' | jq -r '.accessToken')

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "null" ]; then
  echo "Failed to get JWT token. Make sure OpenMetadata is running and admin credentials are correct."
  exit 1
fi

echo "Got JWT token: ${JWT_TOKEN:0:50}..."

# Calculate expires_at (current timestamp + 599 seconds)
EXPIRES_AT=$(($(date +%s) + 599))

echo "Creating Snowflake service with OAuth..."

curl -X POST http://localhost:8585/api/v1/services/databaseServices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"name\": \"test-snowflake-mcp\",
    \"serviceType\": \"Snowflake\",
    \"connection\": {
      \"config\": {
        \"type\": \"Snowflake\",
        \"account\": \"FMFAHQK-GI58232\",
        \"warehouse\": \"COMPUTE_WH\",
        \"database\": \"CUSTOMERS\",
        \"authType\": {
          \"clientId\": \"7ln6la3T0vzF4Nh0ttFw+1ULjkU=\",
          \"clientSecret\": \"2lduQWNOg4UKPiUVQXowVmxd5aS7rp/esu4GNcRCqcM=\",
          \"accessToken\": \"ver:1-hint:754067412131846-ETMsDgAAAZtnMmkQABRBRVMvQ0JDL1BLQ1M1UGFkZGluZwEAABAAEC2AY/z63M3n8e4VBmxx9B0AAACwvUccsE/bCyOpExmSMBIzZMkZOFC+SPLec56vdnHhr5aTbsPh6cVba5iGaqETkT8TSox1Mz27hAPQ5uxBSka46P3h3NRUmMfQCXxf6reLUYbCp0Y0ia5W3FUAfRxfqNqixAoB3sxs+3p/yB5knrTr8tPaDKOP9CnYlGqWHe+F1fesCj5DOWOt/yyhz8t9UYsboteOdH8j5LaYMcQkQAWkPYzWnKkzEx2vteIMysSQsBkAFNHOqm972OqYX5gOGjeVpmhXJEu/\",
          \"refreshToken\": \"ver:2-hint:11506176005-did:1011-ETMsDgAAAZtnMmkQABRBRVMvQ0JDL1BLQ1M1UGFkZGluZwEAABAAEOkBTh036dAR83adHmqbPCwAAAFgZgrd/cSx6SfBdYGoLm15d030QlbvrTLdgEyUxoRy1O88xkVI+tOQOGwpO6NwEDQT4GIv/x8ia/2eJ0BfvhdB7IuL0vdTSdtkXTz+WmkdmeLv4ILl2g0zbDYeWqe8MEMikIhF8zv5wyQ9FRH8mIm6xfloF6q10S5T2tLNwisBy55jcCx4SftfZok2XcSnw2W6RDUck3FssF0FOKj85tMJQXcl5jn5WZLRiwzjHJpuSAjA3wLRm/zg8WESE/aLxPDw8AWy8JfJEtVURRAiNgtTpHWrtEa9n24bqg5p8If+MPT7TogB6EFjtqIKQehGmUYZ66nmj7XlVeSKiUF/kL1TVjW3BqusodVcg08IIzOtV5s6Zyf0GBJZ+QD2lzW8TIw9A5uofUeey+r6kG6+RhO+2hWVADWuIBcjSgJjbh2ESWC0tKsiB6pAy8MV7tvTwlCMtdqV1zWXstmsMQgxoTSudgAUq5KLNZUaXJ5Bh/dLkHTSzbyANI0=\",
          \"tokenEndpoint\": \"https://FMFAHQK-GI58232.snowflakecomputing.com/oauth/token-request\",
          \"expiresAt\": $EXPIRES_AT
        }
      }
    }
  }" | jq .

echo ""
echo "✅ Snowflake service created! Now test with MCP Inspector:"
echo "   npx @modelcontextprotocol/inspector http://localhost:8585/mcp"
