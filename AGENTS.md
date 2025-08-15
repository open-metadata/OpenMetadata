# AI Agent Repository Guide for OpenMetadata

This comprehensive guide provides AI agents with deep contextual understanding of the OpenMetadata repository structure, patterns, and development workflows to enable intelligent code analysis, generation, and problem-solving.

## Repository Intelligence Profile

### Core System Architecture
OpenMetadata is a **unified metadata platform** with a sophisticated multi-layered architecture:

**Technology Stack Overview:**
- **Backend**: Java 21 + Dropwizard REST framework (enterprise-grade microservices)
- **Frontend**: React 18 + TypeScript + Ant Design (modern component library)
- **Ingestion Engine**: Python 3.9+ with Pydantic 2.x (75+ data source connectors)
- **Database Layer**: MySQL 8.0+ (primary) / PostgreSQL 13+ with Flyway migrations
- **Search Engine**: Elasticsearch 7.17+ / OpenSearch 2.6+ for metadata discovery
- **Orchestration**: Apache Airflow for workflow management
- **Message Queue**: Kafka for event streaming (optional)
- **Authentication**: JWT + OAuth2/SAML/LDAP integration

### Repository Structure Intelligence

```
OpenMetadata/
├── openmetadata-service/           # Core Java backend (REST APIs, business logic)
│   ├── src/main/java/org/openmetadata/
│   │   ├── service/                # Service layer implementations
│   │   ├── resources/              # JAX-RS REST endpoints
│   │   ├── jdbi/                   # Database access layer
│   │   ├── security/               # Authentication & authorization
│   │   └── util/                   # Shared utilities
│   └── src/test/java/              # Comprehensive test suite
├── openmetadata-ui/src/main/resources/ui/  # React frontend application
│   ├── src/
│   │   ├── components/             # Reusable React components
│   │   ├── pages/                  # Route-level page components
│   │   ├── utils/                  # Frontend utilities & helpers
│   │   ├── constants/              # Application constants
│   │   └── rest/                   # API client layer
│   ├── public/                     # Static assets
│   └── playwright-tests/           # E2E test automation
├── ingestion/                      # Python ingestion framework
│   ├── src/metadata/
│   │   ├── ingestion/              # Core ingestion engine
│   │   │   ├── source/             # Data source connectors (75+ connectors)
│   │   │   ├── processor/          # Data transformation pipeline
│   │   │   ├── sink/               # Output destinations
│   │   │   └── stage/              # Staging mechanisms
│   │   ├── generated/              # Auto-generated Pydantic models
│   │   ├── utils/                  # Python utilities
│   │   └── cli/                    # Command-line interface
│   └── tests/                      # Python test suite (unit + integration)
├── openmetadata-spec/              # JSON Schema specifications
│   └── src/main/resources/json/schema/
│       ├── entity/                 # Core entity definitions
│       ├── type/                   # Primitive type definitions
│       ├── api/                    # API request/response schemas
│       └── configuration/          # Configuration schemas
├── bootstrap/sql/                  # Database schema & migrations
│   ├── migrations/                 # Flyway migration scripts
│   └── data/                       # Sample & reference data
├── docker/                         # Containerization & orchestration
│   ├── development/                # Local development environments
│   ├── docker-compose.*.yml        # Various deployment configurations
│   └── Dockerfile.*                # Multi-stage container builds
└── conf/                           # Configuration templates
    ├── openmetadata.yaml           # Main application configuration
    └── *.yaml                      # Environment-specific configs
```

## AI Development Context Patterns

### Schema-Driven Development Philosophy
OpenMetadata follows a **schema-first approach** where all entities, APIs, and data models are defined in JSON Schema:

1. **Entity Definition Flow:**
   ```
   JSON Schema → Code Generation → API Implementation → UI Components
   ```

2. **Code Generation Triggers:**
   ```bash
   # Always run after schema changes
   mvn clean install -pl openmetadata-spec  # Generate Java models
   make generate                            # Generate Python models
   yarn parse-schema                        # Generate TypeScript types
   ```

3. **Schema Location Patterns:**
   - Entities: `openmetadata-spec/src/main/resources/json/schema/entity/`
   - Types: `openmetadata-spec/src/main/resources/json/schema/type/`
   - APIs: `openmetadata-spec/src/main/resources/json/schema/api/`

### Multi-Language Development Patterns

#### Java Backend Patterns
**Key Architectural Patterns:**
- **JAX-RS Resources**: RESTful endpoint definitions with proper HTTP semantics
- **Dropwizard Services**: Business logic encapsulation with dependency injection
- **JDBI DAOs**: Type-safe database access with SQL mapping
- **Jersey Filters**: Cross-cutting concerns (auth, logging, validation)

