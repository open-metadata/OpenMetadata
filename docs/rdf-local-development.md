# RDF/Apache Jena Local Development Guide

This guide documents how to set up RDF/Knowledge Graph support for local development with OpenMetadata and Apache Jena Fuseki.

For production sizing, tuning, compaction, scheduling, and monitoring, see [Setting up Apache Jena Fuseki efficiently](rdf-production-setup.md).

## Overview

OpenMetadata supports RDF (Resource Description Framework) for knowledge graph capabilities using Apache Jena Fuseki as the triple store. This enables:
- SPARQL queries against metadata
- JSON-LD serialization of entities
- Semantic search and graph exploration

## Standards Compatibility

The RDF stack runs Apache Jena and Fuseki 6.2.0. RDF 1.2 terms survive the whole round trip —
import, storage, query, and result serialization:

- **Triple terms**, including `rdf:reifies` statements and nested blank nodes, and **directional
  language-tagged literals** such as `"قطة"@ar--rtl`.
- **Storage.** Entities reach Fuseki as RDF Thrift and land in TDB2 named graphs; both carry triple
  terms and preserve the `rdf:dirLangString` datatype. Fuseki's Lucene text index (`text:query`)
  indexes directional literals like any other string.
- **SPARQL 1.2.** `VERSION "1.2"` declarations, `TRIPLE()`/`LANGDIR()` expressions, and `<<( s p o )>>`
  patterns all execute. Both the administrator (`/v1/rdf/sparql`) and agent query paths return them;
  the agent path keeps its existing SELECT-only and graph-access restrictions.
- **Results JSON.** A triple binding is `type: "triple"` with recursive `subject`, `predicate`, and
  `object` terms; directional literals carry `its:dir`. Both `sparqlResponse.json` and
  `agentSparqlResponse.json` model this, so typed clients and the SPARQL playground render a triple
  term as `<<( <urn:s> <urn:p> "قطة"@ar--rtl )>>` rather than failing on it.
- **SHACL.** The bundled shapes accept plain, language-tagged, and directional strings wherever they
  constrain free text, so a conforming RDF 1.2 graph validates against them.

### Choosing a serialization

| Format | RDF 1.2 triple terms | Notes |
|---|---|---|
| Turtle, N-Triples | yes | The portable choice; N-Quads and TriG cover datasets. |
| RDF/XML | yes, via Jena | Written as `rdf:parseType="Triple"`. Jena reads back what it writes; interoperability with other RDF/XML toolchains is not verified — prefer Turtle when the consumer is not Jena. |
| JSON-LD | **no** | JSON-LD 1.1 has no triple-term syntax. Asking for `jsonld` on a result that contains one is rejected with a message naming the formats that work, rather than failing mid-write. Directional literals *are* written, as the JSON-LD 1.1 `i18n` datatype (`"@type": "https://www.w3.org/ns/i18n#ar_rtl"`), which does not read back as an `rdf:dirLangString` — so do not round-trip RDF 1.2 text through JSON-LD. |

### Scope

OpenMetadata does not itself emit RDF 1.2 terms: entity RDF is derived from JSON-LD contexts
(`JsonLdTranslator`), so the graph the platform writes for its own entities is RDF 1.1. RDF 1.2
terms enter through imported ontologies and user-authored SPARQL, and the guarantees above are about
carrying those through unchanged.

For example, both query paths accept this read query:

```sparql
VERSION "1.2"
SELECT (TRIPLE(<https://example.com/subject>,
               <https://example.com/predicate>,
               "قطة"@ar--rtl) AS ?statement)
WHERE {}
```

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   OpenMetadata      │     │   Apache Jena       │
│   Server (IntelliJ) │────▶│   Fuseki (Docker)   │
│   Port: 8585        │     │   Port: 3030        │
└─────────────────────┘     └─────────────────────┘
```

## Prerequisites

- Docker and Docker Compose installed
- IntelliJ IDEA with the project imported
- MySQL or PostgreSQL running (for OpenMetadata backend)
- Elasticsearch running (for search)

## Quick Start

### Step 1: Choose the Right Startup Mode

The standard local Docker flow does not enable RDF or start Fuseki:

```bash
cd /path/to/OpenMetadata
./docker/run_local_docker.sh -d mysql
```

For PostgreSQL-based development:

```bash
./docker/run_local_docker.sh -d postgresql
```

Use the RDF-specific startup script when you want the full Docker stack with Fuseki enabled:

```bash
./docker/run_local_docker_rdf.sh -d mysql
```

For PostgreSQL-based RDF development:

```bash
./docker/run_local_docker_rdf.sh -d postgresql
```

This RDF startup path starts OpenMetadata, the backing database, search, ingestion services, and Fuseki with:
- **Port**: 3030
- **Admin Password**: admin
- **Dataset**: openmetadata
- **Memory**: 2-4GB allocated

### Step 2: Verify Fuseki is Running

```bash
# Check Fuseki health
curl -s http://localhost:3030/$/ping

