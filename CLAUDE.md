# CLAUDE.md - Advanced AI Development Guide

This comprehensive guide provides advanced AI development intelligence for Claude Code when working with the OpenMetadata repository. It serves as the primary reference for understanding complex workflows, architectural patterns, and AI-assisted development strategies.

## About OpenMetadata

OpenMetadata is a **unified metadata platform** for data discovery, data observability, and data governance. This enterprise-grade, multi-module project combines sophisticated backend services, modern frontend applications, and a comprehensive Python ingestion framework with advanced Docker orchestration.

**For comprehensive repository structure and patterns, refer to [AGENTS.md](./AGENTS.md) which provides detailed AI agent guidance.**

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

## Pull Request Guidelines

OpenMetadata follows a strict PR process to maintain code quality and facilitate efficient reviews.

### PR Best Practices
- **Small, Focused PRs**: Each PR should address a single concern (bug fix, feature, or refactor)
- **PR Size Recommendations**:
  - **Ideal**: 1-3 files changed, <200 lines
  - **Acceptable**: 4-10 files, <500 lines
  - **Requires justification**: 10+ files or 500+ lines
- **PR Title Format**: `[Component] Brief description (fixes #issue)`
  - Examples: `[Ingestion] Fix BigQuery schema parsing (fixes #1234)`
  - Components: ingestion, service, ui, spec, docs

### Stacked PRs for Complex Features
When implementing large features, break them into logical increments:

```bash
# Example workflow for a new connector
git checkout -b feature/new-connector-base
# Implement base classes and interfaces
git commit -m "feat(ingestion): Add base classes for new connector"

git checkout -b feature/new-connector-metadata
# Implement metadata extraction
git commit -m "feat(ingestion): Add metadata extraction for new connector"

git checkout -b feature/new-connector-lineage
# Implement lineage extraction
git commit -m "feat(ingestion): Add lineage support for new connector"
```

Each PR should:
- Be independently reviewable and testable
- Pass all CI checks
- Include relevant tests
- Update documentation if needed

### PR Description Template
```markdown
## What
Brief description of changes

## Why
Business/technical justification

## How
Implementation approach and key decisions

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Breaking Changes
List any breaking changes or "None"
```

## Commit Guidelines

Follow conventional commits format for better changelog generation:

### Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Scopes
- `ingestion`: Python ingestion framework
- `service`: Java backend services
- `ui`: React frontend
- `spec`: JSON Schema specifications
- `deployment`: Docker, Kubernetes, etc.

### Examples
```bash
fix(ingestion): Handle null values in BigQuery connector

Previously, null values in ARRAY columns caused parsing failures.
This fix adds proper null handling for complex types.

Fixes #1234
```

```bash
feat(ui): Add bulk edit capability to data assets

Users can now select multiple tables and update tags,
owners, and tiers in a single operation.
```

## Branch Strategy

- **Main Branch**: `main` - production-ready code
- **Feature Branches**: `feature/issue-number-brief-description`
- **Bugfix Branches**: `fix/issue-number-brief-description`
- **Release Branches**: `release/x.y.z`
- **Hotfix Branches**: `hotfix/issue-number-brief-description`

Always:
- Branch from `main` for new features
- Keep branches up to date with `main`
- Delete branches after PR merge

## Testing Strategy

### Test Coverage Requirements
- **Backend**: Minimum 80% coverage for new code
- **Frontend**: Jest unit tests + Playwright E2E tests
- **Ingestion**: pytest with mocked connections

### Testing Commands by Component

#### Backend Testing
```bash
# Run all tests
mvn test

# Test specific module
mvn test -pl openmetadata-service

# Test with specific database
mvn test -P mysql-tests
mvn test -P postgres-tests

# Run specific test class
mvn test -Dtest=TableResourceTest

# Run integration tests
mvn verify
```

#### Frontend Testing
```bash
cd openmetadata-ui/src/main/resources/ui

# Unit tests
yarn test
yarn test:watch
yarn test:coverage

# E2E tests
yarn playwright:run
yarn playwright:open  # Interactive mode
yarn playwright:debug

# Specific test file
yarn test Table.test.tsx
```

#### Ingestion Testing
```bash
cd ingestion

# All unit tests
make unit_ingestion

# Specific test file
python -m pytest tests/unit/test_bigquery.py

# With coverage
make unit_ingestion_cov

# Integration tests (requires services)
make integration_tests

# Test markers
python -m pytest -m "not integration"
```

## Advanced AI Development Intelligence Framework

OpenMetadata implements a sophisticated **6-phase AI development framework** designed to ensure enterprise-grade quality, security, and maintainability. This framework serves as a structured guideline, and phases may be revisited or adapted iteratively based on project needs, with each phase building comprehensive understanding for intelligent development decisions.

### AI Development Methodology

**Core Principles:**
1. **Context-Driven Development**: Every change must understand the full system context
2. **Pattern Recognition**: Leverage existing architectural patterns and conventions
3. **Security-First Approach**: Security considerations integrated into every phase
4. **Performance Awareness**: Performance implications assessed at each stage
5. **Test-Driven Validation**: Comprehensive testing strategy from unit to integration
6. **Documentation Completeness**: Self-documenting code with strategic comments

### Phase 1: Repository Discovery & Analysis
**Reference**: `AI/phase1-discovery.md` - Repository structure, technology stack, and dependency analysis
- Understand repository architecture and patterns
- Analyze existing code conventions and standards  
- Identify relevant modules and integration points
- Review dependency management and build systems
- Assess development environment requirements

### Phase 2: Code Architecture Understanding  
**Reference**: `AI/phase2-architecture.md` - Design patterns, API surface, and system boundaries
- Map entry points and module dependencies
- Understand design patterns and architectural decisions
- Analyze API surface and authentication flows
- Review database schema and entity relationships
- Identify performance hotspots and caching strategies

### Phase 3: Code Quality Assessment
**Reference**: `AI/phase3-quality.md` - Code quality metrics, security analysis, and technical debt
- Analyze code complexity and duplication patterns
- Review naming conventions and documentation coverage
- Audit TODO/FIXME items and deprecated code
- Assess security vulnerability patterns and type safety
- Evaluate test quality and linting compliance

### Phase 4: Change Pattern Analysis
**Reference**: `AI/phase4-changes.md` - Commit patterns, development velocity, and team ownership
- Study commit message patterns and PR size distribution
- Identify hot files and co-change relationships
- Analyze bug introduction points and fix patterns
- Review refactoring patterns and breaking changes
- Understand code ownership and collaboration patterns

### Phase 5: Runtime Behavior Analysis
**Reference**: `AI/phase5-runtime.md` - Performance profiling, resource management, and monitoring
- Analyze performance profiling points and memory patterns
- Understand concurrency patterns and resource management
- Map event flows and external API dependencies
- Review session management and health check endpoints
- Assess graceful shutdown and fault tolerance mechanisms

### Phase 6: Integration Analysis
**Reference**: `AI/phase6-integrations.md` - Third-party integrations, APIs, and external systems
- Review 75+ data source connectors and integration patterns
- Understand webhook implementations and SDK usage
- Analyze authentication providers and notification systems
- Assess search implementation and analytics integration
- Review WebSocket architecture and data export capabilities

### Implementation Testing Requirements

After completing the analysis phases, follow these mandatory testing phases:

#### Unit Testing (Required)
- Run component-specific unit tests immediately after code creation
- Backend: `mvn test` for Java components
- Frontend: `yarn test` for React components  
- Ingestion: `make unit_ingestion_dev_env` for Python connectors
- Fix any failing tests before proceeding to next phase

#### Integration Testing (Required)
- Test component interactions and API endpoints
- Backend: `mvn verify` for integration tests
- Database: Test with both MySQL and PostgreSQL profiles
- API: Test REST endpoints with proper authentication
- Fix integration issues before proceeding

#### Code Quality and Standards (Required)
- Apply formatting and linting standards
- Java: `mvn spotless:apply` (mandatory for Java files)
- Frontend: `yarn lint:fix` for TypeScript/React
- Python: `make py_format` and `make lint`
- Ensure code passes static analysis checks

#### End-to-End Testing (Required)
- Run full E2E test suite: `make run_e2e_tests`
- Test complete user workflows through UI
- Verify metadata ingestion pipelines work end-to-end
- Test with sample data in local Docker environment

#### Security and Performance Validation (Required)
- Check for performance regressions
- Validate security configurations and authentication flows
- Test with realistic data volumes when applicable
- Verify no secrets are committed to repository
- **SQL Injection Testing**: Reference `AI/security-sql-injection-fix.md` for search endpoint security requirements

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

### SQL Injection Prevention in Search Endpoints

**Important**: OpenMetadata search endpoints were previously vulnerable to SQL injection attacks through query parameters. A centralized security fix has been implemented to protect all search functionality.

#### Vulnerability Background
- **Affected Endpoints**: 42 vulnerable instances across `/v1/search/query`, `/v1/search/nlq/query`, `/v1/search/aggregate`, `/v1/search/entityTypeCounts`, and related endpoints
- **Root Cause**: Direct parsing of user input via `SearchSourceBuilder.fromXContent()` without sanitization
- **Attack Vectors**: Boolean-based blind SQL injection, time-based SQL injection, union-based injection, comment injection

