# OpenMetadata - GitHub Copilot Development Instructions

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

OpenMetadata is a unified metadata platform for data discovery, data observability, and data governance. This is a multi-module project with Java backend services, React frontend, Python ingestion framework, and comprehensive Docker infrastructure.

## Architecture Overview
- **Backend**: Java 21 + Dropwizard REST API framework, multi-module Maven project
- **Frontend**: React + TypeScript + Ant Design, built with Webpack and Yarn
- **Ingestion**: Python 3.9-3.11 with Pydantic 2.x, 75+ data source connectors  
- **Database**: MySQL (default) or PostgreSQL with Flyway migrations
- **Search**: Elasticsearch 7.17+ or OpenSearch 2.6+ for metadata discovery
- **Infrastructure**: Apache Airflow for workflow orchestration

## Prerequisites and Setup

### Required Software Versions
- **Python**: 3.9, 3.10, or 3.11 (NOT 3.12+)
- **Java**: 21 (OpenJDK 21.0.8+)
- **Maven**: 3.6-3.9 (tested with 3.9.11)
- **Node.js**: 18 (LTS, NOT 20+)
- **Yarn**: 1.22+
- **Docker**: 20+
- **ANTLR**: 4.9.2
- **jq**: Any version

### Prerequisites Check
Run this FIRST to verify your environment:
```bash
make prerequisites
```

### Install Missing Prerequisites
```bash
# Install Java 21 (Ubuntu/Debian)
sudo apt-get install -y openjdk-21-jdk
sudo update-alternatives --set java /usr/lib/jvm/java-21-openjdk-amd64/bin/java
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install ANTLR CLI
make install_antlr_cli
```

## Bootstrap and Build Commands

### Full Build Process
**NEVER CANCEL: Build takes 45-60 minutes. ALWAYS set timeout to 70+ minutes.**
```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
mvn clean package -DskipTests
```

### Backend Only Build  
**NEVER CANCEL: Takes ~15 minutes. Set timeout to 25+ minutes.**
```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
mvn clean package -DskipTests -DonlyBackend -pl !openmetadata-ui
```

### Frontend Dependencies and Build
**NEVER CANCEL: Yarn install takes ~10 minutes. Set timeout to 15+ minutes.**
**CRITICAL: ANTLR must be installed first or build will fail.**
```bash
# Install ANTLR CLI first (required for frontend)
make install_antlr_cli

cd openmetadata-ui/src/main/resources/ui
yarn install --frozen-lockfile  # Automatically runs build-check (requires ANTLR)
yarn build  # Takes ~5 minutes, set timeout to 10+ minutes
```

### If ANTLR Installation Fails (Network Issues)
```bash
cd openmetadata-ui/src/main/resources/ui
yarn install --frozen-lockfile --ignore-scripts  # Skip build-check temporarily
# Tests will fail until ANTLR is properly installed and schemas are generated
```

### Python Ingestion Development Setup
**NEVER CANCEL: Takes 30-45 minutes. Set timeout to 60+ minutes.**
```bash
make install_dev_env  # Install all Python dependencies for development
make generate         # Generate Pydantic models from JSON schemas
```

### Code Generation (Required After Schema Changes)
```bash
make generate         # Generate all models from schemas - takes ~5 minutes
make py_antlr         # Generate Python ANTLR parsers
make js_antlr         # Generate JavaScript ANTLR parsers
```

## Development Workflow

### Local Development Environment
```bash
# Complete local setup with UI and MySQL (PREFERRED)
./docker/run_local_docker.sh -m ui -d mysql

# Backend only with PostgreSQL
./docker/run_local_docker.sh -m no-ui -d postgresql

# Skip Maven build step if already built
./docker/run_local_docker.sh -s true
```

### Frontend Development
```bash
cd openmetadata-ui/src/main/resources/ui
yarn start  # Starts dev server on localhost:3000
```

### Backend Development  
```bash
# Start backend services with Docker
./docker/run_local_docker.sh -m no-ui -d mysql

# Or build and run manually
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
mvn clean package -DonlyBackend -pl !openmetadata-ui
```

## Testing Commands

### Java Tests
**NEVER CANCEL: Takes 20-30 minutes. Set timeout to 45+ minutes.**
```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
mvn test
```

### Frontend Tests
**CRITICAL: Tests require ANTLR-generated files and JSON schemas.**
```bash
cd openmetadata-ui/src/main/resources/ui
# Ensure schemas and ANTLR files are generated first
yarn run build-check           # Generate required files (requires ANTLR)
yarn test                      # Jest unit tests - takes ~5 minutes
yarn test:coverage            # With coverage - takes ~8 minutes  
yarn playwright:run            # E2E tests - takes 15-25 minutes, set timeout to 35+ minutes
```

**If tests fail with missing modules**: Run `make generate` and `yarn run build-check` first.

### Python Tests
**NEVER CANCEL: Takes 15-20 minutes. Set timeout to 30+ minutes.**
```bash
make unit_ingestion_dev_env  # Unit tests for local development
make unit_ingestion          # Full unit test suite
make run_ometa_integration_tests  # Integration tests
```

