#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
#
# Setup script for owner configuration test entities
# Creates all required users and teams in OpenMetadata
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${OPENMETADATA_URL:-http://localhost:8585/api/v1}"
JWT_TOKEN="${OPENMETADATA_JWT_TOKEN:-}"

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}❌ Error: JWT token not provided${NC}"
    echo ""
    echo "Please set OPENMETADATA_JWT_TOKEN environment variable:"
    echo "  export OPENMETADATA_JWT_TOKEN='your_token_here'"
    echo ""
    echo "Or pass it as an argument:"
    echo "  $0 <jwt_token>"
    echo ""
    exit 1
fi

# Use argument if provided
if [ ! -z "$1" ]; then
    JWT_TOKEN="$1"
fi

echo "=========================================="
echo "OpenMetadata Test Entity Setup"
echo "=========================================="
echo "API URL: $API_URL"
echo "JWT Token: ${JWT_TOKEN:0:20}..."
echo ""

# Function to create user
create_user() {
    local username="$1"
    local email="${username}@example.com"
    local display_name="$(echo ${username:0:1} | tr '[:lower:]' '[:upper:]')${username:1}"
    
    echo -n "Creating user: $username ... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/users" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${username}\",
            \"email\": \"${email}\",
            \"displayName\": \"${display_name}\",
            \"description\": \"Test user for owner configuration tests\"
        }")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
        return 0
    elif [ "$http_code" = "409" ]; then
        echo -e "${YELLOW}⚠ Already exists${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "$response" | head -n-1 | jq -r '.message // .detail // .' 2>/dev/null || echo "$response"
        return 1
    fi
}

# Function to create team
create_team() {
    local team_name="$1"
    local display_name="$2"
    local description="$3"
    
    echo -n "Creating team: $team_name ... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/teams" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${team_name}\",
            \"displayName\": \"${display_name}\",
            \"description\": \"${description}\",
            \"teamType\": \"Group\"
        }")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
        return 0
    elif [ "$http_code" = "409" ]; then
        echo -e "${YELLOW}⚠ Already exists${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "$response" | head -n-1 | jq -r '.message // .detail // .' 2>/dev/null || echo "$response"
        return 1
    fi
}

# Create users
echo "Creating test users..."
echo "----------------------------------------"

users=(
    "alice"
    "bob"
    "charlie"
    "david"
    "emma"
    "frank"
    "marketing-user-1"
    "marketing-user-2"
)

user_success=0
user_total=${#users[@]}

for username in "${users[@]}"; do
    if create_user "$username"; then
        ((user_success++))
    fi
done

echo ""
echo "Users: $user_success/$user_total created/verified"
echo ""

# Create teams
echo "Creating test teams..."
echo "----------------------------------------"

# Team data: name|display_name|description
teams=(
    "data-platform-team|Data Platform|Manages data platform infrastructure"
    "finance-team|Finance|Finance department team"
    "marketing-team|Marketing|Marketing department team"
    "accounting-team|Accounting|Accounting team within finance"
    "treasury-team|Treasury|Treasury team within finance"
    "expense-team|Expense|Expense management team"
    "revenue-team|Revenue|Revenue management team"
    "investment-team|Investment|Investment management team"
    "treasury-ops-team|Treasury Operations|Treasury operations team"
    "audit-team|Audit|Audit and compliance team"
    "compliance-team|Compliance|Compliance team"
)

team_success=0
team_total=${#teams[@]}

for team_data in "${teams[@]}"; do
    IFS='|' read -r team_name display_name description <<< "$team_data"
    if create_team "$team_name" "$display_name" "$description"; then
        ((team_success++))
    fi
done

echo ""
echo "Teams: $team_success/$team_total created/verified"
echo ""

# Summary
echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo -e "Users:  ${GREEN}${user_success}${NC}/${user_total}"
echo -e "Teams:  ${GREEN}${team_success}${NC}/${team_total}"

if [ $user_success -eq $user_total ] && [ $team_success -eq $team_total ]; then
    echo ""
    echo -e "${GREEN}✅ All entities created successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Update JWT tokens in test YAML files"
    echo "  2. Run tests: cd /workspace/ingestion && metadata ingest -c tests/unit/metadata/ingestion/owner_config_tests/test-05-inheritance-enabled.yaml"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠ Some entities failed to create. Check errors above.${NC}"
    exit 1
fi