**Common Java File Patterns:**
```java
// Resource Pattern (REST endpoints)
@Path("/v1/entities")
@Produces(MediaType.APPLICATION_JSON)
public class EntityResource extends CrudResource<Entity> {
    @GET @Path("/{id}")
    public Response get(@PathParam("id") UUID id) { /* implementation */ }
}

// Service Pattern (business logic)
@Singleton
public class EntityService extends EntityServiceImpl<Entity, EntityRepository> {
    public Entity createEntity(CreateEntity request) { /* implementation */ }
}

// Repository Pattern (data access)
public interface EntityRepository extends EntityRepository<Entity> {
    @SqlQuery("SELECT * FROM entity_table WHERE id = :id")
    Entity findById(@Bind("id") UUID id);
}
```

#### Python Ingestion Patterns
**Connector Development Pattern:**
```python
# Source connector base pattern
class MyDatabaseSource(DatabaseServiceSource):
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
    
    def get_database_names(self) -> Iterable[str]:
        # Yield database names
    
    def get_table_names_and_types(self) -> Iterable[Tuple[str, str]]:
        # Yield (table_name, table_type) tuples
    
    def get_table_columns_and_constraints(self, table_name: str) -> Tuple[List[Column], List[Constraint]]:
        # Return columns and constraints
```

**Configuration Pattern:**
```python
# Pydantic configuration models
class MyDatabaseConnection(DatabaseConnection):
    type: Literal["MyDatabase"] = "MyDatabase"
    scheme: str = "mydatabase+pymysql"
    username: Optional[str] = None
    password: Optional[SecretStr] = None
    hostPort: Optional[str] = "localhost:5432"
```

#### React Frontend Patterns
**Component Architecture:**
```typescript
// Page-level component pattern
export const EntityListPage: FC = () => {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchEntities().then(setEntities).finally(() => setLoading(false));
    }, []);
    
    return <EntityTable entities={entities} loading={loading} />;
};

// Reusable component pattern
interface EntityTableProps {
    entities: Entity[];
    loading: boolean;
    onEntitySelect?: (entity: Entity) => void;
}

export const EntityTable: FC<EntityTableProps> = ({ entities, loading, onEntitySelect }) => {
    // Component implementation with Ant Design components
};
```

## AI Code Understanding Framework

### Dependency Mapping Intelligence

#### Maven Dependency Hierarchy
```xml
<!-- Core backend dependencies pattern -->
<parent>
    <groupId>org.openmetadata</groupId>
    <artifactId>platform</artifactId>
    <version>${revision}</version>
</parent>

<!-- Essential dependency patterns -->
<dependencies>
    <!-- Dropwizard core -->
    <dependency>
        <groupId>io.dropwizard</groupId>
        <artifactId>dropwizard-core</artifactId>
    </dependency>
    
    <!-- Database connectivity -->
    <dependency>
        <groupId>org.jdbi</groupId>
        <artifactId>jdbi3-core</artifactId>
    </dependency>
    
    <!-- OpenMetadata schemas -->
    <dependency>
        <groupId>org.openmetadata</groupId>
        <artifactId>openmetadata-spec</artifactId>
    </dependency>
</dependencies>
```

#### Python Dependency Ecosystem
```toml
# Core ingestion dependencies
[project]
dependencies = [
    "pydantic>=2.0.0,<3.0.0",           # Data validation
    "sqlalchemy>=1.4.0,<2.0.0",        # Database ORM
    "great-expectations>=0.15.0",       # Data quality
    "apache-airflow>=2.5.0",            # Workflow orchestration
]

# Connector-specific optional dependencies
[project.optional-dependencies]
bigquery = ["google-cloud-bigquery>=3.0.0"]
snowflake = ["snowflake-connector-python>=3.0.0"]
postgres = ["psycopg2-binary>=2.9.0"]
mysql = ["pymysql>=1.0.0"]
```

### API Design Intelligence

#### REST API Patterns
OpenMetadata follows RESTful conventions with specific patterns:

**Endpoint Naming Convention:**
```
GET    /v1/{entities}              # List all entities (with pagination)
POST   /v1/{entities}              # Create new entity
GET    /v1/{entities}/{id}         # Get entity by ID
PUT    /v1/{entities}/{id}         # Update entity (full replace)
PATCH  /v1/{entities}/{id}         # Partial update entity
DELETE /v1/{entities}/{id}         # Delete entity
GET    /v1/{entities}/name/{fqn}   # Get entity by fully qualified name
```

**Response Format Patterns:**
```json
{
  "data": [...],           // Main response data
  "paging": {              // Pagination metadata
    "total": 150,
    "offset": 0,
    "limit": 25
  },
  "version": "0.13.0"      // API version
}
```

#### Authentication Flow
```java
// JWT-based authentication pattern
@Filter
public class JwtFilter implements ContainerRequestFilter {
    @Override
    public void filter(ContainerRequestContext requestContext) {
        String token = extractToken(requestContext);
        Claims claims = validateAndParseClaims(token);
        SecurityContext securityContext = createSecurityContext(claims);
        requestContext.setSecurityContext(securityContext);
    }
}
```