### Full E2E Test Suite
**NEVER CANCEL: Takes 45-90 minutes. Set timeout to 120+ minutes.**
```bash
make run_e2e_tests
```

## Code Quality and Formatting

### Java
```bash
mvn spotless:apply    # ALWAYS run this when modifying .java files
mvn verify            # Run integration tests
```

### Frontend
```bash
cd openmetadata-ui/src/main/resources/ui
yarn lint:fix         # Fix ESLint issues
yarn pretty           # Format with Prettier  
yarn license-header-fix  # Add license headers
```

### Python
```bash
make py_format        # Format with black, isort, pycln
make lint             # Run pylint
make static-checks    # Run type checking with basedpyright
```

## Validation Scenarios

### CRITICAL: Manual Validation Required
After making changes, ALWAYS test complete user scenarios:

1. **Backend API Validation**: 
   - Start services with `./docker/run_local_docker.sh -m no-ui -d mysql`
   - Verify API responds at `http://localhost:8585/api/v1/health`
   - Test login flow with default admin credentials

2. **Frontend UI Validation**:
   - Start UI with `yarn start` (after backend is running)
   - Navigate to `http://localhost:3000`
   - Test login, data discovery, and basic navigation flows
   - Create a test entity (table, dashboard, etc.)

3. **Ingestion Framework Validation**:
   - Run `metadata list --help` to verify CLI works
   - Test sample connector workflow if making ingestion changes

## Common Issues and Workarounds

### Build Failures
- **Java version error**: Ensure `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64` is exported
- **ANTLR missing**: Install with `make install_antlr_cli` - **REQUIRED for frontend tests and builds**
- **Frontend tests fail with missing modules**: Run `make generate` and `yarn run build-check` first
- **Python dependency conflicts**: Use Python 3.9-3.11, NOT 3.12+
- **Node version issues**: Use Node 18 LTS, NOT Node 20+

### Network Timeouts
- **Pip install timeouts**: Retry `make install_dev_env` with increased timeouts
- **Yarn install issues**: Use `yarn install --frozen-lockfile --network-timeout 100000`
- **Maven dependency timeouts**: Retry build, Maven will resume from last successful module

### Docker Issues
- **Port conflicts**: Stop existing containers with `docker-compose down`
- **Volume issues**: Clean with `./docker/run_local_docker.sh -r true`
- **Memory issues**: Increase Docker memory allocation to 4GB+ for full builds

## Key Directories and Files

### Repository Structure
```
├── openmetadata-service/        # Core Java backend services and REST APIs
├── openmetadata-ui/src/main/resources/ui/  # React frontend application  
├── ingestion/                   # Python ingestion framework with connectors
├── openmetadata-spec/           # JSON Schema specifications for all entities
├── bootstrap/sql/               # Database schema migrations and sample data
├── conf/                        # Configuration files for different environments
├── docker/                      # Docker configurations for local and production
├── common/                      # Shared Java libraries
├── openmetadata-dist/           # Distribution and packaging
├── openmetadata-clients/        # Client libraries
└── scripts/                     # Build and utility scripts
```

### Frequently Modified Files
- `openmetadata-spec/src/main/resources/json/schema/` - Entity definitions
- `openmetadata-service/src/main/java/org/openmetadata/service/` - Backend services
- `openmetadata-ui/src/main/resources/ui/src/` - Frontend components
- `ingestion/src/metadata/ingestion/` - Python connectors
- `bootstrap/sql/migrations/` - Database migrations

## CI/CD Integration

### Before Committing
ALWAYS run these validation steps:
```bash
# Java formatting
mvn spotless:apply

# Frontend linting
cd openmetadata-ui/src/main/resources/ui && yarn lint:fix

# Python formatting  
make py_format

# Run tests relevant to your changes
mvn test                     # For Java changes
yarn test                    # For UI changes  
make unit_ingestion_dev_env  # For Python changes
```

### CI Build Expectations
- **Maven Build**: 45-60 minutes
- **Playwright E2E Tests**: 30-45 minutes  
- **Python Tests**: 15-25 minutes
- **Full CI Pipeline**: 90-120 minutes

## Performance Tips

- **First Build Required**: Run `mvn clean package -DskipTests` on fresh checkout - `mvn compile` alone will fail
- **Parallel Builds**: Maven automatically uses parallel builds
- **Incremental Builds**: Use `mvn compile` for faster iteration AFTER initial full build
- **Selective Testing**: Use `mvn test -Dtest=ClassName` for specific test classes
- **Docker Layer Caching**: Reuse containers between builds when possible
- **Yarn Cache**: Dependencies are cached globally to speed up installs

## Security Notes

- Never commit secrets to source code
- Use environment variables for configuration
- Default admin token expires, generate new ones for production
- Database migrations are automatically applied on startup
- HTTPS is required for production deployments

Remember: This is a complex multi-language project. Build times are substantial. NEVER cancel long-running builds or tests. Always validate changes with real user scenarios before considering the work complete.