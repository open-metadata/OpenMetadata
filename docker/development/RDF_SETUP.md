# OpenMetadata RDF Setup Guide

This guide explains how to set up and test the RDF/Knowledge Graph feature in OpenMetadata.

## Quick Start

For the fastest setup experience:
```bash
# From the OpenMetadata root directory
./docker/run_local_docker_rdf.sh
```

This will start OpenMetadata with Apache Jena Fuseki for RDF storage, configure all necessary settings, and populate sample data. Once complete, you can:
- View the Knowledge Graph tab on any entity page
- Access Fuseki UI at http://localhost:3030 (admin/admin)
- Run SPARQL queries via the API at `/api/v1/rdf/sparql`

## Prerequisites

- Docker and Docker Compose installed
- OpenMetadata development environment set up
- Java 21+ and Maven installed
- Python 3.9+ with virtual environment activated

## Setting up Apache Jena Fuseki

1. Start Apache Jena Fuseki container:
```bash
cd docker/development
docker-compose -f docker-compose-fuseki.yml up -d
```

2. Verify Fuseki is running:
   - Open http://localhost:3030
   - Login with username: `admin`, password: `admin`
   - You should see the Fuseki web interface

3. The database `openmetadata` will be created automatically when you first connect.

## Configuring OpenMetadata

1. Update your OpenMetadata configuration file (`conf/openmetadata.yaml` or environment variables):

```yaml
rdf:
  enabled: true
  storageType: FUSEKI
  baseUri: "https://open-metadata.org/"
  remoteEndpoint: "http://localhost:3030/openmetadata"
  username: "admin"
  password: "admin"
  dataset: "openmetadata"
```

Or using environment variables:
```bash
export RDF_ENABLED=true
export RDF_STORAGE_TYPE=FUSEKI
export RDF_BASE_URI="https://open-metadata.org/"
export RDF_ENDPOINT="http://localhost:3030/openmetadata"
export RDF_REMOTE_USERNAME="admin"
export RDF_REMOTE_PASSWORD="admin"
export RDF_DATASET="openmetadata"
```

## Starting OpenMetadata with RDF

### Quick Start (All-in-One)

We provide a convenient script that starts OpenMetadata with RDF/Fuseki support:

```bash
# Start OpenMetadata with RDF support enabled
./docker/run_local_docker_rdf.sh

# Options:
# -m [ui|no-ui]     # Running mode (default: ui)
# -d [mysql|postgresql]  # Database type (default: mysql)
# -s [true|false]   # Skip maven build (default: false)
# -f [true|false]   # Start Fuseki for RDF support (default: true)
# -r [true|false]   # Clean DB volumes (default: true)
```

This script will:
1. Build the project
2. Start Apache Jena Fuseki
3. Start OpenMetadata with RDF configuration
4. Run sample data ingestion
5. Trigger both search and RDF indexing

### Manual Setup

If you prefer to set up components manually:

1. Build the project:
```bash
mvn clean install -DskipTests
```

2. Start Fuseki:
```bash
cd docker/development
docker-compose -f docker-compose-fuseki.yml up -d
```

3. Set RDF environment variables:
```bash
export RDF_ENABLED=true
export RDF_STORAGE_TYPE=FUSEKI
export RDF_BASE_URI="https://open-metadata.org/"
export RDF_ENDPOINT="http://localhost:3030/openmetadata"
export RDF_REMOTE_USERNAME="admin"
export RDF_REMOTE_PASSWORD="admin"
export RDF_DATASET="openmetadata"
```

4. Start OpenMetadata server:
```bash
./docker/run_local_docker.sh -m no-ui
```

5. In a separate terminal, start the UI development server:
```bash
cd openmetadata-ui/src/main/resources/ui
yarn install
yarn start
```

## Migrating Existing Data to RDF

There are two ways to populate the RDF store with existing OpenMetadata data:

### Method 1: Using the Command Line (Recommended)

```bash
# Navigate to the OpenMetadata bootstrap directory
cd bootstrap

# Run the RDF reindex command
./openmetadata-ops.sh reindex-rdf -r true
```

Options:
- `-r, --recreate`: Clear and recreate all RDF data (default: true)
- `-e, --entity-type`: Specific entity type to process (e.g., "table", "dashboard"). Use "all" for all entities
- `-b, --batch-size`: Number of records to process in each batch (default: 100)

Examples:
```bash
# Reindex all entities with default settings
./openmetadata-ops.sh reindex-rdf

# Reindex only tables without clearing existing data
./openmetadata-ops.sh reindex-rdf -r false -e table

# Reindex with larger batch size for better performance
./openmetadata-ops.sh reindex-rdf -b 500
```

### Method 2: Using the Admin UI

1. Navigate to Settings → Applications
2. Find "RDF Knowledge Graph Indexing" application
3. Click "Run" to trigger manual execution
4. Configure options in the dialog:
   - Entities: Select which entity types to index
   - Recreate Index: Whether to clear existing data
   - Batch Size: Number of records per batch

## Testing the Knowledge Graph UI

1. Navigate to any entity detail page (e.g., a table)
2. Look for the "Knowledge Graph" tab alongside other tabs like "Schema", "Lineage", etc.
3. Click on the Knowledge Graph tab to see the interactive visualization
4. Use the controls to:
   - Adjust visualization depth (1-5 hops)
   - Change layout (hierarchical, network, circular)
   - Zoom and pan the graph
   - Click on nodes to see entity details

## Verifying RDF Data in Fuseki

1. Access Fuseki UI at http://localhost:3030
2. Select the "openmetadata" dataset
3. Go to "Query" tab
4. Run sample SPARQL queries:

```sparql
# Count all triples
SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }

# List all entity types
SELECT DISTINCT ?type WHERE {
  ?entity a ?type .
}

# Show relationships for a specific entity
SELECT ?predicate ?object WHERE {
  ?entity rdfs:label "your_entity_name" .
  ?entity ?predicate ?object .
}
```

## Troubleshooting

1. **Knowledge Graph tab not visible**: 
   - Ensure RDF is enabled in configuration
   - Check browser console for errors
   - Verify `/api/v1/rdf/status` returns `{"enabled": true}`

2. **No data in graph**:
   - Run the RdfIndexApp to migrate existing data
   - Check Fuseki logs for errors
   - Verify entities exist in OpenMetadata

3. **Connection errors**:
   - Ensure Fuseki container is running
   - Check network connectivity between OpenMetadata and Fuseki
   - Verify credentials in configuration

## Development Tips

- The RDF data is stored separately from the main database
- Changes to entities are automatically synced to RDF
- Use the SPARQL endpoint at `/api/v1/rdf/sparql` for custom queries
- Graph visualization data is cached for 5 minutes to improve performance