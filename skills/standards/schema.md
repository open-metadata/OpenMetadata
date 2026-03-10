# JSON Schema Standards

## Connection Schema

Location: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/{service_type}/{moduleName}Connection.json`

### Minimal Database Schema

```json
{
  "$id": "https://open-metadata.org/schema/entity/services/connections/database/myDbConnection.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MyDbConnection",
  "description": "MyDb Connection Config",
  "type": "object",
  "javaType": "org.openmetadata.schema.services.connections.database.MyDbConnection",
  "definitions": {
    "myDbType": {
      "description": "Service type.",
      "type": "string",
      "enum": ["MyDb"],
      "default": "MyDb"
    },
    "myDbScheme": {
      "description": "SQLAlchemy driver scheme.",
      "type": "string",
      "enum": ["mydb+pymydb"],
      "default": "mydb+pymydb"
    }
  },
  "properties": {
    "type": {
      "title": "Service Type",
      "description": "Service Type",
      "$ref": "#/definitions/myDbType",
      "default": "MyDb"
    },
    "scheme": {
      "title": "Connection Scheme",
      "description": "SQLAlchemy driver scheme options.",
      "$ref": "#/definitions/myDbScheme",
      "default": "mydb+pymydb"
    },
    "username": { ... },
    "password": { ... },
    "hostPort": { ... },
    "supportsMetadataExtraction": {
      "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction"
    }
  },
  "additionalProperties": false,
  "required": ["hostPort"]
}
```

### Minimal Non-Database Schema

Non-database schemas follow the same structure but without `scheme`:

```json
{
  "$id": "https://open-metadata.org/schema/entity/services/connections/dashboard/myDashConnection.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MyDashConnection",
  "description": "MyDash Connection Config",
  "type": "object",
  "javaType": "org.openmetadata.schema.services.connections.dashboard.MyDashConnection",
  "definitions": {
    "myDashType": {
      "description": "Service type.",
      "type": "string",
      "enum": ["MyDash"],
      "default": "MyDash"
    }
  },
  "properties": {
    "type": {
      "title": "Service Type",
      "$ref": "#/definitions/myDashType",
      "default": "MyDash"
    },
    "hostPort": {
      "title": "Host and Port",
      "type": "string",
      "format": "uri"
    },
    "supportsMetadataExtraction": {
      "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction"
    }
  },
  "additionalProperties": false,
  "required": ["hostPort"]
}
```

## Shared $ref Schemas

### Auth Schemas (under `connections/{service_type}/common/`)
| Schema | Use For |
|--------|---------|
| `basicAuth.json` | Username + password |
| `iamAuthConfig.json` | AWS IAM roles |
| `azureConfig.json` | Azure Active Directory |
| `jwtAuth.json` | JWT bearer tokens |

### Capability Flags (under `connections/connectionBasicType.json#/definitions/`)
| Flag | When to Include |
|------|----------------|
| `supportsMetadataExtraction` | Always |
| `supportsUsageExtraction` | If usage capability |
| `supportsLineageExtraction` | If lineage capability |
| `supportsProfiler` | If profiler capability |
| `supportsDBTExtraction` | Database connectors |
| `supportsDataDiff` | If data diff capability |
| `supportsQueryComment` | If query comment supported |

### Filter Patterns
```json
"databaseFilterPattern": {
    "description": "Regex to only fetch databases that matches the pattern.",
    "$ref": "../../../../type/filterPattern.json#/definitions/filterPattern"
}
```

Database connectors: `databaseFilterPattern`, `schemaFilterPattern`, `tableFilterPattern`
Dashboard connectors: `dashboardFilterPattern`, `chartFilterPattern`, `projectFilterPattern`
Pipeline connectors: `pipelineFilterPattern`
Messaging connectors: `topicFilterPattern`

## Test Connection JSON

Location: `openmetadata-service/src/main/resources/json/data/testConnections/{service_type}/{moduleName}.json`

```json
{
  "name": "MyDb",
  "displayName": "MyDb Test Connection",
  "description": "Validate that we can connect and extract metadata from MyDb.",
  "steps": [
    {
      "name": "CheckAccess",
      "description": "Validate access to the service",
      "errorMessage": "Failed to connect to MyDb",
      "mandatory": true,
      "shortCircuit": true
    },
    {
      "name": "GetDatabases",
      "description": "List available databases",
      "errorMessage": "Failed to list databases",
      "mandatory": true,
      "shortCircuit": false
    }
  ]
}
```

Step names must exactly match keys in the `test_fn` dict returned by `connection.py`.

## Service Registration Schema

Location: `openmetadata-spec/.../entity/services/{serviceType}Service.json`

Add two things:
1. The connector name to the `serviceType` enum array
2. A `$ref` entry to the connection `oneOf` array:

```json
{
    "$ref": "../../connections/{service_type}/{moduleName}Connection.json"
}
```