### Database Schema Intelligence

#### Entity Relationship Patterns
```sql
-- Core entity tables follow consistent patterns
CREATE TABLE database_entity (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    fullyQualifiedName VARCHAR(512) UNIQUE NOT NULL,
    description TEXT,
    serviceType VARCHAR(256),
    json JSON NOT NULL,           -- Full entity data in JSON
    updatedAt BIGINT UNSIGNED,
    updatedBy VARCHAR(256)
);

-- Relationship tables for many-to-many
CREATE TABLE entity_relationship (
    fromId VARCHAR(36) NOT NULL,
    toId VARCHAR(36) NOT NULL,
    relation TINYINT NOT NULL,    -- Relationship type enum
    PRIMARY KEY (fromId, toId, relation)
);
```

#### Migration Patterns
```sql
-- Flyway migration naming: V{version}__{description}.sql
-- Example: V001__create_database_table.sql

-- Always include rollback comments
-- ROLLBACK: DROP TABLE IF EXISTS database_entity;

CREATE TABLE IF NOT EXISTS database_entity (
    -- Schema definition
);

-- Add indexes for performance
CREATE INDEX idx_database_fqn ON database_entity(fullyQualifiedName);
```

## AI Testing Intelligence

### Test Coverage Expectations

#### Backend Test Patterns
```java
// Unit test pattern
@ExtendWith(MockitoExtension.class)
class EntityServiceTest {
    @Mock private EntityRepository repository;
    @InjectMocks private EntityService service;
    
    @Test
    void testCreateEntity() {
        // Given
        CreateEntity request = new CreateEntity().withName("test");
        Entity expected = new Entity().withName("test");
        when(repository.save(any())).thenReturn(expected);
        
        // When
        Entity result = service.createEntity(request);
        
        // Then
        assertEquals(expected.getName(), result.getName());
    }
}

// Integration test pattern
@TestMethodOrder(OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class EntityResourceTest extends EntityResourceTest<Entity, CreateEntity, EntityList> {
    
    @Test
    @Order(1)
    void post_entityWithValidData_201() throws IOException {
        // Test entity creation via REST API
    }
}
```

#### Frontend Test Patterns
```typescript
// Jest unit test pattern
describe('EntityTable', () => {
    it('should render entities correctly', () => {
        const entities = [{ id: '1', name: 'Test Entity' }];
        render(<EntityTable entities={entities} loading={false} />);
        
        expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });
});

// Playwright E2E test pattern
test('should create new entity', async ({ page }) => {
    await page.goto('/entities');
    await page.click('[data-testid="add-entity-button"]');
    await page.fill('[data-testid="entity-name"]', 'New Entity');
    await page.click('[data-testid="save-button"]');
    
    await expect(page.locator('.ant-message-success')).toBeVisible();
});
```

#### Python Test Patterns
```python
# Unit test with mocking
@pytest.fixture
def mock_metadata():
    return MagicMock(spec=OpenMetadata)

def test_connector_initialization(mock_metadata):
    config = WorkflowSource(
        serviceConnection=DatabaseConnection(
            config=MyDatabaseConnection(hostPort="localhost:5432")
        )
    )
    connector = MyDatabaseSource(config, mock_metadata)
    assert connector.config.serviceConnection.config.hostPort == "localhost:5432"

# Integration test pattern
@pytest.mark.integration
def test_connector_database_connection():
    # Test actual database connectivity
    pass
```

## AI Performance Optimization Guidelines

### Backend Performance Patterns

#### Database Query Optimization
```java
// Efficient pagination pattern
@SqlQuery("SELECT * FROM entity_table " +
          "WHERE name LIKE :searchTerm " +
          "ORDER BY updatedAt DESC " +
          "LIMIT :limit OFFSET :offset")
List<Entity> findEntitiesWithPaging(
    @Bind("searchTerm") String searchTerm,
    @Bind("limit") int limit,
    @Bind("offset") int offset
);

// Batch operations pattern
@SqlBatch("INSERT INTO entity_table (id, name, json) VALUES (:id, :name, :json)")
void batchInsert(@BindBean List<Entity> entities);
```

#### Caching Strategies
```java
// Caffeine cache configuration
@Singleton
public class EntityCache {
    private final Cache<String, Entity> cache = Caffeine.newBuilder()
        .maximumSize(10_000)
        .expireAfterWrite(Duration.ofMinutes(10))
        .build();
    
    public Optional<Entity> get(String key) {
        return Optional.ofNullable(cache.getIfPresent(key));
    }
}
```

### Frontend Performance Patterns

#### Component Optimization
```typescript
// Memoization for expensive components
const EntityTable = memo<EntityTableProps>(({ entities, onSelect }) => {
    const sortedEntities = useMemo(() => 
        entities.sort((a, b) => a.name.localeCompare(b.name)), 
        [entities]
    );
    
    return <Table dataSource={sortedEntities} onRow={(record) => ({ onClick: () => onSelect(record) })} />;
});

// Virtual scrolling for large lists
const VirtualizedEntityList: FC<{ entities: Entity[] }> = ({ entities }) => {
    return (
        <FixedSizeList
            height={600}
            itemCount={entities.length}
            itemSize={50}
            itemData={entities}
        >
            {EntityListItem}
        </FixedSizeList>
    );
};
```

