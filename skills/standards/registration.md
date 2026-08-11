# Registration Standards

After generating the connector code, six files must be edited and two assets must be added to fully wire the connector through the stack. Miss any of them and the connector will either not appear in the UI, render with the default database icon, or fail to install its driver.

## Backend

### 1. Service Schema

**File**: `openmetadata-spec/src/main/resources/json/schema/entity/services/{serviceType}Service.json`

Add the connector to the `serviceType` enum:
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

### 2. Ingestion Extras

**File**: `ingestion/setup.py`

Add the connector's pip extras so `pip install "openmetadata-ingestion[mydb]"` (and the Docker ingestion image) pulls the right SDK/driver:

```python
"mydb": {
    "mydb-sdk>=1.0.0",
    "other-driver",
},
```

Keep the block alphabetically ordered. Without this, the connector runs locally in the dev venv but fails in the shipped ingestion container.

### 3. CLI Workflow YAML Example

**File**: `ingestion/src/metadata/examples/workflows/{name}.yaml`

A runnable workflow config showing how to ingest metadata from the source via `metadata ingest -c`. This is what users copy into their own deployments and what QA uses for ad-hoc smoke tests.

Use this template (replace `{Name}`, `{name}`, credentials, and `hostPort`):

```yaml
source:
  type: {name}
  serviceName: local_{name}
  serviceConnection:
    config:
      type: {Name}
      username: username
      authType:
        password: password
      hostPort: localhost:5432
      # Add any other required fields from the connection schema
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "<ingestion-bot-jwt>"
```

Keep the structure identical across connectors — users recognize the pattern. Only the `source.*` block changes per connector. Use the canned dev JWT token from `cockroach.yaml` as the placeholder so the example runs against a local OpenMetadata server out of the box.

## UI

### 4. Service Utils — Connection Form Schema

**File**: `openmetadata-ui/src/main/resources/ui/src/utils/{ServiceType}ServiceUtils.tsx`

Import the resolved connection schema and add a switch case so the Add Service form renders:

```typescript
import myDbConnection from '../jsons/connectionSchemas/connections/{serviceType}/myDbConnection.json';
```

```typescript
case {ServiceType}Type.MyDb: {
    schema = myDbConnection;
    break;
}
```

### 5. Service Icon Asset

**File**: `openmetadata-ui/src/main/resources/ui/src/assets/img/service-icon-{name}.png` (`.svg` is also fine)

Drop the logo in place. Prefer SVG when available; otherwise a square PNG ≥ 128×128.

### 6. Icon Loader Registration

**File**: `openmetadata-ui/src/main/resources/ui/src/utils/ServiceIconUtils.ts`

Import the asset and add an entry to `SERVICE_ICON_LOADERS`. The lookup key is the service type **lowercased with underscores/hyphens stripped** (`getServiceIcon()` normalizes with `toLowerCase().replaceAll(/[_-]/g, '')`).

```typescript
import mydb from '../assets/img/service-icon-mydb.png';
```

```typescript
const SERVICE_ICON_LOADERS: Record<string, string> = {
  // Database services
  ...
  mydb: mydb,
};
```

Without this step the connector renders with the generic `databasedefault` icon instead of its own logo.

> **Note**: `openmetadata-ui/.../constants/Services.constant.ts` is **deprecated** as of PR #26906 (April 2026) — it is now a re-export shim. Register icons in `ServiceIconUtils.ts`, not there.

### 7. Service Docs Markdown

**File**: `openmetadata-ui/src/main/resources/ui/public/locales/en-US/{ServiceType}/{Name}.md`

(e.g. `Database/MyDb.md`) This renders the inline help next to each field in the Add Service form. Use `$$section` blocks keyed to field `id`s from the JSON Schema:

```markdown
# MyDb

In this section, we provide guides and references to use the MyDb connector.

## Requirements
...

## Connection Details

$$section
### Host and Port $(id="hostPort")

Host and port of the MyDb service.
$$

$$section
### Username $(id="username")

Username to connect to MyDb.
$$
```

Without this, form fields have no contextual help.

### 8. Beta Flag

**File**: `openmetadata-ui/src/main/resources/ui/src/constants/ServiceType.constant.ts`

**New connectors always ship as Beta.** Add the service type to `BETA_SERVICES` so the UI renders the "Beta" tag next to it in the service picker and detail pages:

```typescript
export const BETA_SERVICES = [
  ...,
  DatabaseServiceType.MyDb,
];
```

Only remove an entry from this list in a later PR, once the connector has been battle-tested in production. Do not skip this step for a new connector — shipping without the Beta tag sets wrong user expectations about stability.

## What you do NOT need to edit

- **i18n locale files** (`src/locale/languages/*.json`): display names are derived from the generated `{ServiceType}Type` enum values. Recent connector PRs (IOMETE, Informix, Timescale) did not touch locale files. Only add keys here if you reference a custom translation key from code.
- **`Services.constant.ts`**: deprecated, see note in step 5.
- **Generated TypeScript types** (`src/generated/`): these are produced by `yarn parse-schema` — never edit by hand.

## Code Generation

After editing schemas, regenerate derived code so models/types match:

```bash
make generate                                      # Python Pydantic models
mvn clean install -pl openmetadata-spec            # Java models
cd openmetadata-ui/src/main/resources/ui && \
  yarn parse-schema                                # UI connection/ingestion schemas
```

## Formatting

```bash
make py_format         # Python: black + isort + pycln
mvn spotless:apply     # Java
```

## Verification Checklist

- [ ] Service schema enum and `oneOf` updated
- [ ] `ingestion/setup.py` has connector extras
- [ ] CLI workflow YAML example added under `ingestion/src/metadata/examples/workflows/`
- [ ] `{ServiceType}ServiceUtils.tsx` imports and switches on the schema
- [ ] Service icon asset added under `assets/img/`
- [ ] `ServiceIconUtils.ts` imports asset and registers it in `SERVICE_ICON_LOADERS`
- [ ] Docs markdown added under `public/locales/en-US/{ServiceType}/`
- [ ] `BETA_SERVICES` updated (new connectors always ship as Beta)
- [ ] `make generate`, `mvn clean install -pl openmetadata-spec`, `yarn parse-schema` all succeed
- [ ] Connector appears with its own logo in the Add Service flow and shows inline field help
