---
title: Auto Ingest dbt-core
slug: /connectors/ingestion/workflows/dbt/auto-ingest-dbt-core
---

# Auto Ingest dbt-core

Learn how to automatically ingest dbt-core artifacts into OpenMetadata using the simplified `metadata ingest-dbt` CLI command that reads configuration directly from your `dbt_project.yml` file.

{% note %}
This feature eliminates the need for separate YAML configuration files. All configuration is done directly in your existing `dbt_project.yml` file.
{% /note %}

## Overview

The `metadata ingest-dbt` command provides a streamlined way to ingest dbt artifacts into OpenMetadata by:
- Reading configuration directly from your `dbt_project.yml` file
- Automatically discovering dbt artifacts (`manifest.json`, `catalog.json`, `run_results.json`)
- Supporting comprehensive filtering and configuration options

## Prerequisites

1. **dbt project setup**: You must have a dbt project with a valid `dbt_project.yml` file
2. **dbt artifacts**: Run `dbt compile` or `dbt run` to generate required artifacts in the `target/` directory
3. **OpenMetadata service**: Your database service must already be configured in OpenMetadata
4. **OpenMetadata Python package**: Install the OpenMetadata ingestion package

```bash
pip install "openmetadata-ingestion[dbt]"
```

{% note %}
**Dependencies**: The package includes `python-dotenv>=0.19.0` for automatic `.env` file support, so no additional setup is required for environment variable functionality.
{% /note %}

## Quick Start

### 1. Configure your dbt_project.yml

Add the following variables to the `vars` section of your `dbt_project.yml` file:

```yaml
vars:
  # Required OpenMetadata configuration
  openmetadata_host_port: "https://your-openmetadata-server-url/endpoint"
  openmetadata_jwt_token: "your-jwt-token-here"
  openmetadata_service_name: "your-database-service-name"
```