# Access Fuseki UI in browser
open http://localhost:3030
```

The Fuseki web UI is available at `http://localhost:3030` with credentials:
- Username: `admin`
- Password: `admin`

### Step 3: Configure IntelliJ Run Configuration

If you are running the full RDF Docker stack with `run_local_docker_rdf.sh`, the Docker services already receive the RDF environment variables automatically.

If you want to run the OpenMetadata server directly from IntelliJ while keeping Fuseki in Docker, start Fuseki separately:

```bash
docker compose -f docker/development/docker-compose.yml -f docker/development/docker-compose-fuseki.yml up -d fuseki
```

If your local backend uses PostgreSQL, swap `docker-compose.yml` for `docker-compose-postgres.yml`.

Create or modify your IntelliJ run configuration for `OpenMetadataApplication` with these environment variables only when you want to run the OpenMetadata server directly from IntelliJ while keeping Fuseki in Docker:

```
RDF_ENABLED=true
RDF_STORAGE_TYPE=FUSEKI
RDF_BASE_URI=https://open-metadata.org/
RDF_ENDPOINT=http://localhost:3030/openmetadata
RDF_REMOTE_USERNAME=admin
RDF_REMOTE_PASSWORD=admin
RDF_DATASET=openmetadata
```

#### Setting Environment Variables in IntelliJ:

1. Open **Run** → **Edit Configurations**
2. Select your `OpenMetadataApplication` configuration
3. Click on **Modify options** → **Environment variables**
4. Add the environment variables above (semicolon-separated or using the dialog)

Example environment variables string:
```
RDF_ENABLED=true;RDF_STORAGE_TYPE=FUSEKI;RDF_BASE_URI=https://open-metadata.org/;RDF_ENDPOINT=http://localhost:3030/openmetadata;RDF_REMOTE_USERNAME=admin;RDF_REMOTE_PASSWORD=admin;RDF_DATASET=openmetadata
```

### Step 4: Start OpenMetadata Server

Run `OpenMetadataApplication` from IntelliJ. On startup, you should see in the logs:

```
INFO  [main] o.o.s.OpenMetadataApplication - RDF knowledge graph support initialized
```

### Step 5: Verify RDF is Enabled

```bash
# Check RDF status
curl http://localhost:8585/api/v1/rdf/status

# Expected response:
# {"enabled": true}
```

## Configuration Reference

### Server Configuration (conf/openmetadata.yaml)

The RDF configuration section in `openmetadata.yaml`:

```yaml
rdf:
  enabled: ${RDF_ENABLED:-false}
  baseUri: ${RDF_BASE_URI:-"https://open-metadata.org/"}
  storageType: ${RDF_STORAGE_TYPE:-"FUSEKI"}
  remoteEndpoint: ${RDF_ENDPOINT:-${RDF_REMOTE_ENDPOINT:-"http://localhost:3030/openmetadata"}}
  connectTimeoutMs: ${RDF_CONNECT_TIMEOUT_MS:-2000}
  requestTimeoutMs: ${RDF_REQUEST_TIMEOUT_MS:-60000}
  bulkEntityBatchSize: ${RDF_BULK_ENTITY_BATCH_SIZE:-100}
  bulkRelationshipSourceBatchSize: ${RDF_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE:-100}
  bulkLineageEdgeBatchSize: ${RDF_BULK_LINEAGE_EDGE_BATCH_SIZE:-50}
  username: ${RDF_REMOTE_USERNAME:-"admin"}
  password: ${RDF_REMOTE_PASSWORD:-"admin"}
  dataset: ${RDF_DATASET:-"openmetadata"}
  inferenceEnabled: ${RDF_INFERENCE_ENABLED:-false}
  defaultInferenceLevel: ${RDF_DEFAULT_INFERENCE_LEVEL:-"NONE"}
  maxInMemoryInferenceTriples: ${RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES:-100000}
  materializedInferenceEnabled: ${RDF_MATERIALIZED_INFERENCE_ENABLED:-false}
  shaclValidationMode: ${RDF_SHACL_VALIDATION_MODE:-"REPORT"}
  dereferenceableIris: ${RDF_DEREFERENCEABLE_IRIS:-false}
  strictOwlProfile: ${RDF_STRICT_OWL_PROFILE:-true}
  askCollateEnabled: ${RDF_ASK_COLLATE_ENABLED:-false}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RDF_ENABLED` | Enable/disable RDF support | `false` |
