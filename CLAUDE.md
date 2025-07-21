# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About OpenMetadata Ingestion

OpenMetadata Ingestion is a Python framework for building connectors to ingest metadata from various systems into OpenMetadata. It contains 75+ data source connectors for databases, dashboards, pipelines, messaging systems, and more. This module is part of the larger OpenMetadata platform.

## Architecture Overview

The ingestion module follows a plugin-based architecture:

- **Core Framework**: Based on Python 3.9+ with Pydantic 2.x for data models
- **Workflow Engine**: Handles sequential processing of metadata through Source → Processor → Sink steps
- **Connectors**: Plugin-based connectors for various data sources
- **Metadata Profiler**: SQLAlchemy ORM-based profiler for data quality metrics
- **Data Quality**: Framework for running tests against data sources
- **PII Detection**: NLP-based detection of sensitive data

## Directory Structure

- `src/metadata/`: Core functionality for metadata ingestion and workflows
  - `ingestion/`: Core ingestion framework and source connectors
  - `profiler/`: Data profiling capabilities
  - `data_quality/`: Data quality validations framework
  - `workflow/`: Workflow execution engine

- `examples/`: Example workflow configuration files
- `plugins/`: Custom pylint plugins for code quality
- `tests/`: Unit and integration tests

## Essential Development Commands

### Setup and Installation

```bash
# Install development dependencies
make install_dev_env

# Install specific plugin dependencies
pip install ".[mysql]"
pip install ".[snowflake]"
pip install ".[all]"  # Install all dependencies (except airflow, db2, etc)
```

### Build Commands

```bash
# Install the package in development mode
pip install -e .

# Generate models from JSON schemas
make generate
```

### Testing Commands

```bash
# Run unit tests (excluding specific packages like airflow)
make unit_ingestion_dev_env

# Run specific unit tests
pytest tests/unit/path/to/test_file.py -v

# Run integration tests
make run_ometa_integration_tests

# Run all tests with coverage
make run_python_tests
```

### Code Quality Tools

```bash
# Run linting
make lint

# Format code
make py_format

# Run static type checking
make static-checks

# Install pre-commit hooks
make precommit_install
```

### Running the CLI

```bash
# Run metadata ingestion
metadata ingest -c path/to/config.yaml

# Run metadata profiling
metadata profile -c path/to/config.yaml

# Run data quality tests
metadata test-suite -c path/to/config.yaml
```

## Development Workflow

1. **Install Dependencies**: Use `make install_dev_env` to set up your environment
2. **Write Code**: Follow the plugin-based architecture for adding new connectors or features
3. **Format Code**: Use `make py_format` to ensure code follows style guidelines
4. **Test**: Run `make unit_ingestion_dev_env` to verify your changes
5. **Static Type Checking**: Run `make static-checks` to catch type errors

## Connector Development

When developing a new connector:

1. Study existing connectors in `src/metadata/ingestion/source/`
2. Implement required interfaces (metadata, usage, lineage, etc.)
3. Add example configuration in `examples/workflows/`
4. Write unit tests in `tests/unit/`
5. Add integration tests if possible in `tests/integration/`

## Workflow Architecture

OpenMetadata ingestion workflows use a step-based architecture:

- **Source**: Reads metadata from external systems (IterStep)
- **Processor**: Transforms metadata (ReturnStep)
- **Sink**: Sends data to OpenMetadata API (ReturnStep)
- **BulkSink**: Handles bulk operations (BulkStep)

Workflows handle errors through Either monad pattern and maintain Status objects to track progress.

## Common Issues and Solutions

- **Import Errors**: Use the correct import paths. Never use `ingestion.src.metadata`, use `metadata` directly.
- **Dependency Conflicts**: Some plugins have conflicting dependencies. Use specific environments for testing.
- **SSL Errors**: Check SSL certificates and configurations in connection parameters.
- **Performance Issues**: Use sampling for large datasets in profiling workflows.

## Useful Documentation Links

For more details on the OpenMetadata architecture and APIs, refer to:
- https://docs.open-metadata.org/connectors