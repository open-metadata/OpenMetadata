#!/bin/bash
# OpenMetadata Custom Properties API Examples
# This script demonstrates how to create and manage custom metadata fields

set -e  # Exit on any error

# Configuration
export OM_HOST="http://localhost:8585"
export OM_USER="admin@openmetadata.org"
export OM_PASS="admin"

# Function to get JWT token
get_jwt_token() {
    echo "Getting JWT token..."
    JWT_RESPONSE=$(curl -s -X POST "${OM_HOST}/api/v1/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"${OM_USER}\", \"password\": \"${OM_PASS}\"}")
    
    JWT_TOKEN=$(echo "$JWT_RESPONSE" | jq -r '.accessToken')
    
    if [[ "$JWT_TOKEN" == "null" ]] || [[ -z "$JWT_TOKEN" ]]; then
        echo "Error: Failed to get JWT token"
        echo "Response: $JWT_RESPONSE"
        exit 1
    fi
    
    echo "JWT Token obtained successfully"
    export JWT_TOKEN
}

# Function to create custom properties
create_custom_properties() {
    echo "Creating custom properties..."
    
    # 1. Business Criticality (String)
    echo "Creating Business Criticality property..."
    curl -s -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "businessCriticality",
            "displayName": "Business Criticality",
            "description": "Indicates how critical this data asset is to business operations",
            "propertyType": {
                "name": "string"
            },
            "entityTypeIds": ["table", "dashboard", "pipeline"]
        }' > /dev/null && echo "✓ Business Criticality property created"

    # 2. Data Classification (Enum)
    echo "Creating Data Classification property..."
    curl -s -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "dataClassification",
            "displayName": "Data Classification",
            "description": "Security classification level of the data",
            "propertyType": {
                "name": "enum",
                "enumConfig": {
                    "values": ["Public", "Internal", "Confidential", "Restricted"]
                }
            },
            "entityTypeIds": ["table", "database", "databaseSchema"]
        }' > /dev/null && echo "✓ Data Classification property created"

    # 3. Contains PII (Boolean)
    echo "Creating Contains PII property..."
    curl -s -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "containsPII",
            "displayName": "Contains PII",
            "description": "Indicates whether this asset contains Personally Identifiable Information",
            "propertyType": {
                "name": "boolean"
            },
            "entityTypeIds": ["table", "column"]
        }' > /dev/null && echo "✓ Contains PII property created"

    # 4. Data Retention Until (Date)
    echo "Creating Data Retention property..."
    curl -s -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "dataRetentionUntil",
            "displayName": "Data Retention Until",
            "description": "Date until which this data must be retained for compliance",
            "propertyType": {
                "name": "date"
            },
            "entityTypeIds": ["table", "database"]
        }' > /dev/null && echo "✓ Data Retention property created"
}

# Function to list custom properties
list_custom_properties() {
    echo "Listing all custom properties..."
    curl -s -X GET "${OM_HOST}/api/v1/metadata/customProperties" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" | \
        jq -r '.data[] | "- \(.name): \(.displayName) (\(.propertyType.name))"'
}

# Function to add custom properties to a table
add_properties_to_table() {
    local table_fqn="$1"
    
    echo "Finding table: $table_fqn"
    TABLE_ID=$(curl -s -X GET "${OM_HOST}/api/v1/tables/name/${table_fqn}" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.id')
    
    if [[ "$TABLE_ID" == "null" ]] || [[ -z "$TABLE_ID" ]]; then
        echo "Warning: Table $table_fqn not found, skipping..."
        return
    fi
    
    echo "Adding custom properties to table: $table_fqn"
    curl -s -X PATCH "${OM_HOST}/api/v1/tables/${TABLE_ID}" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json-patch+json" \
        -d '[{
            "op": "add",
            "path": "/customProperties",
            "value": [
                {"name": "businessCriticality", "value": "High"},
                {"name": "dataClassification", "value": "Confidential"},
                {"name": "containsPII", "value": true},
                {"name": "dataRetentionUntil", "value": "2030-12-31"}
            ]
        }]' > /dev/null && echo "✓ Custom properties added to $table_fqn"
}

# Function to search tables by custom properties
search_by_custom_properties() {
    echo "Searching tables with high business criticality..."
    curl -s -X GET "${OM_HOST}/api/v1/search/query?q=customProperties.businessCriticality:High&index=table" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" | \
        jq -r '.hits.hits[]._source | "- \(.fullyQualifiedName): \(.customProperties // [])"'
}

# Main execution
main() {
    echo "=== OpenMetadata Custom Properties Demo ==="
    echo
    
    get_jwt_token
    echo
    
    create_custom_properties
    echo
    
    echo "=== Custom Properties Created ==="
    list_custom_properties
    echo
    
    # Example table FQNs - adjust these to match your actual tables
    echo "=== Adding Properties to Example Tables ==="
    add_properties_to_table "mysql_production.ecommerce.users"
    add_properties_to_table "mysql_production.ecommerce.orders"
    echo
    
    echo "=== Search Results ==="
    search_by_custom_properties
    echo
    
    echo "Demo completed successfully!"
    echo "You can now view these custom properties in the OpenMetadata UI."
}

# Run the demo
main