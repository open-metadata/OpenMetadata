# Registration Standards

## Step-by-Step Registration

After generating the connector code, these existing files must be modified to register it.

### 1. Service Schema

**File**: `openmetadata-spec/src/main/resources/json/schema/entity/services/{serviceType}Service.json`

Add the connector name to the `serviceType` enum:
```json
"serviceType": {
    "enum": [..., "MyDb"]
}
```

Add a `$ref` to the connection in the `oneOf`:
```json
"config": {
    "oneOf": [
        ...,
        { "$ref": "../../connections/{service_type}/myDbConnection.json" }
    ]
}
```

### 2. UI Service Utils

**File**: `openmetadata-ui/src/main/resources/ui/src/utils/{ServiceType}ServiceUtils.tsx`

Import the resolved connection schema:
```typescript
import myDbConnection from '../../jsons/connectionSchemas/connections.{ServiceType}.myDbConnection.json';
```

Add a case to the switch statement:
```typescript
case {ServiceType}Type.MyDb:
    schema = myDbConnection;
    break;
```

### 3. Localization (i18n)

**File**: `openmetadata-ui/src/main/resources/ui/src/locale/languages/en-us.json`

Add display name key:
```json
"service-entity": {
    "my-db": "MyDb"
}
```

Also add to other language files (`fr-fr.json`, `es-es.json`, etc.) with English fallback values.

### 4. Code Generation

After registration, run code generation to propagate changes:

```bash
# Python models
make generate

# Java models
mvn clean install -pl openmetadata-spec

# UI schemas (from ui directory)
cd openmetadata-ui/src/main/resources/ui && yarn parse-schema
```

### 5. Formatting

```bash
# Python
make py_format

# Java
mvn spotless:apply
```

## Verification

After registration:
- [ ] `make generate` succeeds
- [ ] `mvn clean install -pl openmetadata-spec` succeeds
- [ ] `yarn parse-schema` succeeds
- [ ] The connector appears in the resolved UI schemas
- [ ] The service type is recognized by the backend