{% note %}
**Environment Variables**: For security, you can use environment variables instead of hardcoding sensitive values. See the [Environment Variables](#environment-variables) section below for supported patterns.
{% /note %}

### 2. Generate dbt artifacts

```bash
cd your-dbt-project
dbt compile  # or dbt run
```

### 3. Run the ingestion

If you're already in your dbt project directory:
```bash
metadata ingest-dbt
```

Or if you're in a different directory:
```bash
metadata ingest-dbt -c /path/to/your/dbt-project
```

## Environment Variables

For security and flexibility, you can use environment variables in your `dbt_project.yml` configuration instead of hardcoding sensitive values like JWT tokens. The system supports three different environment variable patterns:

### Supported Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `${VAR}` | Shell-style variable substitution | `"${OPENMETADATA_TOKEN}"` |
| `{{ env_var("VAR") }}` | dbt-style without default | `"{{ env_var('OPENMETADATA_HOST') }}"` |
| `{{ env_var("VAR", "default") }}` | dbt-style with default value | `"{{ env_var('SERVICE_NAME', 'default-service') }}"` |

### Environment Variables Example

```yaml
# dbt_project.yml
vars:
  # Using shell-style variables
  openmetadata_host_port: "${OPENMETADATA_HOST_PORT}"
  openmetadata_jwt_token: "${OPENMETADATA_JWT_TOKEN}"
  
  # Using dbt-style variables  
  openmetadata_service_name: "{{ env_var('OPENMETADATA_SERVICE_NAME') }}"
  
  # Using dbt-style with defaults
  openmetadata_dbt_classification_name: "{{ env_var('DBT_CLASSIFICATION', 'dbt_tags') }}"
  openmetadata_search_across_databases: "{{ env_var('SEARCH_ACROSS_DB', 'false') }}"
```

Then set your environment variables:
```bash
export OPENMETADATA_HOST_PORT="https://your-openmetadata-server-url/endpoint"
export OPENMETADATA_JWT_TOKEN="your-jwt-token"
export OPENMETADATA_SERVICE_NAME="your-database-service"
```

**Alternative: Using .env Files**

For local development, you can create a `.env` file in your dbt project directory:

```bash
# .env file in your dbt project root
OPENMETADATA_HOST_PORT=https://your-openmetadata-server-url/endpoint
OPENMETADATA_JWT_TOKEN=your-jwt-token
OPENMETADATA_SERVICE_NAME=your-database-service
```

{% note %}
**Note**: The system automatically loads environment variables from `.env` files in both the dbt project directory and the current working directory. Environment variables set in the shell take precedence over `.env` file values.
{% /note %}

{% note %}
**Error Handling**: If a required environment variable is not set and no default is provided, the ingestion will fail with a clear error message indicating which variable is missing.
{% /note %}

## Configuration Options

### Required Parameters

| Parameter | Description |
|-----------|-------------|
| `openmetadata_host_port` | OpenMetadata server URL (must start with `https://`) |
| `openmetadata_jwt_token` | JWT token for authentication |
| `openmetadata_service_name` | Name of the database service in OpenMetadata |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `openmetadata_dbt_update_descriptions` | `true` | Update table/column descriptions from dbt |
| `openmetadata_dbt_update_owners` | `true` | Update model owners from dbt |
| `openmetadata_include_tags` | `true` | Include dbt tags as OpenMetadata tags |
| `openmetadata_search_across_databases` | `false` | Search for tables across multiple databases |
| `openmetadata_dbt_classification_name` | `null` | Custom classification name for dbt tags |

### Filter Patterns

Control which databases, schemas, and tables to include or exclude:

```yaml
vars:
  # ... required config above ...
  
  # Filter patterns using regex
  openmetadata_database_filter_pattern:
    includes: ["production_*", "analytics_*"]
    excludes: ["temp_*", "test_*"]
  
  openmetadata_schema_filter_pattern:
    includes: ["public", "marts", "staging"]
    excludes: ["information_schema", "temp_*"]
  
  openmetadata_table_filter_pattern:
    includes: [".*"]
    excludes: ["temp_.*", "tmp_.*", "dbt_.*"]
```

## Complete Example

```yaml
# dbt_project.yml
name: 'my_analytics_project'
version: '1.0.0'
config-version: 2

profile: 'my_analytics_project'
model-paths: ["models"]
# ... other dbt settings ...

vars:
  # OpenMetadata Configuration - Using Environment Variables
  openmetadata_host_port: "${OPENMETADATA_HOST_PORT}"
  openmetadata_jwt_token: "{{ env_var('OPENMETADATA_JWT_TOKEN') }}"
  openmetadata_service_name: "{{ env_var('OPENMETADATA_SERVICE_NAME', 'postgres_analytics') }}"
  
  # Optional Settings
  openmetadata_dbt_update_descriptions: true
  openmetadata_dbt_update_owners: true
  openmetadata_include_tags: true
  openmetadata_dbt_classification_name: "{{ env_var('DBT_CLASSIFICATION', 'dbt_analytics_tags') }}"
  
  # Filtering
  openmetadata_database_filter_pattern:
    includes: ["analytics", "data_warehouse"]
    excludes: ["temp_db", "test_db"]
  
  openmetadata_table_filter_pattern:
    includes: [".*"]
    excludes: ["temp_.*", "tmp_.*", "test_.*"]
```

## Command Options

```bash
metadata ingest-dbt [OPTIONS]

Options:
  -h, --help                   Show help message and exit
  -c, --dbt-project-path PATH  Path to the dbt project directory (default: current directory)
```

**Note**: Global options like `--version`, `--log-level`, and `--debug` are available at the main `metadata` command level:

```bash
metadata --version                    # Show version information
metadata --log-level DEBUG ingest-dbt -c /path/to/project  # Set log level
metadata --debug ingest-dbt -c /path/to/project           # Enable debug mode
```

## Artifacts Discovery

The command automatically discovers artifacts from your dbt project's `target/` directory:

| Artifact | Required | Description |
|----------|----------|-------------|
| `manifest.json` | ✅ Yes | Model definitions, relationships, and metadata |
| `catalog.json` | ❌ Optional | Table and column statistics from `dbt docs generate` |
| `run_results.json` | ❌ Optional | Test results from `dbt test` |

### Generate All Artifacts

```bash
dbt compile              # Generate manifest.json
dbt docs generate        # Generate catalog.json (requires database connection)
dbt test                 # Generate run_results.json
```

## What Gets Ingested

- **Model Definitions**: Queries, configurations, and relationships
- **Lineage**: 
  - table-to-table lineage with column-level lineage (column-level lineage is supported only in dbt cloud).
  - table-to-dashboard,mlmodel,apiendpoint through [dbt exposures](https://docs.getdbt.com/docs/build/exposures)
- **Documentation**: Model and column descriptions
- **Data Quality**: dbt test definitions and results - including [dbt freshness](https://docs.getdbt.com/reference/resource-properties/freshness) tests
- **Tags & Classification**: Model and column tags
- **Ownership**: Model owners and team assignments

## Error Handling & Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `dbt_project.yml not found` | Ensure you're in a valid dbt project directory |
| `Required configuration not found` | Add `openmetadata_*` variables to your `dbt_project.yml` |
| `manifest.json not found` | Run `dbt compile` or `dbt run` first |
| `Invalid URL format` | Ensure `openmetadata_host_port` includes protocol (`https://`) |
| `Environment variable 'VAR' is not set` | Set the required environment variable or provide a default value |
| `Environment variable not set and no default` | Either set the environment variable or use the `{{ env_var('VAR', 'default') }}` pattern |

### Debug Mode

Enable detailed logging:
```bash
metadata --debug ingest-dbt -c .
```

## Best Practices

### Security
- **Always use environment variables** for sensitive data like JWT tokens
- **Multiple patterns supported** for flexibility:
  ```yaml
  vars:
    # Shell-style (simple and widely supported)
    openmetadata_host_port: "${OPENMETADATA_HOST_PORT}"
    openmetadata_jwt_token: "${OPENMETADATA_JWT_TOKEN}"
    
    # dbt-style (consistent with dbt conventions)
    openmetadata_service_name: "{{ env_var('OPENMETADATA_SERVICE_NAME') }}"
    
    # dbt-style with fallbacks (recommended for optional settings)
    openmetadata_dbt_classification_name: "{{ env_var('DBT_CLASSIFICATION', 'dbt_tags') }}"
  ```
- **Never commit** sensitive values directly to version control

### Filtering
- Use specific patterns to exclude temporary/test tables
- Filter based on your organization's naming conventions
- Exclude system schemas and databases

### Automation
- Integrate into CI/CD pipelines
- Run after successful dbt builds
- Set up scheduled ingestion for regular updates

## CI/CD Integration

```yaml
# .github/workflows/dbt-ingestion.yml
name: dbt and OpenMetadata Ingestion

on:
  push:
    branches: [main]

jobs:
  dbt-run-and-ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install dbt-core dbt-postgres
          pip install "openmetadata-ingestion[dbt]"
      
      - name: Run dbt
        run: |
          dbt deps
          dbt compile
          dbt run
          dbt test
          dbt docs generate
        env:
          DBT_PROFILES_DIR: .
      
      - name: Ingest to OpenMetadata
        run: metadata ingest-dbt -c .
        env:
          OPENMETADATA_HOST_PORT: ${{ secrets.OPENMETADATA_HOST_PORT }}
          OPENMETADATA_JWT_TOKEN: ${{ secrets.OPENMETADATA_JWT_TOKEN }}
          OPENMETADATA_SERVICE_NAME: ${{ secrets.OPENMETADATA_SERVICE_NAME }}
```

## Next Steps

After successful ingestion:

1. **Explore your data** in the OpenMetadata UI
2. **Configure additional dbt features** like [tags](/connectors/ingestion/workflows/dbt/ingest-dbt-tags), [tiers](/connectors/ingestion/workflows/dbt/ingest-dbt-tier), and [glossary](/connectors/ingestion/workflows/dbt/ingest-dbt-glossary)
3. **Set up data governance** policies and workflows
4. **Schedule regular ingestion** for keeping metadata up-to-date

For additional troubleshooting, refer to the [dbt Troubleshooting Guide](/connectors/ingestion/workflows/dbt/dbt-troubleshooting). 