#### Security Implementation
The fix implements centralized input sanitization in `SearchUtils.sanitizeQueryParameter()`:

```java
// All search query parameters are now sanitized before parsing
String sanitizedFilter = SearchUtils.sanitizeQueryParameter(queryFilter);
```

**Key Security Features:**
- **Pattern-based Detection**: Removes SQL injection patterns including `' AND `, `' OR `, `--`, `/*`, `union select`, etc.
- **Case-insensitive Matching**: Catches variations like `' and '`, `' AND '`, `' And '`
- **Length Limits**: Enforces 10,000 character limit to prevent resource exhaustion attacks
- **Legitimate Query Preservation**: Valid Elasticsearch/OpenSearch JSON queries remain unchanged

#### Modified Files
- `SearchUtils.java:233-283` - Central sanitization method with comprehensive pattern blocking
- `EsUtils.java:280-306` - Elasticsearch query sanitization integration  
- `OsUtils.java:280-306` - OpenSearch query sanitization integration
- `SearchUtilsTest.java` - 30 unit tests covering all attack vectors and edge cases
- `SearchResourceTest.java` - 6 integration tests for vulnerable endpoints

#### Developer Guidelines
1. **Never bypass sanitization** - All search query parameters must go through `SearchUtils.sanitizeQueryParameter()`
2. **Add tests for new endpoints** - Any new search endpoints must include SQL injection tests
3. **Monitor for patterns** - Watch for new SQL injection patterns in security reports
4. **Regular security reviews** - Include search endpoint security in code reviews

#### Testing Coverage
- **Unit Tests**: 95%+ coverage including malicious pattern detection, performance, and boundary conditions
- **Integration Tests**: All vulnerable endpoints tested with actual SQL injection payloads
- **Security Validation**: Patterns based on OWASP guidelines and security testing reports

## Code Generation Standards

### Comments Policy
- **Do NOT add unnecessary comments** - write self-documenting code
- Only include comments for:
    - Complex business logic that isn't obvious
    - Non-obvious algorithms or workarounds
    - Public API JavaDoc documentation
    - TODO/FIXME with ticket references
- Avoid obvious comments like `// increment counter` or `// create new user`

### Java Code Requirements
- **Always mention** running `mvn spotless:apply` when generating/modifying .java files
- Use clear, descriptive variable and method names instead of comments
- Follow existing project patterns and conventions
- Generate production-ready code, not tutorial code

### Response Format
- Provide clean code blocks without unnecessary explanations
- Assume readers are experienced developers
- Focus on functionality over education

## Debugging & Troubleshooting

### Local Debugging Setup

#### IntelliJ IDEA (Backend)
1. Create Remote JVM Debug configuration
2. Set debugger port: 5005
3. Start server with debug flags:
   ```bash
   java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 \
        -jar openmetadata-service/target/openmetadata-service-*.jar \
        server conf/openmetadata.yaml
   ```

#### VS Code
`.vscode/launch.json` for Python debugging:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Ingestion",
      "type": "python",
      "request": "launch",
      "module": "metadata.cmd",
      "args": ["ingest", "-c", "path/to/config.yaml"]
    }
  ]
}
```

### Common Issues & Solutions

#### Maven Dependencies
```bash
# Clear Maven cache
rm -rf ~/.m2/repository
mvn clean install -DskipTests

# Dependency conflicts
mvn dependency:tree
mvn dependency:analyze
```

#### Node/Yarn Issues
```bash
# Clear caches
rm -rf node_modules
rm yarn.lock
yarn cache clean
yarn install --frozen-lockfile
```

#### Docker Issues
```bash
# Increase Docker memory (minimum 8GB)
# Clean up resources
docker system prune -a
docker volume prune

# Reset local environment
./docker/run_local_docker.sh --reset
```

#### Database Connection Issues
- Check `conf/openmetadata.yaml` for correct credentials
- Verify database is running: `docker ps`
- Test connection: `mysql -h localhost -P 3306 -u openmetadata_user -p`

### Logging & Monitoring

#### Log Locations
- Backend: `logs/openmetadata.log`
- Ingestion: Configure with `--log-level DEBUG`
- Frontend: Browser console

#### Log Configuration
```yaml
# conf/openmetadata.yaml
logging:
  level: DEBUG
  loggers:
    org.openmetadata: DEBUG
    io.dropwizard: INFO
```

#### Debug Endpoints
- Health check: `http://localhost:8585/healthcheck`
- Metrics: `http://localhost:8585/metrics`
- API docs: `http://localhost:8585/swagger`

## Performance Guidelines

### Backend Performance

#### Query Optimization
- Use database indexes effectively
- Implement pagination for list endpoints
- Use projections to fetch only required fields
- Cache frequently accessed data

#### Connection Pooling
```yaml
# conf/openmetadata.yaml
database:
  driverClass: com.mysql.cj.jdbc.Driver
  user: openmetadata_user
  password: openmetadata_password
  url: jdbc:mysql://localhost:3306/openmetadata_db
  properties:
    maxWaitForConnection: 1s
    validationQuery: "SELECT 1"
    minSize: 10
    maxSize: 30
    checkConnectionWhileIdle: true
```

### Frontend Performance

#### Bundle Optimization
```bash
# Analyze bundle size
yarn analyze

# Build with production optimizations
yarn build:prod
```

#### Performance Best Practices
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Lazy load routes and components
- Optimize images and assets

### Ingestion Performance

#### Batch Processing
```yaml
# ingestion config
source:
  config:
    batch_size: 1000  # Adjust based on memory
    scheme: mysql+pymysql
```

#### Memory Management
```python
# Use generators for large datasets
def fetch_tables():
    for batch in get_table_batches():
        for table in batch:
            yield table
```

## Dependency Management

### Maven Dependencies

#### Adding Dependencies
1. Add to appropriate `pom.xml`
2. Check for conflicts: `mvn dependency:tree`
3. Run security scan: `mvn org.owasp:dependency-check-maven:check`
4. Update parent POM version if needed

#### Version Management
- Use property placeholders in parent POM
- Align versions across modules
- Regular updates: `mvn versions:display-dependency-updates`

### NPM/Yarn Dependencies

#### Adding Frontend Dependencies
```bash
cd openmetadata-ui/src/main/resources/ui
yarn add package-name
yarn add -D dev-package-name  # Dev dependency
```

#### Security Audits
```bash
yarn audit
yarn audit --fix
npm audit fix --force  # Use carefully
```

### Python Dependencies

#### Using pyproject.toml
```toml
[project]
dependencies = [
    "pydantic>=2.0.0,<3",
    "sqlalchemy>=1.4.0,<2",
]

[project.optional-dependencies]
bigquery = ["google-cloud-bigquery>=3.0.0"]
snowflake = ["snowflake-connector-python>=3.0.0"]
```

#### Installing Subsets
```bash
pip install ".[bigquery,snowflake]"
```

## CI/CD Workflow

### GitHub Actions

#### PR Checks
- Java tests (MySQL and PostgreSQL)
- Python tests and linting
- Frontend tests and build
- Docker image build
- Security scanning

#### Debugging Failed CI
1. Check "Actions" tab in GitHub
2. Click on failed workflow
3. Expand failed step for logs
4. Run locally to reproduce:
   ```bash
   act -j test  # Uses nektos/act
   ```

### Release Process

1. **Update Version**
   ```bash
   make update_all RELEASE_VERSION=1.5.0
   ```

2. **Create Release Branch**
   ```bash
   git checkout -b release/1.5.0
   git push origin release/1.5.0
   ```

3. **Tag Release**
   ```bash
   git tag 1.5.0
   git push origin 1.5.0
   ```

### Docker Image Building

#### Multi-stage Build
```dockerfile
# Build stage
FROM maven:3.8-openjdk-17 AS builder
COPY . /app
WORKDIR /app
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:17-jre-slim
COPY --from=builder /app/target/*.jar app.jar
```

## Code Review Guidelines

### Review Checklist
- [ ] Code follows project patterns and conventions
- [ ] Tests included and passing
- [ ] Documentation updated (if applicable)
- [ ] No secrets or sensitive data
- [ ] Performance impact considered
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] Breaking changes documented

### Review Best Practices
- **Response Time**: Target 24-48 hours
- **Approval Requirements**: 2 approvals for main branch
- **Focus Areas**:
  - Business logic correctness
  - Edge cases handled
  - Security considerations
  - Performance implications
  - Code maintainability

## Integration Development

### New Connector Development

1. **Use Connector Template**
   ```bash
   cd ingestion/src/metadata/ingestion/source
   cp -r database/sample database/myconnector
   ```

2. **Implement Required Interfaces**
   - `DatabaseServiceSource`
   - `check_connection()`
   - `get_tables()`
   - `get_table_columns()`
   - `yield_table()`

3. **Test with Docker**
   ```yaml
   # docker-compose.yml
   services:
     mydb:
       image: mydb:latest
       ports:
         - "5432:5432"
   ```

### Schema Extension

