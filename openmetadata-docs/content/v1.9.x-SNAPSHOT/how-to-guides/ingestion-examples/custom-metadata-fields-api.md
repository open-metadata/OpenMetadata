---
title: Test Case 2 - Custom Metadata Fields via API Tutorial
description: Step-by-step guide for creating and managing custom metadata fields using OpenMetadata API with authentication examples and entity attachment.
slug: /how-to-guides/ingestion-examples/custom-metadata-fields-api
---

# Test Case 2: Creating Custom Metadata Fields via API

This tutorial provides a comprehensive guide for creating and managing custom metadata fields using the OpenMetadata API. You'll learn how to authenticate, create custom fields, attach them to entities, and manage their values through practical examples.

## Prerequisites

### Required Tools
- `curl` command-line tool or equivalent HTTP client
- `jq` for JSON processing (optional but recommended)
- Valid OpenMetadata instance running

### Required Permissions
Your user account needs:
- `Create` permission for Custom Properties
- `Edit` permission for the entities you want to modify
- API access enabled

## Step 1: Authentication Process

### Method 1: JWT Token Authentication

#### Get JWT Token from UI
1. Login to OpenMetadata UI
2. Navigate to **Settings** → **Integrations** → **Bots**
3. Create or select an existing bot (e.g., "api-bot")
4. Copy the JWT token from the bot details

#### Get JWT Token via API
```bash
# Login and get access token
export OM_HOST="http://localhost:8585"

# For basic auth login
curl -X POST "${OM_HOST}/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@openmetadata.org",
    "password": "admin"
  }' > auth_response.json

# Extract token
export JWT_TOKEN=$(jq -r '.accessToken' auth_response.json)

# Verify token
echo "JWT Token: ${JWT_TOKEN:0:50}..."
```

#### Test Authentication
```bash
# Test API access
curl -X GET "${OM_HOST}/api/v1/users/me" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

### Method 2: Basic Authentication (if enabled)
```bash
# Set basic auth credentials
export OM_USER="admin@openmetadata.org"
export OM_PASS="admin"

# Test basic auth
curl -X GET "${OM_HOST}/api/v1/users/me" \
  -u "${OM_USER}:${OM_PASS}" \
  -H "Content-Type: application/json"
```

## Step 2: Understanding Custom Property Types

### Available Property Types
```bash
# Get available custom property types
curl -X GET "${OM_HOST}/api/v1/metadata/types/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.[].name'
```

### Common Property Types:
- **string**: Text values
- **integer**: Whole numbers
- **number**: Decimal numbers
- **boolean**: True/false values
- **date**: Date values
- **dateTime**: Date and time values
- **email**: Email addresses
- **enum**: Predefined list of values
- **markdown**: Rich text with markdown support

## Step 3: Create Custom Metadata Fields

### Example 1: Create a String Property
```bash
# Create a business criticality field
curl -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "businessCriticality",
    "displayName": "Business Criticality",
    "description": "Indicates how critical this data asset is to business operations",
    "propertyType": {
      "name": "string"
    },
    "entityTypeIds": [
      "table",
      "dashboard",
      "pipeline"
    ]
  }' | jq
```

### Example 2: Create an Enum Property
```bash
# Create a data classification field
curl -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
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
    "entityTypeIds": [
      "table",
      "database",
      "databaseSchema"
    ]
  }' | jq
```

### Example 3: Create a Boolean Property
```bash
# Create a PII indicator field
curl -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "containsPII",
    "displayName": "Contains PII",
    "description": "Indicates whether this asset contains Personally Identifiable Information",
    "propertyType": {
      "name": "boolean"
    },
    "entityTypeIds": [
      "table",
      "column"
    ]
  }' | jq
```

### Example 4: Create a Date Property
```bash
# Create a data retention field
curl -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dataRetentionUntil",
    "displayName": "Data Retention Until",
    "description": "Date until which this data must be retained for compliance",
    "propertyType": {
      "name": "date"
    },
    "entityTypeIds": [
      "table",
      "database"
    ]
  }' | jq