### Python Performance Patterns

#### Efficient Data Processing
```python
# Generator pattern for large datasets
def process_large_dataset(connection: Connection) -> Iterable[Entity]:
    chunk_size = 1000
    offset = 0
    
    while True:
        chunk = fetch_chunk(connection, offset, chunk_size)
        if not chunk:
            break
            
        for item in chunk:
            yield transform_to_entity(item)
            
        offset += chunk_size

# Async processing pattern
async def process_tables_concurrently(table_names: List[str]) -> List[Table]:
    semaphore = asyncio.Semaphore(10)  # Limit concurrent operations
    
    async def process_table(name: str) -> Table:
        async with semaphore:
            return await fetch_and_process_table(name)
    
    tasks = [process_table(name) for name in table_names]
    return await asyncio.gather(*tasks)
```

## AI Security Intelligence

### Authentication Patterns
```java
// Role-based access control
@RolesAllowed({ADMIN, EDITOR})
@GET
@Path("/{id}")
public Response getEntity(@PathParam("id") UUID id, @Context SecurityContext securityContext) {
    String userRole = securityContext.getUserPrincipal().getName();
    // Implement role-based logic
}

// JWT token validation
public class JwtTokenValidator {
    public Claims validateToken(String token) throws JwtException {
        return Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }
}
```

### Input Validation Patterns
```java
// Request validation with Bean Validation
public class CreateEntityRequest {
    @NotNull
    @Size(min = 1, max = 256)
    private String name;
    
    @Valid
    @NotNull
    private EntityConfiguration config;
}

// SQL injection prevention
public class SearchUtils {
    public static String sanitizeQueryParameter(String input) {
        if (input == null || input.length() > 10000) {
            return "";
        }
        return input.replaceAll("(?i)'\\s*(and|or)\\s*", "")
                   .replaceAll("--.*", "")
                   .replaceAll("/\\*.*?\\*/", "");
    }
}
```

## AI Error Handling Patterns

### Exception Handling Strategy
```java
// Custom exception hierarchy
public class OpenMetadataException extends Exception {
    private final int statusCode;
    private final String errorType;
}

public class EntityNotFoundException extends OpenMetadataException {
    public EntityNotFoundException(String entityType, String identifier) {
        super(String.format("%s not found: %s", entityType, identifier));
    }
}

// Global exception mapper
@Provider
public class GlobalExceptionMapper implements ExceptionMapper<Exception> {
    @Override
    public Response toResponse(Exception exception) {
        if (exception instanceof EntityNotFoundException) {
            return Response.status(404).entity(createErrorResponse(exception)).build();
        }
        // Handle other exceptions
    }
}
```

### Error Recovery Patterns
```python
# Retry mechanism with exponential backoff
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
def fetch_with_retry(url: str) -> Response:
    response = requests.get(url)
    response.raise_for_status()
    return response

# Circuit breaker pattern
class DatabaseConnectionPool:
    def __init__(self):
        self.failure_count = 0
        self.last_failure_time = None
        self.circuit_open = False
    
    def execute_query(self, query: str):
        if self.circuit_open and self._should_attempt_reset():
            self.circuit_open = False
            
        if self.circuit_open:
            raise CircuitOpenException("Database circuit is open")
        
        try:
            return self._execute(query)
        except DatabaseException:
            self._record_failure()
            raise
```

## AI Development Workflow Intelligence

### Git Workflow Patterns
```bash
# Feature development workflow
git checkout main
git pull origin main
git checkout -b feature/ISSUE-123-add-new-connector

# Development cycle
mvn clean install -DskipTests    # Quick build check
mvn spotless:apply               # Code formatting
mvn test                         # Run tests
git add . && git commit -m "feat(ingestion): Add new database connector

Implements support for NewDB database with:
- Connection validation
- Schema extraction
- Table metadata collection
- Column profiling

Fixes #123"

# Pre-push validation
make run_e2e_tests              # Full test suite
git push origin feature/ISSUE-123-add-new-connector
```

### CI/CD Pipeline Understanding
```yaml
# GitHub Actions workflow pattern
name: Build and Test
on:
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
    steps:
      - uses: actions/checkout@v3
      - name: Set up JDK 21
        uses: actions/setup-java@v3
        with:
          java-version: '21'
      - name: Run Maven tests
        run: mvn clean verify
        
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd openmetadata-ui/src/main/resources/ui && yarn install
      - name: Run tests
        run: cd openmetadata-ui/src/main/resources/ui && yarn test:coverage
```

## AI Code Generation Guidelines

### Code Quality Standards

