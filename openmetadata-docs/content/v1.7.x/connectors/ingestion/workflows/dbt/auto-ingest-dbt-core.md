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
metadata ingest-dbt --dbt-project-path /path/to/your/dbt-project
```

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
  # OpenMetadata Configuration
  openmetadata_host_port: "https://your-openmetadata-server-url/endpoint"
  openmetadata_jwt_token: "{{ env_var('OPENMETADATA_TOKEN') }}"
  openmetadata_service_name: "postgres_analytics"
  
  # Optional Settings
  openmetadata_dbt_update_descriptions: true
  openmetadata_dbt_update_owners: true
  openmetadata_include_tags: true
  openmetadata_dbt_classification_name: "dbt_analytics_tags"
  
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
- **Lineage**: Table-to-table and column-level lineage
- **Documentation**: Model and column descriptions
- **Data Quality**: dbt test definitions and results
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

### Debug Mode

Enable detailed logging:
```bash
metadata --debug ingest-dbt -c .
```

## Best Practices

### Security
- Use environment variables for sensitive data:
  ```yaml
  vars:
    openmetadata_host_port: "{{ env_var('OPENMETADATA_HOST') }}"
    openmetadata_jwt_token: "{{ env_var('OPENMETADATA_TOKEN') }}"
    openmetadata_service_name: "{{ env_var('OPENMETADATA_SERVICE') }}"
  ```

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
          OPENMETADATA_HOST: ${{ secrets.OPENMETADATA_HOST }}
          OPENMETADATA_TOKEN: ${{ secrets.OPENMETADATA_TOKEN }}
          OPENMETADATA_SERVICE: ${{ secrets.OPENMETADATA_SERVICE }}
```

## Next Steps

After successful ingestion:

1. **Explore your data** in the OpenMetadata UI
2. **Configure additional dbt features** like [tags](/connectors/ingestion/workflows/dbt/ingest-dbt-tags), [tiers](/connectors/ingestion/workflows/dbt/ingest-dbt-tier), and [glossary](/connectors/ingestion/workflows/dbt/ingest-dbt-glossary)
3. **Set up data governance** policies and workflows
4. **Schedule regular ingestion** for keeping metadata up-to-date

For additional troubleshooting, refer to the [dbt Troubleshooting Guide](/connectors/ingestion/workflows/dbt/dbt-troubleshooting). 