```

## Step 4: Verify Custom Property Creation

### List All Custom Properties
```bash
# Get all custom properties
curl -X GET "${OM_HOST}/api/v1/metadata/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.data[] | {name: .name, displayName: .displayName, type: .propertyType.name}'
```

### Get Specific Custom Property
```bash
# Get details of a specific custom property
curl -X GET "${OM_HOST}/api/v1/metadata/customProperties/name/businessCriticality" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq
```

## Step 5: Attach Custom Fields to Entities

### Find Entity ID
First, find the entity you want to modify:

```bash
# Find a table by name
export TABLE_FQN="mysql_production.ecommerce.users"
curl -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.id'

# Store the ID for later use
export TABLE_ID=$(curl -s -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.id')

echo "Table ID: ${TABLE_ID}"
```

### Add Custom Property Values to Table
```bash
# Update table with custom properties
curl -X PATCH "${OM_HOST}/api/v1/tables/${TABLE_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[
    {
      "op": "add",
      "path": "/customProperties",
      "value": [
        {
          "name": "businessCriticality",
          "value": "High"
        },
        {
          "name": "dataClassification",
          "value": "Confidential"
        },
        {
          "name": "containsPII",
          "value": true
        },
        {
          "name": "dataRetentionUntil",
          "value": "2030-12-31"
        }
      ]
    }
  ]' | jq
```

### Update Existing Custom Property Values
```bash
# Update specific custom property value
curl -X PATCH "${OM_HOST}/api/v1/tables/${TABLE_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[
    {
      "op": "replace",
      "path": "/customProperties/0/value",
      "value": "Critical"
    }
  ]' | jq
```

## Step 6: Working with Different Entity Types

### Add Custom Properties to Databases
```bash
# Find database
export DB_FQN="mysql_production.ecommerce"
export DB_ID=$(curl -s -X GET "${OM_HOST}/api/v1/databases/name/${DB_FQN}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.id')

# Add custom properties to database
curl -X PATCH "${OM_HOST}/api/v1/databases/${DB_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[
    {
      "op": "add",
      "path": "/customProperties",
      "value": [
        {
          "name": "dataClassification",
          "value": "Internal"
        }
      ]
    }
  ]' | jq
```

### Add Custom Properties to Columns
```bash
# Find column
export COLUMN_FQN="${TABLE_FQN}.email"
export COLUMN_ID=$(curl -s -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.columns[] | select(.name=="email") | .id')

# Note: For columns, custom properties are updated via the table entity
curl -X PATCH "${OM_HOST}/api/v1/tables/${TABLE_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[
    {
      "op": "add",
      "path": "/columns/0/customProperties",
      "value": [
        {
          "name": "containsPII",
          "value": true
        }
      ]
    }
  ]' | jq
```

## Step 7: Query and Search Custom Properties

### Search Entities by Custom Properties
```bash
# Search tables with specific custom property values
curl -X GET "${OM_HOST}/api/v1/search/query?q=customProperties.businessCriticality:High&index=table" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.hits.hits[]._source | {name: .name, customProperties}'
```

### Advanced Search with Multiple Custom Properties
```bash
# Search for high criticality tables with PII
curl -X GET "${OM_HOST}/api/v1/search/query" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"term": {"entityType": "table"}},
          {"term": {"customProperties.businessCriticality": "High"}},
          {"term": {"customProperties.containsPII": true}}
        ]
      }
    }
  }' | jq
```

## Step 8: Manage Custom Properties

### List Custom Properties for an Entity
```bash
# Get custom properties for a specific table
curl -X GET "${OM_HOST}/api/v1/tables/${TABLE_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.customProperties'
```

### Remove Custom Property Value
```bash
# Remove a specific custom property
curl -X PATCH "${OM_HOST}/api/v1/tables/${TABLE_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json-patch+json" \
  -d '[
    {
      "op": "remove",
      "path": "/customProperties/3"
    }
  ]' | jq
```

### Delete Custom Property Definition
```bash
# Delete a custom property definition (removes from all entities)
curl -X DELETE "${OM_HOST}/api/v1/metadata/customProperties/name/businessCriticality" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

## Common Error Scenarios & Solutions

### Error 1: Authentication Failed

#### Symptom
```json
{
  "code": 401,
  "message": "Unauthorized"
}
```