1. **Add New Entity Type**
   ```json
   // openmetadata-spec/src/main/resources/json/schema/entity/data/myEntity.json
   {
     "$id": "https://open-metadata.org/schema/entity/data/myEntity",
     "$schema": "http://json-schema.org/draft-07/schema#",
     "title": "MyEntity",
     "type": "object",
     "properties": {
       // Define properties
     }
   }
   ```

2. **Generate Code**
   ```bash
   mvn clean install -pl openmetadata-spec
   make generate
   ```

### API Development

#### REST Endpoint Pattern
```java
@Path("/v1/myentities")
@Api(value = "MyEntities")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MyEntityResource {
    @GET
    @Path("/{id}")
    public Response get(@PathParam("id") UUID id) {
        // Implementation
    }
}
```

## Advanced AI Development Requirements & Strategies

### AI Task Management Intelligence

**MANDATORY: Advanced TodoWrite Usage**
For all non-trivial tasks (3+ steps), implement intelligent task tracking:

```markdown
# AI Task Breakdown Strategy
1. **Discovery Phase**: Repository analysis and context gathering
2. **Design Phase**: Architectural planning and pattern identification  
3. **Implementation Phase**: Incremental development with validation
4. **Testing Phase**: Multi-layer testing strategy execution
5. **Integration Phase**: System integration and performance validation
6. **Documentation Phase**: Code documentation and knowledge transfer
```

**Intelligent Development Approach:**
- **Atomic Changes**: Each PR represents a complete, independent feature or fix
- **Progressive Enhancement**: Build complexity gradually with validation at each step
- **Pattern Consistency**: Maintain consistency with existing codebase patterns
- **Performance Optimization**: Consider performance implications from design phase
- **Security Integration**: Security considerations embedded throughout development

**AI Framework Compliance (Non-Negotiable):**
Every code modification MUST complete all 6 phases sequentially. Phase completion requires:
- ✅ Comprehensive analysis and documentation
- ✅ Pattern identification and architectural alignment
- ✅ Quality metrics validation
- ✅ Security and performance assessment
- ✅ Testing strategy implementation
- ✅ Integration validation and monitoring setup

### AI Code Intelligence Patterns

#### Context-Aware Development
```bash
# AI Development Workflow
1. Repository Context Analysis
   - Understand module dependencies and relationships
   - Identify existing patterns and conventions
   - Assess impact scope and integration points

2. Architectural Intelligence
   - Map design patterns and architectural decisions
   - Understand API contracts and data flows
   - Identify performance and scalability considerations

3. Quality Assessment
   - Analyze code complexity and maintainability
   - Review security patterns and vulnerability surfaces
   - Evaluate test coverage and quality metrics

4. Change Impact Analysis
   - Study historical change patterns and hotspots
   - Understand team ownership and collaboration patterns
   - Assess deployment and operational impacts

5. Runtime Behavior Understanding
   - Analyze performance characteristics and bottlenecks
   - Understand resource management and scaling patterns
   - Map monitoring and observability requirements

6. Integration Ecosystem Mapping
   - Understand external dependencies and integration points
   - Assess third-party service dependencies
   - Map data flow and transformation requirements
```

#### AI-Driven Code Generation Standards

**Java Development Intelligence:**
```java
// AI Code Generation Pattern for OpenMetadata
// 1. Always use existing project patterns
// 2. Implement proper error handling and validation
// 3. Include comprehensive logging for debugging
// 4. Follow security best practices

@Path("/v1/entities")
@Api(value = "EntityManagement", tags = "entities")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EntityResource extends CrudResource<Entity> {
    
    @GET
    @Path("/{id}")
    @Operation(summary = "Get entity by ID", description = "Retrieve entity details")
    @Parameter(description = "Entity ID", schema = @Schema(type = "string", format = "uuid"))
    public Response getEntity(
            @PathParam("id") UUID id,
            @Context UriInfo uriInfo,
            @Context SecurityContext securityContext) {
        
        // Input validation
        Objects.requireNonNull(id, "Entity ID cannot be null");
        
        // Security context validation
        validateAccess(securityContext, READ_PERMISSION);
        
        try {
            Entity entity = entityService.get(id, getFields(uriInfo));
            return Response.ok(entity).build();
        } catch (EntityNotFoundException e) {
            LOG.warn("Entity not found: {}", id, e);
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(new ErrorResponse("Entity not found", id.toString()))
                          .build();
        } catch (Exception e) {
            LOG.error("Error retrieving entity: {}", id, e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(new ErrorResponse("Internal server error", e.getMessage()))
                          .build();
        }
    }
}

// Always run: mvn spotless:apply
```

**Python Development Intelligence:**
```python
# AI Code Generation Pattern for OpenMetadata Ingestion
from typing import Optional, List, Iterator, Dict, Any
from pydantic import BaseModel, Field, validator
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

class EnhancedDatabaseConnection(BaseModel):
    """Enhanced database connection with AI-optimized validation."""
    
    host: str = Field(..., description="Database host")
    port: int = Field(default=5432, description="Database port")
    username: Optional[str] = Field(None, description="Database username")
    password: Optional[str] = Field(None, description="Database password")
    database: str = Field(..., description="Database name")
    
    @validator('port')
    def validate_port(cls, v):
        if not 1 <= v <= 65535:
            raise ValueError('Port must be between 1 and 65535')
        return v
    
    @validator('host')
    def validate_host(cls, v):
        if not v or not v.strip():
            raise ValueError('Host cannot be empty')
        return v.strip()

class IntelligentDatabaseSource(CommonDbSourceService):
    """AI-enhanced database source with intelligent error handling."""
    
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        """Initialize with enhanced error handling and logging."""
        super().__init__(config, metadata)
        self.connection_validated = False
        
    def get_database_names(self) -> Iterator[str]:
        """Yield database names with intelligent error recovery."""
        try:
            # Implementation with retry logic and connection validation
            databases = self._fetch_databases_with_retry()
            for db_name in databases:
                if self._is_valid_database(db_name):
                    yield db_name
                    
        except Exception as exc:
            logger.error(f"Error fetching database names: {exc}")
            self.status.failed(
                name="Database Discovery",
                error=f"Failed to fetch databases: {str(exc)}",
                stack_trace=traceback.format_exc()
            )
            
    def _fetch_databases_with_retry(self, max_retries: int = 3) -> List[str]:
        """Fetch databases with exponential backoff retry."""
        for attempt in range(max_retries):
            try:
                return self._execute_database_query()
            except ConnectionError as e:
                if attempt == max_retries - 1:
                    raise
                wait_time = 2 ** attempt
                logger.warning(f"Connection failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
                
# Always run: make py_format && make lint
```

**TypeScript/React Development Intelligence:**
```typescript
// AI Code Generation Pattern for OpenMetadata UI
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Space, message, Spin } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Entity } from '../../../generated/entity/data/entity';
import { EntityService } from '../../../axiosAPIs/entityAPI';
import { getErrorMessage } from '../../../utils/CommonUtils';
import { usePaging } from '../../../hooks/paging/usePaging';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';

interface EntityListProps {
  entityType: string;
  onEntitySelect?: (entity: Entity) => void;
  onEntityCreate?: () => void;
}

const EntityList: React.FC<EntityListProps> = ({
  entityType,
  onEntitySelect,
  onEntityCreate
}) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const {
    currentPage,
    pageSize,
    paging,
    handlePagingChange,
    showPagination
  } = usePaging();

  // Memoized columns configuration
  const columns = useMemo(() => [
    {
      title: t('label.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Entity) => (
        <Button
          type="link"
          onClick={() => onEntitySelect?.(record)}
          data-testid={`entity-link-${record.name}`}>
          {name}
        </Button>
      ),
    },
    {
      title: t('label.description'),
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => description || '—',
    },
    {
      title: t('label.updated-at'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (timestamp: number) => new Date(timestamp).toLocaleDateString(),
    },
  ], [onEntitySelect, t]);

  // Optimized fetch function with error handling
  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await EntityService.getEntities({
        entityType,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });
      
      setEntities(response.data || []);
      handlePagingChange(response.paging);
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      message.error(t('server.entity-fetch-error'));
    } finally {
      setLoading(false);
    }
  }, [entityType, currentPage, pageSize, handlePagingChange, t]);

  // Initial load and refresh on dependencies
  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Error state
  if (error && !loading) {
    return (
      <ErrorPlaceHolder
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}
        errorMessage={error}
        onRetry={fetchEntities}
      />
    );
  }

  return (
    <div className="entity-list-container" data-testid="entity-list">
      <div className="entity-list-header">
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onEntityCreate}
            data-testid="add-entity-button">
            {t('label.add-entity')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchEntities}
            loading={loading}
            data-testid="refresh-button">
            {t('label.refresh')}
          </Button>
        </Space>
      </div>
      
      <Table
        columns={columns}
        dataSource={entities}
        loading={loading}
        pagination={showPagination ? {
          current: currentPage,
          pageSize: pageSize,
          total: paging.total,
          onChange: (page, size) => handlePagingChange({ ...paging, offset: (page - 1) * (size || pageSize) }),
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            t('message.showing-of-total-records', {
              from: range[0],
              to: range[1],
              total
            })
        } : false}
        rowKey="id"
        size="small"
        data-testid="entity-table"
      />
    </div>
  );
};

export default EntityList;

// Always run: yarn lint:fix
```