| `RDF_STORAGE_TYPE` | Storage backend type | `FUSEKI` |
| `RDF_BASE_URI` | Base URI for RDF resources | `https://open-metadata.org/` |
| `RDF_ENDPOINT` | Fuseki SPARQL endpoint URL | `http://localhost:3030/openmetadata` |
| `RDF_REMOTE_ENDPOINT` | Deprecated fallback when `RDF_ENDPOINT` is unset | unset |
| `RDF_CONNECT_TIMEOUT_MS` | Fuseki connection timeout | `2000` |
| `RDF_REQUEST_TIMEOUT_MS` | Per-request timeout | `60000` |
| `ASYNC_MAX_CONCURRENT_RDF_WRITES` | In-flight live writes (automatically clamped to one for Fuseki) | `8` |
| `RDF_BULK_ENTITY_BATCH_SIZE` | Entity models per bulk write | `100` |
| `RDF_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE` | Relationship sources per bulk write | `100` |
| `RDF_BULK_LINEAGE_EDGE_BATCH_SIZE` | Detailed lineage edges per bulk write | `50` |
| `RDF_REMOTE_USERNAME` | Fuseki admin username | `admin` |
| `RDF_REMOTE_PASSWORD` | Fuseki admin password | `admin` |
| `RDF_DATASET` | Fuseki dataset name | `openmetadata` |
| `RDF_INFERENCE_ENABLED` | Enable in-process full-graph inference | `false` |
| `RDF_DEFAULT_INFERENCE_LEVEL` | Default inference selection | `NONE` |
| `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` | Legacy in-process safety limit | `100000` |
| `RDF_MATERIALIZED_INFERENCE_ENABLED` | Enable durable per-rule inference graphs | `false` |
| `RDF_SHACL_VALIDATION_MODE` | Import validation policy | `REPORT` |
| `RDF_DEREFERENCEABLE_IRIS` | Enable authenticated LOD redirects | `false` |
| `RDF_STRICT_OWL_PROFILE` | Enforce supported OWL profile rules | `true` |
| `RDF_ASK_COLLATE_ENABLED` | Enable Ontology Studio AI | `false` |

### Docker Compose Configuration

The Fuseki container (`docker/development/docker-compose-fuseki.yml`):

```yaml
services:
  fuseki:
    build:
      context: ../rdf-store
      dockerfile: Dockerfile
    image: openmetadata-fuseki:6.2.0
    container_name: openmetadata-fuseki
    ports:
      - "3030:3030"
    environment:
      - FUSEKI_ADMIN_PASSWORD=admin
      - FUSEKI_OPENMETADATA_PASSWORD=openmetadata-secret
      - JVM_ARGS=-Xmx1500m -Xms256m
    volumes:
      - fuseki-tdb2-data:/fuseki-data
```

## API Endpoints

Once RDF is enabled, these endpoints are available:

### Check RDF Status
```bash
GET /api/v1/rdf/status
```

### Get Entity as RDF
```bash
# Get entity in JSON-LD format (default)
GET /api/v1/rdf/entity/{entityType}/{id}

# Get entity in Turtle format
GET /api/v1/rdf/entity/{entityType}/{id}?format=turtle

# Get entity in RDF/XML format
GET /api/v1/rdf/entity/{entityType}/{id}?format=rdfxml

# Get entity in N-Triples format
GET /api/v1/rdf/entity/{entityType}/{id}?format=ntriples
```

### Execute SPARQL Query
```bash
POST /api/v1/rdf/sparql
Content-Type: application/json

{
  "query": "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
}
```

### Execute Agent SPARQL Query
```bash
POST /api/v1/rdf/sparql/agent
Content-Type: application/json

{
  "query": "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
}
```

Unlike the admin endpoint above, this is a permissioned read surface for agent tools:
it requires the `ExecuteSparqlQuery` operation on the `rdf` resource (granted by a policy
that names it — wildcard `All`/`All` policies do not grant it). Only `SELECT` queries run,
with no `FROM`, `GRAPH`, or `SERVICE` clauses; inference is disabled; results carry a
completeness status relative to the submitted query. Queries evaluate over the
server-configured dataset without persona filtering and without asset-level
authorization — callers must already be entitled to see the whole projected graph.

