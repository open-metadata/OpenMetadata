# RDF/Apache Jena Local Development Guide

This guide documents how to set up RDF/Knowledge Graph support for local development with OpenMetadata running in IntelliJ IDEA and Apache Jena Fuseki running in Docker.

## Overview

OpenMetadata supports RDF (Resource Description Framework) for knowledge graph capabilities using Apache Jena Fuseki as the triple store. This enables:
- SPARQL queries against metadata
- JSON-LD serialization of entities
- Semantic search and graph exploration

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

### Step 1: Start Apache Jena Fuseki

Start the Fuseki triple store using Docker Compose:

```bash
cd /path/to/OpenMetadata
docker compose -f docker/development/docker-compose-fuseki.yml up -d
```

This starts Fuseki with:
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

Create or modify your IntelliJ run configuration for `OpenMetadataApplication` with these environment variables:

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
  remoteEndpoint: ${RDF_ENDPOINT:-"http://localhost:3030/openmetadata"}
  username: ${RDF_REMOTE_USERNAME:-"admin"}
  password: ${RDF_REMOTE_PASSWORD:-"admin"}
  dataset: ${RDF_DATASET:-"openmetadata"}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RDF_ENABLED` | Enable/disable RDF support | `false` |
| `RDF_STORAGE_TYPE` | Storage backend type | `FUSEKI` |
| `RDF_BASE_URI` | Base URI for RDF resources | `https://open-metadata.org/` |
| `RDF_ENDPOINT` | Fuseki SPARQL endpoint URL | `http://localhost:3030/openmetadata` |
| `RDF_REMOTE_USERNAME` | Fuseki admin username | `admin` |
| `RDF_REMOTE_PASSWORD` | Fuseki admin password | `admin` |
| `RDF_DATASET` | Fuseki dataset name | `openmetadata` |

### Docker Compose Configuration

The Fuseki container (`docker/development/docker-compose-fuseki.yml`):

```yaml
services:
  fuseki:
    image: stain/jena-fuseki:5.0.0
    container_name: openmetadata-fuseki
    ports:
      - "3030:3030"
    environment:
      - ADMIN_PASSWORD=admin
      - JVM_ARGS=-Xmx4g -Xms2g
      - FUSEKI_BASE=/fuseki
    volumes:
      - fuseki-data:/fuseki
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
```

## Indexing Entities to RDF

### Manual Reindexing

Trigger the RDF indexing application to populate the triple store with existing entities:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"entities": ["all"], "recreateIndex": true, "batchSize": 100}' \
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