### AI Documentation Cross-References

The `AI/` directory contains comprehensive analysis documents that support the development framework:

- **`AI/phase1-discovery.md`**: 480+ line repository analysis covering technology stack, dependencies, and build systems
- **`AI/phase2-architecture.md`**: 348+ line architecture analysis covering design patterns, APIs, and system boundaries  
- **`AI/phase3-quality.md`**: 400+ line code quality analysis covering complexity metrics, security patterns, and technical debt
- **`AI/phase4-changes.md`**: 514+ line change pattern analysis covering development velocity, commit patterns, and team ownership
- **`AI/phase5-runtime.md`**: 397+ line runtime behavior analysis covering performance profiling, concurrency, and monitoring
- **`AI/phase6-integrations.md`**: 575+ line integration analysis covering 75+ connectors, webhooks, and third-party systems
- **`AI/security-sql-injection-fix.md`**: 304+ line security remediation guide covering SQL injection prevention in search endpoints

**Total Documentation**: 3,000+ lines of comprehensive codebase analysis and development guidance.

## Quick Reference

### Common Commands

```bash
# Backend
mvn clean install -DskipTests              # Quick build
mvn spotless:apply                         # Format code
mvn test -Dtest=SpecificTest             # Run specific test

# Frontend
yarn start                                 # Dev server
yarn build                                 # Production build
yarn lint:fix                             # Fix linting

# Ingestion
make install_dev_env                       # Setup development
make generate                              # Generate models
make unit_ingestion                        # Run tests

# Docker
./docker/run_local_docker.sh               # Full stack
./docker/run_local_docker.sh -m no-ui      # Backend only
docker compose logs -f openmetadata-server # View logs
```

### Environment Variables

```bash
# Backend
LOG_LEVEL=DEBUG
SERVER_PORT=8585
SERVER_ADMIN_PORT=8586

# Database
MYSQL_USER=openmetadata_user
MYSQL_PASSWORD=openmetadata_password
OM_DATABASE=openmetadata_db

# Authentication
OPENMETADATA_JWT_KEY_ID=Mk...  # Generate with openssl
```

### Port Mappings

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 8585 | REST API |
| Backend Admin | 8586 | Health/Metrics |
| Frontend | 3000 | React Dev Server |
| MySQL | 3306 | Database |
| Elasticsearch | 9200 | Search Engine |
| Airflow | 8080 | Workflow UI |

## AI Performance Intelligence & Optimization

### Backend Performance Optimization Patterns

#### Database Query Intelligence
```java
// AI-Optimized Database Access Patterns
@Repository
public class IntelligentEntityRepository {
    
    // Efficient pagination with performance metrics
    @SqlQuery("SELECT * FROM entity_table " +
              "WHERE (:searchTerm IS NULL OR name LIKE :searchTerm) " +
              "AND (:entityType IS NULL OR entity_type = :entityType) " +
              "ORDER BY updated_at DESC " +
              "LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(EntityMapper.class)
    List<Entity> findEntitiesOptimized(
        @Bind("searchTerm") String searchTerm,
        @Bind("entityType") String entityType,
        @Bind("limit") int limit,
        @Bind("offset") int offset
    );
    
    // Batch operations for performance
    @SqlBatch("INSERT INTO entity_table (id, name, fqn, entity_type, json, updated_at) " +
              "VALUES (:id, :name, :fullyQualifiedName, :entityType, :json, :updatedAt)")
    void batchInsert(@BindBean List<Entity> entities);
    
    // Connection pool optimization
    @SqlQuery("SELECT COUNT(*) FROM entity_table WHERE entity_type = :type")
    int getEntityCount(@Bind("type") String entityType);
}

// Caching strategy with performance monitoring
@Component
public class EntityCacheManager {
    private final Cache<String, Entity> entityCache;
    private final MeterRegistry meterRegistry;
    
    public EntityCacheManager(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.entityCache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofMinutes(15))
            .recordStats()
            .build();
        
        // Register cache metrics
        CaffeineMetrics.monitor(meterRegistry, entityCache, "entity-cache");
    }
    
    public Optional<Entity> getEntity(String key) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            return Optional.ofNullable(entityCache.getIfPresent(key));
        } finally {
            sample.stop(Timer.builder("cache.access.time")
                           .tag("cache", "entity")
                           .register(meterRegistry));
        }
    }
}
```

#### Async Processing Intelligence
```java
// AI-Enhanced Async Processing
@Service
public class EntityProcessingService {
    
    @Async("entityProcessingExecutor")
    @Retryable(value = {Exception.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public CompletableFuture<ProcessingResult> processEntityAsync(
            Entity entity, ProcessingConfig config) {
        
        MDC.put("entityId", entity.getId().toString());
        MDC.put("processingType", config.getType());
        
        try {
            // Implement intelligent processing with circuit breaker
            return CompletableFuture.completedFuture(
                processWithCircuitBreaker(entity, config)
            );
        } catch (Exception e) {
            LOG.error("Entity processing failed", e);
            return CompletableFuture.failedFuture(e);
        } finally {
            MDC.clear();
        }
    }
    
    @CircuitBreaker(name = "entity-processing", fallbackMethod = "fallbackProcessing")
    private ProcessingResult processWithCircuitBreaker(Entity entity, ProcessingConfig config) {
        // Implementation with monitoring and metrics
        return performProcessing(entity, config);
    }
}
```

### Frontend Performance Intelligence

#### React Performance Optimization
```typescript
// AI-Optimized React Component Patterns
import { memo, useMemo, useCallback, lazy, Suspense } from 'react';
import { Virtualized } from 'react-window';

// Lazy loading for large components
const EntityDetailsModal = lazy(() => import('./EntityDetailsModal'));

// Memoized component with intelligent re-rendering
const EntityTable = memo<EntityTableProps>(({ 
  entities, 
  loading, 
  onEntitySelect,
  searchTerm 
}) => {
  // Memoized filtered data
  const filteredEntities = useMemo(() => {
    if (!searchTerm) return entities;
    return entities.filter(entity => 
      entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [entities, searchTerm]);
  
  // Memoized event handlers
  const handleRowClick = useCallback((entity: Entity) => {
    onEntitySelect?.(entity);
  }, [onEntitySelect]);
  
  // Virtual scrolling for large datasets
  const renderRow = useCallback(({ index, style }) => {
    const entity = filteredEntities[index];
    return (
      <div style={style} key={entity.id}>
        <EntityRow entity={entity} onClick={handleRowClick} />
      </div>
    );
  }, [filteredEntities, handleRowClick]);
  
  if (filteredEntities.length > 100) {
    return (
      <Virtualized
        height={600}
        itemCount={filteredEntities.length}
        itemSize={50}
        width="100%">
        {renderRow}
      </Virtualized>
    );
  }
  
  return (
    <Table
      dataSource={filteredEntities}
      loading={loading}
      onRow={(record) => ({
        onClick: () => handleRowClick(record)
      })}
      scroll={{ y: 400 }}
    />
  );
});

// Performance monitoring hook
const usePerformanceMonitoring = (componentName: string) => {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes(componentName)) {
          // Send metrics to monitoring service
          analytics.track('component_performance', {
            component: componentName,
            duration: entry.duration,
            timestamp: Date.now()
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['measure'] });
    
    return () => observer.disconnect();
  }, [componentName]);
};
```

### Python Performance Intelligence

#### Efficient Data Processing
```python
# AI-Enhanced Data Processing Patterns
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import AsyncIterator, List, Optional

@dataclass
class ProcessingMetrics:
    """Performance metrics for monitoring."""
    processed_count: int = 0
    error_count: int = 0
    processing_time: float = 0.0
    memory_usage: float = 0.0

class IntelligentDataProcessor:
    """AI-enhanced data processor with performance optimization."""
    
    def __init__(self, max_workers: int = 10, batch_size: int = 1000):
        self.max_workers = max_workers
        self.batch_size = batch_size
        self.metrics = ProcessingMetrics()
        self.semaphore = asyncio.Semaphore(max_workers)
        
    async def process_entities_async(
        self, 
        entities: List[Entity],
        processor_func: callable
    ) -> AsyncIterator[ProcessedEntity]:
        """Process entities asynchronously with intelligent batching."""
        
        # Process in batches to manage memory
        for batch_start in range(0, len(entities), self.batch_size):
            batch = entities[batch_start:batch_start + self.batch_size]
            
            # Process batch concurrently
            tasks = [
                self._process_single_entity(entity, processor_func)
                for entity in batch
            ]
            
            # Yield results as they complete
            for coro in asyncio.as_completed(tasks):
                try:
                    result = await coro
                    if result:
                        self.metrics.processed_count += 1
                        yield result
                except Exception as e:
                    self.metrics.error_count += 1
                    logger.error(f"Entity processing failed: {e}")
                    
            # Memory management
            if batch_start % (self.batch_size * 10) == 0:
                await asyncio.sleep(0.1)  # Allow garbage collection
                
    async def _process_single_entity(
        self, 
        entity: Entity, 
        processor_func: callable
    ) -> Optional[ProcessedEntity]:
        """Process single entity with rate limiting and error handling."""
        async with self.semaphore:
            start_time = time.time()
            try:
                result = await processor_func(entity)
                self.metrics.processing_time += time.time() - start_time
                return result
            except Exception as e:
                logger.warning(f"Failed to process entity {entity.id}: {e}")
                return None
                
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate performance metrics report."""
        total_processed = self.metrics.processed_count + self.metrics.error_count
        return {
            "total_processed": total_processed,
            "success_rate": self.metrics.processed_count / total_processed if total_processed > 0 else 0,
            "avg_processing_time": self.metrics.processing_time / self.metrics.processed_count if self.metrics.processed_count > 0 else 0,
            "error_count": self.metrics.error_count,
            "memory_usage_mb": self.metrics.memory_usage / 1024 / 1024
        }

# Memory-efficient generator pattern
def process_large_dataset(
    connection: Any, 
    query: str, 
    chunk_size: int = 10000
) -> Iterator[Entity]:
    """Process large datasets with memory-efficient streaming."""
    offset = 0
    
    while True:
        # Fetch chunk with LIMIT/OFFSET
        chunk_query = f"{query} LIMIT {chunk_size} OFFSET {offset}"
        rows = connection.execute(chunk_query).fetchall()
        
        if not rows:
            break
            
        # Process and yield entities
        for row in rows:
            try:
                entity = transform_row_to_entity(row)
                yield entity
            except Exception as e:
                logger.error(f"Failed to transform row: {e}")
                continue
                
        offset += chunk_size
        
        # Memory management
        if offset % (chunk_size * 10) == 0:
            gc.collect()  # Force garbage collection
```