### Get Glossary Term Relationship Graph
```bash
# Get the full glossary term graph
GET /api/v1/rdf/glossary/graph

# Filter primary terms to a glossary
GET /api/v1/rdf/glossary/graph?glossaryId=<glossary-id>

# Filter to a glossary term and its direct incoming/outgoing neighbors
GET /api/v1/rdf/glossary/graph?glossaryTermId=<glossary-term-id>

# Require the selected term to belong to a glossary, while still returning
# direct cross-glossary neighbors when relationships cross glossary boundaries
GET /api/v1/rdf/glossary/graph?glossaryId=<glossary-id>&glossaryTermId=<glossary-term-id>
```

Optional query parameters:

| Parameter | Description |
|-----------|-------------|
| `glossaryId` | Filter primary terms to a glossary. |
| `glossaryTermId` | Filter to a selected glossary term and its direct incoming/outgoing glossary-term relations. |
| `relationTypes` | Comma-separated relation types to include. |
| `limit` | Maximum number of terms to return. Default: `500`. |
| `offset` | Pagination offset. Default: `0`. |
| `includeIsolated` | Include terms without relations. Default: `true`. |

### Example Queries

```bash
# Check if RDF is enabled
curl -s http://localhost:8585/api/v1/rdf/status | jq

# Get a table entity as JSON-LD
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:8585/api/v1/rdf/entity/table/<table-id>" | jq

# Execute a SPARQL query
curl -s -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"}' \
  http://localhost:8585/api/v1/rdf/sparql | jq

# Get a selected glossary term graph
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:8585/api/v1/rdf/glossary/graph?glossaryId=<glossary-id>&glossaryTermId=<glossary-term-id>" | jq
```

## Indexing Entities to RDF

### Manual Reindexing

Trigger the RDF indexing application to populate the triple store with existing entities:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"entities": [], "recreateIndex": true, "batchSize": 100}' \
  http://localhost:8585/api/v1/apps/trigger/RdfIndexApp
```

### Automatic Indexing

When RDF is enabled, new entities are automatically indexed to the triple store on create/update/delete operations.

## Fuseki Web UI

The Fuseki web interface provides:

- **Dataset Management**: View and manage datasets at `http://localhost:3030/#/manage`
- **SPARQL Query Interface**: Execute queries at `http://localhost:3030/#/dataset/openmetadata/query`
- **Data Upload**: Upload RDF data at `http://localhost:3030/#/dataset/openmetadata/upload`

## Troubleshooting

### Fuseki Connection Issues

1. Verify Fuseki is running:
   ```bash
   docker ps | grep fuseki
   curl http://localhost:3030/$/ping
   ```

2. Check Fuseki logs:
   ```bash
   docker logs openmetadata-fuseki
   ```

3. Ensure the dataset exists:
   ```bash
   curl -u admin:admin http://localhost:3030/$/datasets
   ```

### RDF Not Enabled in Server

1. Verify environment variables are set correctly in IntelliJ
2. Check server logs for RDF initialization message
3. Confirm configuration in `openmetadata.yaml`

### SPARQL Query Errors

1. Check Fuseki is accessible from OpenMetadata server
2. Verify the dataset name matches (`openmetadata`)
3. Check Fuseki logs for query errors

### Reset Fuseki Data

To clear all RDF data and start fresh:

```bash
# Stop Fuseki
docker compose -f docker/development/docker-compose-fuseki.yml down

# Remove volume
docker volume rm openmetadata_fuseki-data

# Restart Fuseki
docker compose -f docker/development/docker-compose-fuseki.yml up -d
```

## Full Stack with Docker Script

For a complete local environment with RDF enabled (server running in Docker, not IntelliJ):

```bash
./docker/run_local_docker_rdf.sh -m ui -d mysql -f true
```

Options:
- `-m ui|no-ui` - Include UI or not
- `-d mysql|postgresql` - Database type
- `-f true|false` - Start Fuseki for RDF support
- `-s true|false` - Skip Maven build
- `-x true|false` - Enable JVM debug on port 5005

## Related Files

- **Docker Compose**: `docker/development/docker-compose-fuseki.yml`
- **Server Config**: `conf/openmetadata.yaml`
- **RDF Java Code**: `openmetadata-service/src/main/java/org/openmetadata/service/rdf/`
- **Ontology**: `openmetadata-spec/src/main/resources/rdf/ontology/openmetadata.ttl`
- **RDF Index App**: `openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/rdf/RdfIndexApp.java`