#### Java Code Generation Rules
1. **Always run `mvn spotless:apply`** after generating Java code
2. Use builder patterns for complex objects:
   ```java
   Entity entity = Entity.builder()
       .withName("example")
       .withDescription("Example entity")
       .build();
   ```
3. Implement proper equals/hashCode/toString methods
4. Use Java 21 features appropriately (sealed classes, pattern matching, records)

#### Python Code Generation Rules
1. **Always run `make py_format`** after generating Python code
2. Use type hints extensively:
   ```python
   def process_entity(entity: Entity, config: ProcessingConfig) -> ProcessedEntity:
       # Implementation
   ```
3. Follow Pydantic model patterns for configuration
4. Use dataclasses for simple data structures

#### TypeScript Code Generation Rules
1. **Always run `yarn lint:fix`** after generating TypeScript code
2. Use proper interface definitions:
   ```typescript
   interface EntityListProps {
       entities: Entity[];
       loading: boolean;
       onEntitySelect: (entity: Entity) => void;
   }
   ```
3. Implement proper error boundaries and loading states
4. Use React hooks appropriately

## AI Troubleshooting Intelligence

### Common Development Issues

#### Build Issues
```bash
# Maven dependency resolution
mvn dependency:tree | grep -i conflict
mvn dependency:resolve-sources

# Clear caches
rm -rf ~/.m2/repository/org/openmetadata
mvn clean install -DskipTests

# Node/Yarn issues
rm -rf node_modules yarn.lock
yarn cache clean
yarn install --frozen-lockfile
```

#### Database Issues
```bash
# MySQL connection debugging
mysql -h localhost -P 3306 -u openmetadata_user -p openmetadata_db
SHOW PROCESSLIST;
SHOW ENGINE INNODB STATUS;

# Migration issues
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;
```

#### Docker Environment Issues
```bash
# Container resource monitoring
docker stats
docker system df
docker system prune -f

# Service debugging
docker compose logs -f openmetadata-server
docker compose exec mysql mysql -u root -p
```

This comprehensive guide provides AI agents with the deep contextual understanding needed to work effectively within the OpenMetadata ecosystem, enabling intelligent code generation, debugging assistance, and architectural decision-making.

## AI Todo Management & Validation Framework

### Mandatory Todo Management Strategy

### Recommended Todo Management Strategy

**STRONG RECOMMENDATION**: AI agents should use the TodoWrite tool for all non-trivial tasks (3+ steps or multi-component changes). This ensures comprehensive task tracking, progress visibility, and systematic validation.

### Todo Creation Intelligence

#### When to Create Todos (MANDATORY)
```markdown
# AI Todo Creation Triggers
✅ ALWAYS CREATE TODOS FOR:
- Multi-step feature implementations (3+ steps)
- Cross-module changes affecting multiple components
- Security-related modifications or additions
- Performance optimization tasks
- Database schema changes and migrations
- New connector development
- API endpoint creation or modification
- Frontend component development with backend integration
- Testing strategy implementation
- Documentation updates for significant changes
- Bug fixes requiring multiple file changes
- Refactoring tasks affecting system architecture

❌ SKIP TODOS FOR:
- Single-line fixes or trivial changes
- Simple typo corrections
- Adding basic comments to existing code
- Minor formatting adjustments
- Single-file documentation updates
```

#### Intelligent Todo Breakdown Strategy
```markdown
# AI Todo Decomposition Framework

## Level 1: Epic-Level Todos (High-Level Features)
- "Implement new database connector for XYZ system"
- "Add data lineage visualization to UI"
- "Implement advanced search capabilities"

## Level 2: Feature-Level Todos (Component Implementation)
- "Create backend API endpoints for new connector"
- "Implement frontend components for lineage display"
- "Add search indexing and query processing"

## Level 3: Task-Level Todos (Specific Implementation)
- "Implement connection validation for XYZ connector"
- "Create lineage graph React component"
- "Add Elasticsearch query optimization"

## Level 4: Validation Todos (Quality Assurance)
- "Validate connector integration tests pass"
- "Verify lineage component renders correctly"
- "Confirm search performance meets requirements"
```

### Todo Lifecycle Management

#### Todo States and Transitions
```typescript
// AI Todo State Management Intelligence
enum TodoStatus {
  PENDING = "pending",           // Task not yet started
  IN_PROGRESS = "in_progress",   // Currently being worked on
  BLOCKED = "blocked",           // Waiting for dependencies or resolution
  REVIEWING = "reviewing",       // Code review or validation in progress
  COMPLETED = "completed",       // Task fully finished and validated
  CANCELLED = "cancelled"        // Task no longer needed
}

interface IntelligentTodo {
  id: string;
  content: string;
  status: TodoStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number;       // in hours
  dependencies: string[];        // IDs of prerequisite todos
  validationCriteria: string[];  // Completion validation requirements
  assignedPhase: 1 | 2 | 3 | 4 | 5 | 6;  // AI Development Framework phase
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  validatedAt?: Date;
}
```