## AI Security Intelligence & Best Practices

### Advanced Authentication Patterns
```java
// AI-Enhanced Security Implementation
@Component
public class IntelligentSecurityManager {
    
    @Autowired
    private JwtTokenValidator tokenValidator;
    
    @Autowired
    private AuditLogger auditLogger;
    
    public SecurityContext validateAndCreateContext(
            HttpServletRequest request,
            String authHeader) throws SecurityException {
        
        try {
            // Extract and validate token
            String token = extractToken(authHeader);
            Claims claims = tokenValidator.validateToken(token);
            
            // Create security context with role-based permissions
            User user = createUserFromClaims(claims);
            Set<Permission> permissions = resolveUserPermissions(user);
            
            // Audit successful authentication
            auditLogger.logSuccessfulAuth(user.getId(), request.getRemoteAddr());
            
            return new OpenMetadataSecurityContext(user, permissions);
            
        } catch (JwtException e) {
            auditLogger.logFailedAuth(request.getRemoteAddr(), e.getMessage());
            throw new SecurityException("Invalid authentication token", e);
        }
    }
    
    @RateLimited(requests = 100, per = TimeUnit.MINUTES)
    public void validateApiAccess(SecurityContext context, String resource, String action) {
        User user = context.getUser();
        
        if (!hasPermission(user, resource, action)) {
            auditLogger.logUnauthorizedAccess(user.getId(), resource, action);
            throw new ForbiddenException(
                String.format("Access denied for %s on %s", action, resource)
            );
        }
    }
}

// Advanced input sanitization
@Component
public class SecurityUtils {
    
    private static final Pattern SQL_INJECTION_PATTERN = Pattern.compile(
        "(?i).*('|(\\x27)|(\\x2D\\x2D)|(%27)|(%2D%2D)|(union\\s+select)|(drop\\s+table)|" +
        "(insert\\s+into)|(delete\\s+from)|(update\\s+set)|(exec\\s*\\()|(script\\s*:)).*"
    );
    
    private static final int MAX_INPUT_LENGTH = 10000;
    
    public static String sanitizeInput(String input, String context) {
        if (input == null) {
            return "";
        }
        
        // Length validation
        if (input.length() > MAX_INPUT_LENGTH) {
            LOG.warn("Input length exceeded limit in context: {}", context);
            throw new ValidationException("Input too long");
        }
        
        // SQL injection detection
        if (SQL_INJECTION_PATTERN.matcher(input).matches()) {
            LOG.error("Potential SQL injection detected in context: {}", context);
            throw new SecurityException("Invalid input detected");
        }
        
        // XSS prevention
        String sanitized = StringEscapeUtils.escapeHtml4(input);
        
        // Additional sanitization for search contexts
        if ("search".equals(context)) {
            sanitized = sanitized.replaceAll("[<>\"'%();+]", "");
        }
        
        return sanitized.trim();
    }
}
```

### Frontend Security Intelligence
```typescript
// AI-Enhanced Frontend Security
import DOMPurify from 'dompurify';
import { encrypt, decrypt } from '../utils/encryption';

// Secure API client with intelligent error handling
class SecureAPIClient {
  private readonly baseURL: string;
  private readonly authToken: string;
  
  constructor(baseURL: string, authToken: string) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }
  
  async secureRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Input validation
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('Invalid endpoint');
    }
    
    // Sanitize endpoint
    const sanitizedEndpoint = this.sanitizeEndpoint(endpoint);
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Content-Type-Options': 'nosniff',
        ...options.headers,
      },
    };
    
    // Request body sanitization
    if (config.body && typeof config.body === 'string') {
      const parsedBody = JSON.parse(config.body);
      config.body = JSON.stringify(this.sanitizeRequestBody(parsedBody));
    }
    
    try {
      const response = await fetch(`${this.baseURL}${sanitizedEndpoint}`, config);
      
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      this.logSecurityEvent('api_request_failed', { endpoint, error: error.message });
      throw error;
    }
  }
  
  private sanitizeEndpoint(endpoint: string): string {
    // Remove potentially dangerous characters
    return endpoint.replace(/[<>"'%();+]/g, '');
  }
  
  private sanitizeRequestBody(body: any): any {
    if (typeof body === 'string') {
      return DOMPurify.sanitize(body);
    }
    
    if (Array.isArray(body)) {
      return body.map(item => this.sanitizeRequestBody(item));
    }
    
    if (body && typeof body === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(body)) {
        sanitized[key] = this.sanitizeRequestBody(value);
      }
      return sanitized;
    }
    
    return body;
  }
  
  private async handleErrorResponse(response: Response): Promise<void> {
    const error = await response.text();
    
    // Log security events for suspicious responses
    if (response.status === 403 || response.status === 401) {
      this.logSecurityEvent('unauthorized_access', {
        status: response.status,
        url: response.url
      });
    }
    
    throw new Error(`API request failed: ${response.status} ${error}`);
  }
  
  private logSecurityEvent(event: string, details: any): void {
    // Send to security monitoring service
    console.warn('Security Event:', { event, details, timestamp: new Date().toISOString() });
  }
}

// Secure local storage with encryption
class SecureStorage {
  private static readonly ENCRYPTION_KEY = 'openmetadata_key';
  
  static setSecureItem(key: string, value: any): void {
    try {
      const encryptedValue = encrypt(JSON.stringify(value), this.ENCRYPTION_KEY);
      localStorage.setItem(key, encryptedValue);
    } catch (error) {
      console.error('Failed to store secure item:', error);
    }
  }
  
  static getSecureItem<T>(key: string): T | null {
    try {
      const encryptedValue = localStorage.getItem(key);
      if (!encryptedValue) return null;
      
      const decryptedValue = decrypt(encryptedValue, this.ENCRYPTION_KEY);
      return JSON.parse(decryptedValue);
    } catch (error) {
      console.error('Failed to retrieve secure item:', error);
      return null;
    }
  }
  
  static removeSecureItem(key: string): void {
    localStorage.removeItem(key);
  }
}
```

## AI Monitoring & Observability Intelligence

### Comprehensive Monitoring Strategy
```java
// AI-Enhanced Monitoring and Metrics
@Component
public class IntelligentMonitoringService {
    
    private final MeterRegistry meterRegistry;
    private final HealthIndicatorRegistry healthRegistry;
    
    @EventListener
    public void handleEntityEvent(EntityEvent event) {
        // Record metrics for different event types
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            processEvent(event);
            
            // Record success metrics
            meterRegistry.counter("entity.events.processed",
                "type", event.getType(),
                "status", "success"
            ).increment();
            
        } catch (Exception e) {
            // Record error metrics
            meterRegistry.counter("entity.events.processed",
                "type", event.getType(),
                "status", "error",
                "error.type", e.getClass().getSimpleName()
            ).increment();
            
            throw e;
        } finally {
            sample.stop(Timer.builder("entity.event.processing.time")
                          .tag("type", event.getType())
                          .register(meterRegistry));
        }
    }
    
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void recordSystemMetrics() {
        // JVM metrics
        Runtime runtime = Runtime.getRuntime();
        meterRegistry.gauge("jvm.memory.used", runtime.totalMemory() - runtime.freeMemory());
        meterRegistry.gauge("jvm.memory.max", runtime.maxMemory());
        
        // Database connection pool metrics
        HikariDataSource dataSource = (HikariDataSource) getDataSource();
        meterRegistry.gauge("db.connections.active", dataSource.getHikariPoolMXBean().getActiveConnections());
        meterRegistry.gauge("db.connections.idle", dataSource.getHikariPoolMXBean().getIdleConnections());
        
        // Custom business metrics
        long entityCount = entityRepository.getTotalEntityCount();
        meterRegistry.gauge("entities.total.count", entityCount);
    }
}

// Health checks with intelligent diagnostics
@Component
public class SystemHealthIndicator implements HealthIndicator {
    
    @Override
    public Health health() {
        Health.Builder builder = new Health.Builder();
        
        try {
            // Database connectivity check
            checkDatabaseHealth(builder);
            
            // Search engine health check
            checkSearchEngineHealth(builder);
            
            // External service health checks
            checkExternalServicesHealth(builder);
            
            return builder.up().build();
            
        } catch (Exception e) {
            return builder.down(e)
                          .withDetail("error", e.getMessage())
                          .withDetail("timestamp", Instant.now())
                          .build();
        }
    }
    
    private void checkDatabaseHealth(Health.Builder builder) {
        try {
            long startTime = System.currentTimeMillis();
            int result = jdbi.withHandle(handle -> 
                handle.createQuery("SELECT 1").mapTo(Integer.class).one()
            );
            long responseTime = System.currentTimeMillis() - startTime;
            
            builder.withDetail("database", Map.of(
                "status", "UP",
                "responseTime", responseTime + "ms",
                "result", result
            ));
        } catch (Exception e) {
            builder.withDetail("database", Map.of(
                "status", "DOWN",
                "error", e.getMessage()
            ));
            throw e;
        }
    }
}
```

