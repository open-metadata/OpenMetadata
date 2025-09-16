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
yarn test path/to/test.spec.ts # Run a specific test file
yarn test:watch               # Run tests in watch mode
yarn playwright:run            # Run E2E tests
yarn lint                      # ESLint check
yarn lint:fix                  # ESLint with auto-fix
yarn build                     # Production build
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
yarn parse-schema              # Parse JSON schemas for frontend (connection and ingestion schemas)
```

### Schema Architecture
- **Source schemas** in `openmetadata-spec/` define the canonical data models
- **Connection schemas** are pre-processed at build time via `parseSchemas.js` to resolve all `$ref` references
- **Application schemas** in `openmetadata-ui/.../ApplicationSchemas/` are resolved at runtime using `schemaResolver.ts`
- JSON schemas with `$ref` references to external files require resolution before use in forms

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
2. **Backend**: Develop in Java using Dropwizard patterns, test with `mvn test`, format with `mvn spotless:apply`
3. **Frontend**: Use React/TypeScript with Ant Design components, test with Jest/Playwright
4. **Ingestion**: Python connectors follow plugin pattern, use `make install_dev_env` for development
5. **Full Testing**: Use `make run_e2e_tests` before major changes

## Frontend Architecture Patterns

### React Component Patterns
- **File Naming**: Components use `ComponentName.component.tsx`, interfaces use `ComponentName.interface.ts`
- **State Management**: Use `useState` with proper typing, avoid `any`
- **Side Effects**: Use `useEffect` with proper dependency arrays
- **Performance**: Use `useCallback` for event handlers, `useMemo` for expensive computations
- **Custom Hooks**: Prefix with `use`, place in `src/hooks/`, return typed objects
- **Internationalization**: Use `useTranslation` hook from react-i18next, access with `t('key')`
- **Component Structure**: Functional components only, no class components
- **Props**: Define interfaces for all component props, place in `.interface.ts` files
- **Loading States**: Use object state for multiple loading states: `useState<Record<string, boolean>>({})`
- **Error Handling**: Use `showErrorToast` and `showSuccessToast` utilities from ToastUtils
- **Navigation**: Use `useNavigate` from react-router-dom, not direct history manipulation
- **Data Fetching**: Async functions with try-catch blocks, update loading states appropriately

### State Management
- Use Zustand stores for global state (e.g., `useLimitStore`, `useWelcomeStore`)
- Keep component state local when possible with `useState`
- Use context providers for feature-specific shared state (e.g., `ApplicationsProvider`)

### Styling
- Use Ant Design components as the primary UI library
- Custom styles in `.less` files with component-specific naming
- Follow BEM naming convention for custom CSS classes
- Use CSS modules where appropriate

### Application Configuration
- Applications use `ApplicationsClassBase` for schema loading and configuration
- Dynamic imports handle application-specific schemas and assets
- Form schemas use React JSON Schema Form (RJSF) with custom UI widgets

### Service Utilities
- Each service type has dedicated utility files (e.g., `DatabaseServiceUtils.tsx`)
- Connection schemas are imported statically and pre-resolved
- Service configurations use switch statements to map types to schemas

### Type Safety
- All API responses have generated TypeScript interfaces in `generated/`
- Custom types extend base interfaces when needed
- Avoid type assertions unless absolutely necessary
- Use discriminated unions for action types and state variants

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

### TypeScript/Frontend Code Requirements
- **NEVER use `any` type** in TypeScript code - always use proper types
- Use `unknown` when the type is truly unknown and add type guards
- Import types from existing type definitions (e.g., `RJSFSchema` from `@rjsf/utils`)
- Follow ESLint rules strictly - the project enforces no-console, proper formatting
- Add `// eslint-disable-next-line` comments only when absolutely necessary
- **Import Organization** (in order):
  1. External libraries (React, Ant Design, etc.)
  2. Internal absolute imports from `generated/`, `constants/`, `hooks/`, etc.
  3. Relative imports for utilities and components
  4. Asset imports (SVGs, styles)
  5. Type imports grouped separately when needed

### Response Format
- Provide clean code blocks without unnecessary explanations
- Assume readers are experienced developers
- Focus on functionality over education