#### Todo Validation Framework
```markdown
# Comprehensive Todo Validation Strategy

## Pre-Completion Validation Checklist
Before marking any todo as "completed", AI must verify:

### 1. Technical Validation
- [ ] All code compiles without errors
- [ ] All tests pass (unit, integration, e2e as applicable)
- [ ] Code follows project conventions and patterns
- [ ] Performance requirements met (if applicable)
- [ ] Security requirements satisfied
- [ ] No new vulnerabilities introduced

### 2. Quality Validation
- [ ] Code review checklist items satisfied
- [ ] Documentation updated appropriately
- [ ] Error handling implemented correctly
- [ ] Logging added for debugging purposes
- [ ] Input validation and sanitization applied

### 3. Integration Validation
- [ ] Changes integrate properly with existing system
- [ ] No breaking changes introduced to public APIs
- [ ] Database migrations work correctly
- [ ] Frontend components render and function properly
- [ ] Backend services respond correctly

### 4. Testing Validation
- [ ] Appropriate tests written and passing
- [ ] Test coverage maintains or improves
- [ ] Edge cases covered in testing
- [ ] Performance tests pass (if applicable)
- [ ] Security tests validate protection mechanisms

### 5. Documentation Validation
- [ ] Code comments added where necessary
- [ ] API documentation updated
- [ ] User documentation updated (if applicable)
- [ ] README files updated with new instructions
- [ ] CLAUDE.md or AGENTS.md updated if patterns change
```

### Todo Templates for Common Scenarios

#### New Connector Development Template
```markdown
# New [Database/System] Connector Implementation
## Epic Todo: "Implement [SystemName] connector for OpenMetadata"

### Phase 1: Discovery & Planning
- [ ] Research [SystemName] API/connection requirements
- [ ] Analyze existing connector patterns in codebase
- [ ] Identify required dependencies and libraries
- [ ] Document connection configuration schema
- [ ] Plan testing strategy with sample data

### Phase 2: Core Implementation
- [ ] Create connector base class extending appropriate parent
- [ ] Implement connection validation logic
- [ ] Implement metadata extraction methods
- [ ] Create configuration Pydantic models
- [ ] Add error handling and retry mechanisms

### Phase 3: Schema & Entity Mapping
- [ ] Implement database/schema discovery
- [ ] Implement table/collection metadata extraction
- [ ] Implement column/field metadata extraction
- [ ] Map data types to OpenMetadata standard types
- [ ] Implement relationship detection logic

### Phase 4: Testing & Validation
- [ ] Write unit tests for all connector methods
- [ ] Create integration tests with mock data
- [ ] Test with real [SystemName] instance
- [ ] Validate metadata accuracy and completeness
- [ ] Performance test with large schemas

### Phase 5: Documentation & Integration
- [ ] Update connector documentation
- [ ] Add configuration examples
- [ ] Update ingestion workflow templates
- [ ] Create sample configuration files
- [ ] Update supported connectors list

### Phase 6: Final Validation
- [ ] Code review and approval
- [ ] All tests passing in CI/CD
- [ ] Performance benchmarks met
- [ ] Security scan passes
- [ ] Documentation complete and accurate
```

#### API Endpoint Development Template
```markdown
# New API Endpoint Implementation
## Epic Todo: "Add [EndpointName] API endpoint with full CRUD operations"

### Phase 1: API Design & Planning
- [ ] Define API contract and OpenAPI specification
- [ ] Design request/response schemas
- [ ] Plan authentication and authorization requirements
- [ ] Identify database schema requirements
- [ ] Document error handling strategy

### Phase 2: Backend Implementation
- [ ] Create JAX-RS resource class with endpoints
- [ ] Implement service layer business logic
- [ ] Create repository/DAO layer for data access
- [ ] Add input validation and sanitization
- [ ] Implement proper error handling and responses

### Phase 3: Database & Schema
- [ ] Create or update database entities
- [ ] Write Flyway migration scripts
- [ ] Update JDBI mappers and queries
- [ ] Add database indexes for performance
- [ ] Test migration scripts thoroughly

### Phase 4: Security & Validation
- [ ] Implement authentication checks
- [ ] Add role-based authorization
- [ ] Validate input sanitization prevents injection
- [ ] Add rate limiting if required
- [ ] Implement audit logging

### Phase 5: Testing Strategy
- [ ] Write comprehensive unit tests
- [ ] Create integration tests for all endpoints
- [ ] Test authentication and authorization flows
- [ ] Performance test with realistic data volumes
- [ ] Test error scenarios and edge cases

### Phase 6: Documentation & Integration
- [ ] Update OpenAPI documentation
- [ ] Create API usage examples
- [ ] Update postman collections
- [ ] Add endpoint to API reference docs
- [ ] Validate documentation accuracy
```