## AI Code Intelligence & Understanding

### Entity Relationship Intelligence
```java
// AI Understanding: Entity relationship patterns in OpenMetadata
// Core entities: Database -> Schema -> Table -> Column
// Each entity has: id, name, fullyQualifiedName, description, owner, tags

// Entity hierarchy navigation
public class EntityRelationshipIntelligence {
    
    // Understand parent-child relationships
    public List<Entity> getEntityHierarchy(String fullyQualifiedName) {
        // FQN format: service.database.schema.table.column
        String[] parts = fullyQualifiedName.split("\\.");
        List<Entity> hierarchy = new ArrayList<>();
        
        // Build hierarchy from root to leaf
        StringBuilder currentFqn = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) currentFqn.append(".");
            currentFqn.append(parts[i]);
            
            Entity entity = entityRepository.getByName(currentFqn.toString());
            if (entity != null) {
                hierarchy.add(entity);
            }
        }
        return hierarchy;
    }
    
    // Understand entity relationships
    public Map<String, List<EntityReference>> getEntityRelationships(UUID entityId) {
        return Map.of(
            "owns", relationshipRepository.getOwnershipRelations(entityId),
            "contains", relationshipRepository.getContainmentRelations(entityId),
            "upstream", relationshipRepository.getLineageUpstream(entityId),
            "downstream", relationshipRepository.getLineageDownstream(entityId),
            "similar", relationshipRepository.getSimilarEntities(entityId)
        );
    }
}
```

### Schema Evolution Intelligence
```python
# AI Understanding: Schema change detection and impact analysis
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from enum import Enum

class ChangeType(Enum):
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    RENAMED = "renamed"

@dataclass
class SchemaChange:
    change_type: ChangeType
    entity_type: str
    entity_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    impact_score: float = 0.0

class SchemaEvolutionAnalyzer:
    """AI-enhanced schema change detection and impact analysis."""
    
    def analyze_schema_changes(
        self, 
        old_schema: Dict, 
        new_schema: Dict
    ) -> List[SchemaChange]:
        """Detect and analyze schema changes with impact scoring."""
        changes = []
        
        # Analyze table changes
        old_tables = {t['name']: t for t in old_schema.get('tables', [])}
        new_tables = {t['name']: t for t in new_schema.get('tables', [])}
        
        # Detect added tables
        for table_name in new_tables.keys() - old_tables.keys():
            changes.append(SchemaChange(
                change_type=ChangeType.ADDED,
                entity_type="table",
                entity_name=table_name,
                impact_score=self._calculate_impact_score("table", "added")
            ))
        
        # Detect removed tables
        for table_name in old_tables.keys() - new_tables.keys():
            changes.append(SchemaChange(
                change_type=ChangeType.REMOVED,
                entity_type="table",
                entity_name=table_name,
                impact_score=self._calculate_impact_score("table", "removed")
            ))
        
        # Analyze column changes in existing tables
        for table_name in old_tables.keys() & new_tables.keys():
            table_changes = self._analyze_table_changes(
                old_tables[table_name], 
                new_tables[table_name]
            )
            changes.extend(table_changes)
        
        return sorted(changes, key=lambda x: x.impact_score, reverse=True)
    
    def _calculate_impact_score(self, entity_type: str, change_type: str) -> float:
        """Calculate impact score based on entity type and change type."""
        impact_matrix = {
            ("table", "removed"): 0.9,
            ("column", "removed"): 0.7,
            ("table", "added"): 0.3,
            ("column", "added"): 0.2,
            ("column", "type_changed"): 0.8,
        }
        return impact_matrix.get((entity_type, change_type), 0.5)
```

### Data Lineage Intelligence
```typescript
// AI Understanding: Data lineage tracking and visualization
interface LineageNode {
  id: string;
  name: string;
  type: 'table' | 'column' | 'pipeline' | 'dashboard';
  fullyQualifiedName: string;
  metadata: Record<string, any>;
}

interface LineageEdge {
  from: string;
  to: string;
  type: 'dataflow' | 'transformation' | 'aggregation';
  metadata?: {
    transformationLogic?: string;
    confidence?: number;
  };
}

class DataLineageIntelligence {
  private lineageGraph: Map<string, Set<string>> = new Map();
  
  /**
   * Build comprehensive lineage graph with AI-enhanced relationship detection
   */
  buildLineageGraph(entities: Entity[]): LineageGraph {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    
    entities.forEach(entity => {
      // Add entity as node
      nodes.push({
        id: entity.id,
        name: entity.name,
        type: this.determineEntityType(entity),
        fullyQualifiedName: entity.fullyQualifiedName,
        metadata: entity.metadata || {}
      });
      
      // Analyze relationships and dependencies
      const relationships = this.analyzeEntityRelationships(entity);
      relationships.forEach(rel => {
        edges.push({
          from: rel.sourceId,
          to: rel.targetId,
          type: rel.relationshipType,
          metadata: {
            confidence: rel.confidence,
            transformationLogic: rel.transformationLogic
          }
        });
      });
    });
    
    return { nodes, edges };
  }
  
  /**
   * AI-enhanced impact analysis for entity changes
   */
  analyzeChangeImpact(
    entityId: string, 
    changeType: 'schema' | 'data' | 'access'
  ): ImpactAnalysis {
    const downstreamEntities = this.getDownstreamEntities(entityId);
    const upstreamEntities = this.getUpstreamEntities(entityId);
    
    const impact = {
      affected_entities: downstreamEntities.length,
      risk_level: this.calculateRiskLevel(changeType, downstreamEntities),
      recommendations: this.generateRecommendations(changeType, downstreamEntities),
      rollback_plan: this.generateRollbackPlan(entityId, changeType)
    };
    
    return impact;
  }
  
  private calculateRiskLevel(
    changeType: string, 
    affectedEntities: LineageNode[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEntityTypes = ['dashboard', 'report', 'ml_model'];
    const criticalCount = affectedEntities.filter(e => 
      criticalEntityTypes.includes(e.type)
    ).length;
    
    if (changeType === 'schema' && criticalCount > 5) return 'critical';
    if (changeType === 'schema' && criticalCount > 2) return 'high';
    if (affectedEntities.length > 10) return 'medium';
    return 'low';
  }
}
```

## AI Testing Intelligence & Strategies

### Intelligent Test Generation
```java
// AI-Enhanced Test Generation Patterns
@TestMethodOrder(OrderAnnotation.class)
public class AIGeneratedEntityTests {
    
    // AI Pattern: Test entity lifecycle completely
    @Test
    @Order(1)
    public void testEntityCreationWorkflow() {
        // Test data setup with realistic values
        CreateEntityRequest request = new CreateEntityRequest()
            .withName("ai_generated_entity")
            .withDescription("AI-generated test entity for validation")
            .withOwner(getTestOwner())
            .withTags(getTestTags());
        
        // Execute creation
        Response response = entityResource.create(request, securityContext);
        
        // Validate response structure and data
        assertEquals(201, response.getStatus());
        Entity created = (Entity) response.getEntity();
        assertNotNull(created.getId());
        assertEquals(request.getName(), created.getName());
        assertTrue(created.getFullyQualifiedName().contains(request.getName()));
        
        // Validate audit trail
        AuditLog auditLog = auditService.getLatestAudit(created.getId());
        assertEquals(AuditEvent.ENTITY_CREATED, auditLog.getEvent());
    }
    
    // AI Pattern: Test edge cases and error conditions
    @Test
    public void testEntityValidationEdgeCases() {
        // Test null/empty values
        assertThrows(ValidationException.class, () -> 
            entityResource.create(new CreateEntityRequest(), securityContext)
        );
        
        // Test invalid characters in name
        assertThrows(ValidationException.class, () -> 
            entityResource.create(
                new CreateEntityRequest().withName("invalid@name!"), 
                securityContext
            )
        );
        
        // Test duplicate creation
        CreateEntityRequest request = createValidRequest();
        entityResource.create(request, securityContext);
        
        assertThrows(EntityExistsException.class, () -> 
            entityResource.create(request, securityContext)
        );
    }
    
    // AI Pattern: Performance and scalability testing
    @Test
    public void testBulkOperationPerformance() {
        int entityCount = 1000;
        List<CreateEntityRequest> requests = generateTestEntities(entityCount);
        
        long startTime = System.currentTimeMillis();
        
        // Batch creation
        List<Entity> created = entityService.createBatch(requests);
        
        long executionTime = System.currentTimeMillis() - startTime;
        
        // Performance assertions
        assertEquals(entityCount, created.size());
        assertTrue(executionTime < 30000, "Bulk creation should complete within 30s");
        
        // Memory usage validation
        Runtime runtime = Runtime.getRuntime();
        long memoryUsed = runtime.totalMemory() - runtime.freeMemory();
        assertTrue(memoryUsed < 500 * 1024 * 1024, "Memory usage should be under 500MB");
    }
}
```

