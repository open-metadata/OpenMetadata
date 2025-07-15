# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About OpenMetadata

OpenMetadata is a unified metadata platform for data discovery, data observability, and data governance. This is a multi-module project with Java backend services, React frontend, Python ingestion framework, and comprehensive Docker infrastructure.

## Architecture Overview

- **Backend**: Java 21 + Dropwizard REST API framework, multi-module Maven project
- **Frontend**: React + TypeScript + Ant Design, built with Webpack and Yarn
- **Ingestion**: Python 3.9+ with Pydantic 2.x, 75+ data source connectors
- **Database**: MySQL (default) or PostgreSQL with Flyway migrations
- **Search**: Elasticsearch 7.17+ or OpenSearch 2.6+ for metadata discovery
- **Infrastructure**: Apache Airflow for workflow orchestration

## Essential Development Commands

### Prerequisites and Setup
```bash
make prerequisites              # Check system requirements
make install_dev_env           # Install all development dependencies
make yarn_install_cache        # Install UI dependencies
```

### Frontend Development
```bash
cd openmetadata-ui/src/main/resources/ui
yarn start                     # Start development server on localhost:3000
yarn test                      # Run Jest unit tests
yarn playwright:run            # Run E2E tests
yarn lint                      # ESLint check
yarn lint:fix                  # ESLint with auto-fix
```

### Backend Development
```bash
mvn clean package -DskipTests  # Build without tests
mvn clean package -DonlyBackend -pl !openmetadata-ui  # Backend only
mvn test                       # Run unit tests
mvn verify                     # Run integration tests
mvn spotless:apply             # Format Java code
```

### Python Ingestion Development
```bash
cd ingestion
make install_dev_env           # Install in development mode
make generate                  # Generate Pydantic models from JSON schemas
make unit_ingestion_dev_env    # Run unit tests
make lint                      # Run pylint
make py_format                 # Format with black, isort, pycln
make static-checks             # Run type checking with basedpyright
```

### Full Local Environment
```bash
./docker/run_local_docker.sh -m ui -d mysql        # Complete local setup with UI
./docker/run_local_docker.sh -m no-ui -d postgresql # Backend only with PostgreSQL
./docker/run_local_docker.sh -s true               # Skip Maven build step
```

### Testing
```bash
make run_e2e_tests             # Full E2E test suite
make unit_ingestion            # Python unit tests with coverage
yarn test:coverage             # Frontend test coverage
```

## Code Generation and Schemas

OpenMetadata uses a schema-first approach with JSON Schema definitions driving code generation:

```bash
make generate                  # Generate all models from schemas
make py_antlr                  # Generate Python ANTLR parsers
make js_antlr                  # Generate JavaScript ANTLR parsers
yarn parse-schema              # Parse JSON schemas for frontend
```

## Key Directories

- `openmetadata-service/` - Core Java backend services and REST APIs
- `openmetadata-ui/src/main/resources/ui/` - React frontend application
- `ingestion/` - Python ingestion framework with connectors
- `openmetadata-spec/` - JSON Schema specifications for all entities
- `bootstrap/sql/` - Database schema migrations and sample data
- `conf/` - Configuration files for different environments
- `docker/` - Docker configurations for local and production deployment

## Development Workflow

1. **Schema Changes**: Modify JSON schemas in `openmetadata-spec/`, then run `mvn clean install` on openmetadata-spec to update models
2. **Backend**: Develop in Java using Dropwizard patterns, test with `mvn test`  
3. **Frontend**: Use React/TypeScript with Ant Design components, test with Jest/Playwright
4. **Ingestion**: Python connectors follow plugin pattern, use `make install_dev_env` for development
5. **Full Testing**: Use `make run_e2e_tests` before major changes

## Database and Migrations

- Flyway handles schema migrations in `bootstrap/sql/migrations/`
- Use Docker containers for local database setup
- Default MySQL, PostgreSQL supported as alternative
- Sample data loaded automatically in development environment

## Security and Authentication

- JWT-based authentication with OAuth2/SAML support
- Role-based access control defined in Java entities
- Security configurations in `conf/openmetadata.yaml`
- Never commit secrets - use environment variables or secure vaults