#### Frontend Component Development Template
```markdown
# New Frontend Component Implementation
## Epic Todo: "Create [ComponentName] React component with full functionality"

### Phase 1: Component Design & Planning
- [ ] Design component interface and props
- [ ] Plan component state management approach
- [ ] Identify required API integrations
- [ ] Design responsive layout and styling
- [ ] Plan accessibility requirements

### Phase 2: Component Implementation
- [ ] Create base React component structure
- [ ] Implement component logic and state management
- [ ] Add API integration with error handling
- [ ] Implement responsive design with Ant Design
- [ ] Add loading states and error boundaries

### Phase 3: Interactivity & Features
- [ ] Implement user interaction handlers
- [ ] Add form validation if applicable
- [ ] Implement search/filter functionality
- [ ] Add pagination for large datasets
- [ ] Implement real-time updates if needed

### Phase 4: Testing & Validation
- [ ] Write Jest unit tests for component logic
- [ ] Create React Testing Library tests for UI
- [ ] Add Playwright E2E tests for workflows
- [ ] Test accessibility with screen readers
- [ ] Validate responsive design on all breakpoints

### Phase 5: Integration & Performance
- [ ] Integrate component into parent pages
- [ ] Optimize performance with React.memo/useMemo
- [ ] Implement lazy loading if applicable
- [ ] Test component in different contexts
- [ ] Validate bundle size impact

### Phase 6: Documentation & Polish
- [ ] Add TypeScript interfaces and documentation
- [ ] Create Storybook stories for component
- [ ] Update component library documentation
- [ ] Add usage examples and best practices
- [ ] Final accessibility and UX review
```

### AI Todo Progress Management

**CRITICAL AI DIRECTIVE**: AI agents MUST proactively monitor and analyze todo progress using intelligent assessment patterns.

#### Progress Analysis Requirements
AI agents must continuously evaluate:

**📊 Todo Health Metrics**
- **Completion Rate**: Track percentage of completed vs total todos
- **Blocking Rate**: Identify todos stuck due to dependencies
- **Phase Distribution**: Ensure balanced progress across all 6 development phases
- **Velocity Trends**: Monitor completion patterns over time

**🔍 Intelligent Recommendations**
When analyzing todos, AI must generate contextual recommendations:
- **Dependency Bottlenecks**: Identify and prioritize blocked todos
- **Phase Imbalances**: Flag excessive discovery phase todos vs completion
- **Resource Allocation**: Suggest focus areas based on critical path analysis
- **Risk Mitigation**: Early warning for overdue or high-risk todos

**⚡ Proactive Actions Required**
- Update todo status immediately after any significant progress
- Flag todos that remain "in_progress" for >48 hours without updates
- Automatically suggest breaking down large todos (>8 subtasks)
- Escalate critical todos that fail validation multiple times

### AI Validation Requirements

**MANDATORY VALIDATION PROTOCOL**: Every todo completion MUST pass comprehensive validation before marking as complete.

#### Core Validation Principles
🚨 **NEVER mark a todo as completed without validation**
✅ **ALWAYS run appropriate validation commands**
🔧 **ALWAYS fix critical issues before proceeding**
📝 **ALWAYS document validation results**

#### Technology-Specific Validation Commands

**Java/Backend Validation:**
```
mvn clean compile          # Must pass for Java todos
mvn spotless:apply         # Must run for formatting
mvn test                   # Must pass for code changes
```

**Python/Ingestion Validation:**
```
cd ingestion && make lint   # Must pass for Python todos
make py_format             # Must run for formatting
make unit_ingestion        # Must pass for connector changes
```

**Frontend/React Validation:**
```
cd openmetadata-ui/src/main/resources/ui
yarn build                # Must succeed for UI todos
yarn lint:fix              # Must run for formatting
yarn test                  # Must pass for component changes
```

**Security Validation (CRITICAL):**
- **API Endpoints**: MUST include input sanitization checks
- **Search Features**: MUST use SearchUtils.sanitizeQueryParameter()
- **User Inputs**: MUST validate and escape all user-provided data
- **Authentication**: MUST verify proper JWT validation

**Performance Validation:**
- **Database Changes**: MUST include migration rollback tests
- **API Changes**: MUST verify response time <100ms
- **Frontend Changes**: MUST check bundle size impact
- **Memory Usage**: MUST monitor resource consumption

#### Validation Failure Response
When validation fails, AI MUST:
1. **STOP** - Do not mark todo as complete
2. **ANALYZE** - Identify root cause of failure
3. **FIX** - Address the issue or create new todos for fixes
4. **RETRY** - Re-run validation after fixes
5. **DOCUMENT** - Record what was fixed and why

## AI Behavioral Guidelines for Todo Excellence

### Mandatory AI Todo Behaviors

**🎯 PROACTIVE TODO MANAGEMENT**: AI agents must demonstrate proactive todo management throughout all interactions.

#### Core Behavioral Requirements