### AI-Driven Integration Testing
```python
# AI-Enhanced Integration Testing for Connectors
import pytest
from unittest.mock import Mock, patch
from typing import List, Dict, Any

class AIIntelligentConnectorTest:
    """AI-enhanced connector testing with intelligent validation."""
    
    @pytest.fixture
    def mock_database_connection(self):
        """Create realistic database mock with AI-generated test data."""
        connection = Mock()
        
        # AI-generated realistic schema structure
        connection.get_databases.return_value = [
            "production_db", "staging_db", "analytics_db"
        ]
        
        connection.get_tables.return_value = [
            {
                "name": "users",
                "type": "table",
                "columns": [
                    {"name": "id", "type": "INTEGER", "nullable": False},
                    {"name": "email", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "created_at", "type": "TIMESTAMP", "nullable": True}
                ]
            },
            {
                "name": "orders",
                "type": "table", 
                "columns": [
                    {"name": "id", "type": "INTEGER", "nullable": False},
                    {"name": "user_id", "type": "INTEGER", "nullable": False},
                    {"name": "total", "type": "DECIMAL(10,2)", "nullable": False}
                ]
            }
        ]
        
        return connection
    
    def test_connector_metadata_extraction(self, mock_database_connection):
        """Test comprehensive metadata extraction with AI validation."""
        connector = DatabaseConnector(config=self.get_test_config())
        connector.connection = mock_database_connection
        
        # Extract metadata
        extracted_metadata = list(connector.get_database_metadata())
        
        # AI-driven validation
        self._validate_metadata_completeness(extracted_metadata)
        self._validate_metadata_accuracy(extracted_metadata)
        self._validate_relationship_detection(extracted_metadata)
    
    def _validate_metadata_completeness(self, metadata: List[Dict[str, Any]]):
        """AI validation for metadata completeness."""
        required_fields = ["name", "type", "columns", "fullyQualifiedName"]
        
        for entity in metadata:
            for field in required_fields:
                assert field in entity, f"Missing required field: {field}"
            
            # Validate column metadata completeness
            if entity["type"] == "table":
                for column in entity.get("columns", []):
                    assert "name" in column
                    assert "type" in column
                    assert "nullable" in column
    
    def _validate_metadata_accuracy(self, metadata: List[Dict[str, Any]]):
        """AI validation for metadata accuracy."""
        for entity in metadata:
            # Validate naming conventions
            assert entity["name"].isidentifier() or "_" in entity["name"]
            
            # Validate FQN format
            fqn_parts = entity["fullyQualifiedName"].split(".")
            assert len(fqn_parts) >= 2, "FQN should have at least service.entity"
            
            # Validate data types
            if entity["type"] == "table":
                valid_column_types = ["INTEGER", "VARCHAR", "DECIMAL", "TIMESTAMP", "BOOLEAN"]
                for column in entity.get("columns", []):
                    column_type = column["type"].split("(")[0]  # Remove precision
                    assert column_type in valid_column_types
    
    @pytest.mark.integration
    def test_end_to_end_ingestion_workflow(self):
        """AI-enhanced end-to-end integration testing."""
        # Setup test environment
        test_config = self._create_integration_test_config()
        
        # Initialize connector and metadata client
        connector = DatabaseConnector(config=test_config)
        metadata_client = OpenMetadata(test_config.metadata_server)
        
        # Execute ingestion workflow
        workflow = IngestionWorkflow(
            config=test_config,
            connector=connector,
            metadata_client=metadata_client
        )
        
        # Run workflow with monitoring
        workflow_result = workflow.execute()
        
        # AI-driven result validation
        self._validate_workflow_success(workflow_result)
        self._validate_ingested_entities(metadata_client)
        self._validate_data_quality(metadata_client)
    
    def _validate_workflow_success(self, result: WorkflowResult):
        """Validate workflow execution with AI insights."""
        assert result.success, f"Workflow failed: {result.errors}"
        assert result.entities_created > 0, "No entities were created"
        assert result.failure_rate < 0.1, "Failure rate too high"
        
        # Performance validation
        assert result.execution_time < 300, "Workflow took too long"
        assert result.memory_usage < 1024, "Memory usage too high"
```

## AI Documentation Intelligence

### Intelligent Code Documentation
```java
/**
 * AI-Enhanced Entity Service with comprehensive business logic documentation.
 * 
 * This service implements the core entity management functionality for OpenMetadata,
 * providing CRUD operations, relationship management, and advanced querying capabilities.
 * 
 * Key Design Patterns:
 * - Repository Pattern: Data access abstraction through EntityRepository
 * - Builder Pattern: Complex entity construction via EntityBuilder
 * - Observer Pattern: Event publishing for entity lifecycle changes
 * - Strategy Pattern: Pluggable validation and transformation strategies
 * 
 * Performance Characteristics:
 * - Average response time: < 100ms for single entity operations
 * - Bulk operations: 1000 entities per second throughput
 * - Memory usage: O(1) for single operations, O(n) for bulk operations
 * - Caching: LRU cache with 15-minute TTL for frequently accessed entities
 * 
 * Security Considerations:
 * - All operations require valid JWT authentication
 * - Role-based access control enforced at method level
 * - Input sanitization prevents SQL injection attacks
 * - Audit logging for all entity modifications
 * 
 * @author OpenMetadata Team
 * @since 1.3.0
 * @see EntityRepository for data access implementation
 * @see EntityValidator for validation logic
 */
@Service
@Transactional
public class EntityService {
    
    /**
     * Creates a new entity with comprehensive validation and relationship setup.
     * 
     * AI Implementation Notes:
     * - Validates entity name uniqueness within scope
     * - Automatically generates FQN based on hierarchy
     * - Establishes parent-child relationships
     * - Triggers downstream notifications
     * - Records audit trail with user context
     * 
     * Performance: O(1) for validation, O(log n) for uniqueness check
     * 
     * @param createRequest the entity creation request with validation
     * @param securityContext authenticated user context for authorization
     * @return created entity with generated ID and relationships
     * @throws ValidationException if entity data is invalid
     * @throws SecurityException if user lacks creation permissions
     * @throws EntityExistsException if entity name conflicts
     */
    public Entity createEntity(
            @Valid CreateEntityRequest createRequest,
            @NonNull SecurityContext securityContext) {
        // Implementation with detailed inline documentation
    }
}
```

### AI Cross-Reference Integration
```markdown
# AI Cross-Reference Guide

## Integration Between AGENTS.md and CLAUDE.md

### Repository Structure Understanding
- **AGENTS.md sections 1-3**: Provides detailed repository structure intelligence
- **CLAUDE.md sections 1-2**: Builds upon structure with development workflows
- **Cross-reference**: Use AGENTS.md for codebase navigation, CLAUDE.md for development execution

### Development Pattern Recognition
- **AGENTS.md sections 4-6**: AI development context patterns and frameworks
- **CLAUDE.md sections 3-5**: Advanced AI development intelligence and strategies
- **Cross-reference**: AGENTS.md provides patterns, CLAUDE.md provides implementation strategies

### Testing and Quality Intelligence
- **AGENTS.md sections 7-8**: AI testing and performance optimization patterns
- **CLAUDE.md sections 6-8**: Advanced testing intelligence and monitoring strategies
- **Cross-reference**: Combined approach provides comprehensive testing framework

### Security and Best Practices
- **AGENTS.md sections 9-10**: AI security and error handling patterns
- **CLAUDE.md sections 9-10**: Advanced security intelligence and monitoring
- **Cross-reference**: Layered security approach from basic patterns to advanced implementation

## AI Development Workflow Integration

1. **Discovery Phase**: Reference AGENTS.md repository intelligence (sections 1-3)
2. **Planning Phase**: Use CLAUDE.md development strategies (sections 3-4)
3. **Implementation Phase**: Apply AGENTS.md patterns with CLAUDE.md intelligence
4. **Testing Phase**: Combine testing approaches from both guides
5. **Security Validation**: Apply security patterns and advanced intelligence
6. **Performance Optimization**: Use performance guidelines from both sources
```

## AI Todo Validation & Quality Assurance

**ABSOLUTE REQUIREMENT**: AI agents MUST follow comprehensive validation protocols before marking any todo as complete.