#### Solutions
```bash
# Check token validity
curl -X GET "${OM_HOST}/api/v1/users/me" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Regenerate token if expired
curl -X POST "${OM_HOST}/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@openmetadata.org", "password": "admin"}'
```

### Error 2: Permission Denied

#### Symptom
```json
{
  "code": 403,
  "message": "Principal: user:username is not allowed to create customProperty"
}
```

#### Solutions
Check user permissions in OpenMetadata UI:
1. Go to **Settings** → **Teams & Users**
2. Find your user and check assigned roles
3. Ensure role has `Create` permission for Custom Properties

### Error 3: Invalid Entity Type

#### Symptom
```json
{
  "code": 400,
  "message": "Invalid entity type: invalidType"
}
```

#### Solutions
```bash
# Get valid entity types
curl -X GET "${OM_HOST}/api/v1/metadata/types" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.[].name'
```

Valid entity types include: `table`, `database`, `databaseSchema`, `dashboard`, `pipeline`, `topic`, `container`, `mlmodel`

### Error 4: Custom Property Already Exists

#### Symptom
```json
{
  "code": 409,
  "message": "Custom property with name businessCriticality already exists"
}
```

#### Solutions
```bash
# Check existing custom properties
curl -X GET "${OM_HOST}/api/v1/metadata/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.data[].name'

# Use a different name or update the existing property
```

### Error 5: Invalid Property Value

#### Symptom
```json
{
  "code": 400,
  "message": "Invalid value 'Maybe' for enum property. Valid values are: [Public, Internal, Confidential, Restricted]"
}
```

#### Solutions
```bash
# Check valid enum values
curl -X GET "${OM_HOST}/api/v1/metadata/customProperties/name/dataClassification" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.propertyType.enumConfig.values'
```

## Advanced Use Cases

### Bulk Update Custom Properties
```bash
# Script to update multiple entities
#!/bin/bash
export OM_HOST="http://localhost:8585"
export JWT_TOKEN="your-jwt-token"

# Get all tables in a database
curl -s -X GET "${OM_HOST}/api/v1/tables?database=mysql_production.ecommerce" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.data[].id' | while read table_id; do
  
  echo "Updating table: $table_id"
  curl -X PATCH "${OM_HOST}/api/v1/tables/$table_id" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json-patch+json" \
    -d '[{
      "op": "add",
      "path": "/customProperties",
      "value": [{"name": "dataClassification", "value": "Internal"}]
    }]'
done
```

### Create Custom Properties with Validation
```bash
# Create a custom property with format validation
curl -X POST "${OM_HOST}/api/v1/metadata/customProperties" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "contactEmail",
    "displayName": "Data Owner Email",
    "description": "Email address of the data owner",
    "propertyType": {
      "name": "email"
    },
    "entityTypeIds": ["table", "database"]
  }' | jq
```

## Best Practices

### 1. Naming Conventions
- Use camelCase for property names
- Use descriptive display names
- Include clear descriptions

### 2. Property Design
- Choose appropriate data types
- Use enums for controlled vocabularies
- Consider searchability when designing properties

### 3. Security Considerations
- Use appropriate authentication methods
- Rotate JWT tokens regularly
- Limit API access to necessary users
- Don't expose sensitive information in custom properties

### 4. Performance
- Batch updates when possible
- Use specific queries instead of broad searches
- Index frequently queried custom properties

## Validation Checklist

- [ ] Authentication is working correctly
- [ ] Custom property is created with correct type
- [ ] Property is attached to appropriate entity types
- [ ] Values are set correctly on entities
- [ ] Properties appear in the OpenMetadata UI
- [ ] Search functionality works with custom properties
- [ ] Permission restrictions are properly enforced

## Next Steps

After implementing custom metadata fields:

1. **Set up Data Governance**: Use custom properties for compliance tracking
2. **Implement Automation**: Create workflows to automatically populate custom fields
3. **Create Reports**: Use custom properties in data insights and reporting
4. **Train Users**: Educate team members on when and how to use custom fields

{% note %}
Custom properties are powerful tools for extending OpenMetadata's metadata model. Plan your custom property schema carefully and maintain consistency across your organization.
{% /note %}