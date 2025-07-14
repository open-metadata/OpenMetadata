#!/bin/bash
# Example script to import ODCS contracts into OpenMetadata

# Configuration
OPENMETADATA_URL="http://localhost:8585"
API_BASE="${OPENMETADATA_URL}/api/v1"
AUTH_TOKEN="<your-auth-token>"

# Table ID where the contract will be attached
TABLE_ID="<your-table-uuid>"

# Import a simple ODCS contract
echo "Importing ODCS contract..."
curl -X POST "${API_BASE}/datacontracts/import/odcs?entityId=${TABLE_ID}&format=yaml" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/yaml" \
  -d @simple-contract.yaml

# Import with JSON format
echo -e "\n\nImporting JSON format contract..."
curl -X POST "${API_BASE}/datacontracts/import/odcs?entityId=${TABLE_ID}&format=json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @simple-contract.json

# Import comprehensive contract
echo -e "\n\nImporting comprehensive contract..."
curl -X POST "${API_BASE}/datacontracts/import/odcs?entityId=${TABLE_ID}&format=yaml" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/yaml" \
  -d @customer-orders-contract.yaml

# Example response:
# {
#   "contract": {
#     "id": "...",
#     "name": "Customer Orders Contract",
#     "status": "Active",
#     "entity": { ... },
#     "schema": [ ... ],
#     "qualityExpectations": [ ... ],
#     "sla": { ... }
#   },
#   "importReport": {
#     "odcsVersion": "v3.0.2",
#     "mappedFields": ["name", "status", "schema", "quality", "slaProperties", "team"],
#     "skippedFields": ["servers", "pricing", "stakeholders"],
#     "warnings": ["Servers field ignored - using entityId reference"]
#   }
# }