### Core Validation Mindset

**🚨 VALIDATION FIRST PRINCIPLE**: 
Every todo completion requires validation evidence. No exceptions. AI agents must demonstrate validation was performed and passed before marking todos complete.

### Phase-Based Validation Protocol

**Best Practice**: AI agents should follow comprehensive validation protocols before marking any todo as complete.

### Core Validation Mindset

**🚨 VALIDATION FIRST PRINCIPLE**: 
Every todo completion should include validation evidence. AI agents are expected to demonstrate that validation was performed and passed before marking todos complete.

### Phase-Based Validation Protocol

AI agents should apply appropriate validation based on the development phase:

**Phase 1: Discovery & Analysis**
- ✅ Research findings documented with credible sources
- ✅ Architecture analysis includes system impact assessment  
- ✅ Dependency compatibility verified across all affected modules
- ✅ Risk assessment identifies and mitigates potential issues
- ✅ Success criteria clearly defined with measurable outcomes

**Phase 2: Design & Planning**
- ✅ API contracts defined using OpenAPI specifications
- ✅ Database changes include both migration and rollback scripts
- ✅ Component interfaces specify clear input/output contracts
- ✅ Error handling strategy documented with examples
- ✅ Performance requirements specified with concrete metrics

**Phase 3: Implementation**
- ✅ Code compiles without warnings across all languages
- ✅ All new functions covered by comprehensive unit tests
- ✅ Code coverage maintains project minimum thresholds
- ✅ Security patterns implemented according to OpenMetadata standards
- ✅ Performance benchmarks verified within acceptable ranges

**Phase 4: Testing**
- ✅ Unit tests achieve minimum 80% coverage for new code
- ✅ Integration tests pass with realistic data scenarios
- ✅ E2E tests cover all critical user workflows
- ✅ Performance tests validate SLA compliance
- ✅ Security tests confirm input sanitization effectiveness

**Phase 5: Integration**
- ✅ Components integrate seamlessly with existing ecosystem
- ✅ No breaking changes introduced to public API contracts
- ✅ Database migrations execute and rollback successfully
- ✅ Configuration changes maintain backward compatibility
- ✅ Monitoring and observability properly configured

**Phase 6: Deployment**
- ✅ Documentation updated to reflect all changes accurately
- ✅ Release notes comprehensively document user impact
- ✅ Deployment procedures tested in staging environment
- ✅ Rollback procedures validated and documented
- ✅ Production monitoring alerts configured and tested

### Technology-Specific Validation Requirements

**Java/Backend Changes:**
- MUST run: `mvn clean compile` (zero warnings tolerated)
- MUST run: `mvn spotless:apply` (formatting compliance)
- MUST run: `mvn test` (all tests passing)
- MUST verify: No new security vulnerabilities introduced
- MUST check: Performance impact on API response times

**Python/Ingestion Changes:**
- MUST run: `cd ingestion && make lint` (zero violations)
- MUST run: `make py_format` (code formatting compliance)
- MUST run: `make unit_ingestion` (all tests passing)
- MUST verify: Type safety with `make static-checks`
- MUST check: No credential leakage in logs

**Frontend/React Changes:**
- MUST run: `yarn build` (successful compilation)
- MUST run: `yarn lint:fix` (zero linting errors)
- MUST run: `yarn test` (all component tests passing)
- MUST verify: Accessibility standards compliance
- MUST check: Bundle size impact within limits

### Critical Security Validation

**MANDATORY SECURITY CHECKS**: AI agents must enforce these security validations:

🔒 **API Endpoint Security**
- All new endpoints MUST implement input sanitization
- Search functionality MUST use `SearchUtils.sanitizeQueryParameter()`
- User inputs MUST be validated and escaped
- Authentication MUST be properly verified via JWT

🛡️ **Data Protection**
- No sensitive data in logs or error messages
- All database queries parameterized to prevent SQL injection
- XSS prevention implemented for all user-facing content
- Rate limiting applied to prevent abuse

⚡ **Performance Security**
- Resource consumption monitoring in place
- Memory leak prevention validated
- Database query optimization confirmed
- Circuit breaker patterns implemented for external calls

### Validation Failure Protocol

When validation fails, AI agents MUST:

1. **IMMEDIATE STOP**: Do not proceed with todo completion
2. **ROOT CAUSE ANALYSIS**: Identify exact cause of validation failure
3. **REMEDIATION**: Fix the issue or create remediation todos
4. **RE-VALIDATION**: Run validation again after fixes applied
5. **DOCUMENTATION**: Record what failed, what was fixed, and verification steps

### AI Validation Best Practices

**🎯 Proactive Validation**
- Run validation checks continuously during development
- Validate early and often, not just at completion
- Use automated validation where possible
- Monitor validation trends to predict potential issues

**📊 Validation Metrics**
- Track validation success rates across different todo types
- Monitor time-to-fix for validation failures  
- Identify patterns in validation failures for improvement
- Measure impact of validation on overall code quality

**🔄 Continuous Improvement**
- Learn from validation failures to improve future validation
- Update validation criteria based on production issues
- Share validation best practices across development phases
- Integrate lessons learned into todo templates

**💡 Intelligent Validation**
- Apply context-aware validation based on todo content
- Prioritize validation checks based on risk assessment
- Suggest additional validation steps for complex changes
- Provide actionable remediation guidance for failures

## Integrated Todo-Driven Development Framework

### AI-Driven Development Excellence

**🚀 COMPREHENSIVE APPROACH**: AI agents must integrate todo management with the 6-phase development framework for maximum effectiveness.

#### Framework Integration Strategy

**Phase 1 + Todo Management**: Discovery with Systematic Planning
- Create discovery todos with research objectives and success criteria
- Break down complex analysis into manageable investigation tasks
- Validate research completeness before proceeding to design phase
- Document findings in a structured format for future reference

**Phase 2 + Todo Management**: Design with Implementation Roadmap
- Transform design decisions into actionable implementation todos
- Create dependency chains between design and implementation tasks
- Validate design completeness against implementation feasibility
- Ensure all stakeholders understand the planned approach

**Phase 3 + Todo Management**: Implementation with Quality Gates
- Break implementation into small, validated increments
- Apply continuous validation throughout implementation process
- Create testing todos alongside implementation todos
- Ensure security and performance considerations at every step

**Phase 4 + Todo Management**: Testing with Comprehensive Coverage
- Create specific testing todos for each implementation deliverable
- Validate test completeness before marking implementation complete
- Include security testing, performance testing, and integration testing
- Ensure test failures result in immediate remediation todos

**Phase 5 + Todo Management**: Integration with System Validation
- Create integration todos that verify system-wide compatibility
- Validate no breaking changes introduced through comprehensive testing
- Ensure monitoring and observability throughout integration process
- Create rollback todos for all significant system changes

**Phase 6 + Todo Management**: Deployment with Production Readiness
- Create deployment validation todos with staging environment testing
- Ensure documentation and training materials are complete
- Validate production monitoring and alerting before deployment
- Create post-deployment validation and monitoring todos

### Excellence Through Systematic Execution

**📈 CONTINUOUS IMPROVEMENT**: AI agents must demonstrate measurable improvement in todo execution quality over time.

#### Success Metrics for AI Todo Management
- **Completion Accuracy**: Percentage of todos completed without rework
- **Validation Success Rate**: Percentage of todos passing validation on first attempt  
- **Dependency Management**: Effectiveness of identifying and managing todo dependencies
- **Quality Metrics**: Code quality, security compliance, and performance optimization
- **User Satisfaction**: Stakeholder feedback on todo transparency and execution

#### AI Learning and Adaptation
- **Pattern Recognition**: Identify successful todo patterns and replicate them
- **Failure Analysis**: Learn from todo validation failures to prevent recurrence
- **Efficiency Optimization**: Continuously improve todo breakdown and execution
- **Knowledge Integration**: Apply lessons learned across different project contexts
- **Best Practice Evolution**: Update todo templates based on execution experience

### Final AI Directives

**🎯 COMMITMENT TO EXCELLENCE**: Every AI interaction must demonstrate commitment to exceptional todo management and validation.

#### Non-Negotiable Requirements
1. **ALWAYS** use TodoWrite for complex tasks (3+ steps)
2. **ALWAYS** validate before marking todos complete
3. **ALWAYS** update todo status in real-time
4. **ALWAYS** create remediation todos for validation failures
5. **ALWAYS** integrate security and performance considerations
6. **ALWAYS** maintain clear communication about todo progress
7. **ALWAYS** learn from todo execution to improve future performance

#### Success Criteria for AI Agents
AI agents will be considered successful when they consistently demonstrate:
- **Proactive Todo Management**: Creating comprehensive todos without prompting
- **Rigorous Validation**: Never completing todos without proper validation
- **Clear Communication**: Providing transparent progress updates and issue resolution
- **Continuous Learning**: Improving todo execution quality over time
- **User Focus**: Delivering value through systematic, high-quality todo completion

**🏆 EXCELLENCE STANDARD**: AI agents must strive for zero-defect todo completion through comprehensive planning, rigorous validation, and continuous improvement.

Please do not commit changes apart from the ones you are asked to do.