**1. Todo Creation Triggers (ALWAYS)**
AI must create todos when encountering:
- User requests with multiple steps or components
- Complex problem-solving requiring systematic approach
- Feature requests requiring cross-module changes
- Bug reports needing investigation and resolution
- Performance optimization tasks
- Security vulnerability remediation
- Documentation updates for significant changes

**2. Todo Status Management (REAL-TIME)**
AI must update todo status immediately when:
- Starting work on a pending todo (mark as in_progress)
- Completing any todo deliverable (mark as completed with validation)
- Encountering blockers or dependencies (mark as blocked with details)
- Discovering additional work needed (create dependent todos)
- Finding todos no longer relevant (mark as cancelled with reasoning)

**3. Quality Gates (NON-NEGOTIABLE)**
AI must enforce quality gates at every todo completion:
- **Technical Quality**: Code compiles, tests pass, standards met
- **Security Quality**: Vulnerabilities addressed, sanitization implemented
- **Performance Quality**: Benchmarks met, optimization verified
- **Documentation Quality**: Changes documented, examples provided
- **Integration Quality**: System integration verified, compatibility confirmed

### AI Communication Patterns for Todos

**📝 TODO TRANSPARENCY**: AI must provide clear visibility into todo management.

#### Required Communication Elements

**When Creating Todos:**
```markdown
"I'm creating a comprehensive todo list to track this multi-step implementation:
1. [Phase X] Specific deliverable with clear success criteria
2. [Phase Y] Next deliverable with dependencies noted
3. [Phase Z] Final deliverable with validation requirements"
```

**When Updating Todo Status:**
```markdown
"Marking todo 'X' as completed after successful validation:
✅ Technical validation passed (compilation, tests, linting)
✅ Security validation passed (input sanitization, auth checks)
✅ Performance validation passed (response times, memory usage)
✅ Integration validation passed (system compatibility confirmed)"
```

**When Encountering Issues:**
```markdown
"Todo 'X' is blocked due to [specific issue]. Creating remediation plan:
- New todo: Investigate root cause of [specific problem]
- New todo: Implement fix for [specific solution]
- Dependency: Todo 'X' cannot proceed until remediation complete"
```

### AI Problem-Solving Framework

**🔬 SYSTEMATIC APPROACH**: AI must follow structured problem-solving for all todos.

#### Problem Decomposition Strategy
1. **Scope Analysis**: Define clear boundaries and impact assessment
2. **Dependency Mapping**: Identify prerequisites and downstream effects
3. **Risk Assessment**: Evaluate potential issues and mitigation strategies
4. **Solution Design**: Plan implementation approach with alternatives
5. **Validation Planning**: Define success criteria and testing approach
6. **Progress Tracking**: Monitor execution with measurable milestones

#### AI Learning Integration
**🧠 CONTINUOUS IMPROVEMENT**: AI must learn from todo execution patterns.

- **Pattern Recognition**: Identify common todo types and optimize templates
- **Success Analysis**: Study completed todos to improve future estimates
- **Failure Analysis**: Learn from validation failures to prevent recurrence
- **Efficiency Optimization**: Streamline todo workflows based on experience
- **Knowledge Transfer**: Apply lessons learned across similar todo scenarios

### AI Collaboration Guidelines

**🤝 STAKEHOLDER ENGAGEMENT**: AI must maintain clear stakeholder communication throughout todo lifecycle.

#### User Interaction Patterns
- **Expectation Setting**: Clearly communicate scope, timeline, and dependencies
- **Progress Updates**: Provide regular status updates on todo completion
- **Issue Escalation**: Promptly communicate blockers and resolution plans
- **Success Confirmation**: Validate completion with user before marking todos complete
- **Feedback Integration**: Incorporate user feedback into todo refinement

#### Cross-Reference Intelligence
AI must leverage both AGENTS.md and CLAUDE.md effectively:
- **Repository Navigation**: Use AGENTS.md for codebase structure understanding
- **Development Execution**: Apply CLAUDE.md advanced patterns and validation
- **Best Practice Integration**: Combine insights from both guides for optimal outcomes
- **Knowledge Synthesis**: Create comprehensive solutions using integrated intelligence

### AI Quality Assurance Mindset

**⚡ EXCELLENCE STANDARD**: AI must maintain unwavering commitment to quality in all todo deliverables.

#### Quality Principles
- **Zero Defect Tolerance**: All todos must meet quality standards before completion
- **Security First**: Security considerations integrated into every todo from inception
- **Performance Awareness**: Performance impact assessed and optimized continuously
- **User Experience Focus**: End-user impact considered in all technical decisions
- **Maintainability Priority**: Code quality and documentation prioritized for long-term success

#### Continuous Validation
- **Early Validation**: Validate work continuously, not just at completion
- **Automated Checks**: Leverage automated validation wherever possible
- **Manual Review**: Apply human-like critical thinking to complex validations
- **Regression Prevention**: Ensure changes don't break existing functionality
- **Future-Proofing**: Consider long-term implications of all todo implementations