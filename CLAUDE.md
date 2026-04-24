# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About OpenMetadata

OpenMetadata is a unified metadata platform for data discovery, data observability, and data governance. This is a multi-module project with Java backend services, React frontend, Python ingestion framework, and comprehensive Docker infrastructure.

For architecture deep dives, entity/repository/resource patterns, and end-to-end checklists for adding new entities or connectors, see [DEVELOPER.md](DEVELOPER.md).

## Architecture Overview

- **Backend**: Java 21 + Dropwizard REST API framework, multi-module Maven project
- **Frontend**: React + TypeScript, built with Webpack and Yarn; component library via `openmetadata-ui-core-components` (Tailwind CSS v4 with `tw:` prefix, react-aria-components foundation)
- **Ingestion**: Python 3.10-3.11 with Pydantic 2.x, 75+ data source connectors
- **Database**: MySQL (default) or PostgreSQL with Flyway migrations
- **Search**: Elasticsearch 7.17+ or OpenSearch 2.6+ for metadata discovery
- **Infrastructure**: Apache Airflow for workflow orchestration

## Environment Setup

### Python Virtual Environment (REQUIRED)

**You MUST activate the Python venv before any Python work.** OpenMetadata supports Python 3.10-3.11; 3.11 is recommended.

```bash
# First-time setup (creates venv at repo root):
# python3.11 -m venv env

# ALWAYS activate before running Python, make generate, make install_dev, etc:
source env/bin/activate

# Verify:
python --version   # Should show Python 3.10.x or 3.11.x
```

**In worktrees**: When Claude Code creates a Git worktree, the venv from the main repo is NOT copied. You need to either:
- Create a new venv in the worktree: `python3.11 -m venv env && source env/bin/activate && cd ingestion && make install_dev`
- Or symlink the main repo's venv: `ln -s /path/to/main-repo/env env`

### Initial Dev Environment Setup

After activating the venv, install all dependencies:

```bash
source env/bin/activate

# Install ingestion module with all dev dependencies (required before make generate)
cd ingestion
make install_dev_env            # Full dev environment (edit mode + all extras)
# OR for lighter install:
make install_dev                # Just dev dependencies
cd ..

# Generate Pydantic models from JSON schemas (required after schema changes)
make generate

# Install UI dependencies
make yarn_install_cache
```

### Other Environment Notes

- **Java**: Java 21 required. Use `mvn` (Maven) for backend builds.
- **Node/Yarn**: Use `yarn` (not `npm`) for frontend. Frontend root is `openmetadata-ui/src/main/resources/ui/`.
- **Docker services**: Development services (MySQL, Elasticsearch, etc.) run via `docker/development/docker-compose.yml`:
  ```bash
  docker compose -f docker/development/docker-compose.yml up -d
  ```

## Essential Development Commands

### Prerequisites and Setup
```bash
make prerequisites              # Check system requirements
source env/bin/activate         # ALWAYS activate venv first
cd ingestion && make install_dev_env  # Install Python dev dependencies
make generate                  # Generate Pydantic models from JSON schemas
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

### Frontend CI Checkstyle (run before PR to match CI)
```bash
cd openmetadata-ui/src/main/resources/ui
yarn ui-checkstyle:changed         # One-shot checkstyle for changed files (excludes tsc)
yarn organize-imports:cli <files>  # Sort and organize imports
yarn lint:fix                      # ESLint auto-fix
yarn pretty:base --write <files>   # Prettier formatting
yarn license-header-fix <files>    # Add Apache 2.0 license headers
yarn i18n                          # Sync all 17 locale files with en-us.json
yarn generate:app-docs             # Regenerate application documentation
npx tsc --noEmit                   # TypeScript type check (catches errors early)
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

### Backend Integration Tests
All backend API integration tests MUST be placed in `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/` directory. Tests should:
- Use naming convention `*IT.java` (Integration Test)
- Extend `BaseEntityIT<T, K>` for entity CRUD tests
- Be designed to run concurrently (use `@Execution(ExecutionMode.CONCURRENT)`)
- Use `TestNamespace` for test isolation
- Use `SdkClients` for API calls (e.g., `SdkClients.adminClient().tables().create(...)`)

```bash
# Run a specific integration test
mvn test -pl openmetadata-integration-tests -Dtest=TaskResourceIT

# Run all integration tests
mvn test -pl openmetadata-integration-tests
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
3. **Frontend**: Use React/TypeScript with components from `openmetadata-ui-core-components`, test with Jest/Playwright
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

- **Component Library**: Use components from `openmetadata-ui-core-components` for all new UI work. This is the canonical component library — do not use MUI or introduce new MUI dependencies.
- **Available Components**: Button, Input, Select, Modal, Table, Tabs, Pagination, Badge, Avatar, Checkbox, Dropdown, Form, Card, Tooltip, Toggle, Slider, Textarea, Tags, and more — all in `openmetadata-ui-core-components/src/main/resources/ui/src/components/`
- **Tailwind Classes**: All Tailwind utility classes must use the `tw:` prefix (e.g., `tw:flex`, `tw:text-sm`, `tw:bg-blue-500`) to avoid conflicts with existing Ant Design/Less styles
- **Design Tokens**: Use CSS custom properties defined in `openmetadata-ui-core-components/src/main/resources/ui/src/styles/globals.css`. Never use hardcoded color or spacing values. Semantic tokens include:
  - Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-error-primary`, etc.
  - Border: `--color-border-primary`, `--color-border-secondary`, `--color-border-error`, `--color-border-brand`, etc.
  - Background: `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-error-primary`, `--color-bg-brand-solid`, etc.
  - Shadows: `--shadow-xs` through `--shadow-3xl`
  - Border radius: `--radius-none` through `--radius-full`
- **MUI**: Do not use MUI — we are actively removing MUI from the codebase. Do not import from `@mui/*` or `@emotion/*`
- **Legacy**: Ant Design components remain in existing code but should be replaced with `openmetadata-ui-core-components` equivalents when refactoring
- Do not add unnecessary spacing between logs and code.
- In Java, avoid wildcards imports (e.g., use `import java.util.List;` instead of `import java.util.*;`)
- Custom styles in `.less` files with component-specific naming (legacy pattern, avoid for new code)
- Follow BEM naming convention for custom CSS classes when writing raw CSS

### UI considerations

- Do not use string literals at any place. You should use useTranslation hook and use it like const {t} = useTranslation(). And for example if you want to have "Run" as string, you should be using { t('label.run') }, this label is defined in locales.


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
- **NEVER add single-line comments that describe what the code obviously does**
- Only include comments for:
    - Complex business logic that isn't obvious
    - Non-obvious algorithms or workarounds
    - Public API JavaDoc documentation
    - TODO/FIXME with ticket references
- Bad examples (NEVER do this):
    - `// Create user` before `createUser()`
    - `// Get client` before `SdkClients.adminClient()`
    - `// Verify domain is set` before `assertNotNull(entity.getDomain())`
    - `// User names are lowercased` when the code `toLowerCase()` makes it obvious
- If the code needs a comment to be understood, refactor the code to be clearer instead

### Java Code Requirements

**Always run `mvn spotless:apply` when generating/modifying .java files.**

#### Method Size and Complexity (Kafka-Grade Standards)
- **Methods must be 15 lines or fewer** (excluding blank lines and braces). If a method is longer, break it into smaller focused methods with descriptive names.
- **Maximum 3 levels of nesting.** Use early returns to reduce nesting:
  ```java
  // BAD: deeply nested
  if (entity != null) {
      if (entity.isActive()) {
          if (hasPermission(entity)) {
              process(entity);
          }
      }
  }

  // GOOD: early returns, flat
  if (entity == null) return;
  if (!entity.isActive()) return;
  if (!hasPermission(entity)) return;
  process(entity);
  ```
- **Maximum 10 cyclomatic complexity.** Extract complex conditions into named methods:
  ```java
  // BAD: complex inline boolean
  if (entity.getStatus() == ACTIVE && entity.getOwner() != null
      && !entity.isDeleted() && entity.getVersion() > 0.1) { ... }

  // GOOD: self-documenting
  if (isEligibleForProcessing(entity)) { ... }
  ```
- **Maximum 5 parameters.** Introduce a parameter object or builder for more.
- **Each method does one thing.** If you can describe what a method does using "and" or "then", it should be two methods.

#### Naming and Readability
- Names should make code read like prose — if you need a comment, the name isn't good enough
- **Methods**: verb phrases — `calculateScore()`, `findByName()`, `isValid()`
- **Booleans**: question-form — `isActive`, `hasPermission`, `canRetry` (never `flag`, `status`, `check`)
- **Variables**: descriptive, no abbreviations — `entityReference` not `er`, `retryCount` not `rc`
- **Constants**: `UPPER_SNAKE_CASE` — `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`
- **No single-letter variables** except in short lambdas or loop indices

#### Immutability and Defensive Design
- Use `final` on local variables and parameters that don't change (which is most of them)
- Use `final` on fields set in the constructor
- Return `Collections.unmodifiableList()` / `List.copyOf()` from public methods, never expose internal mutable collections
- Utility classes must be `final` with a private constructor
- Prefer `record` for immutable data carriers where appropriate

#### Error Handling
- **No empty catch blocks** — at minimum, log the exception
- **No `catch (Exception e)`** — catch the specific type you expect
- **No `e.printStackTrace()`** — use the logger
- **Error messages must include context**: `"Table '%s' not found in database '%s'"` not just `"Not found"`
- **No `throw` or `return` inside `finally` blocks** — they mask the original exception
- **No exceptions for flow control** — use conditionals for expected cases

#### No Magic Strings — Define Constants
- **Never use raw string literals in `.equals()`, `.contains()`, or `switch` cases** — define a constant or use an existing enum
- If an enum already exists in `openmetadata-spec/` schemas for those values, use it
- If the same string appears in more than one place, it must be a named constant
- **One definition, one location** — don't define the same constant in multiple classes
- Prefer enums over string constants when the values form a closed set:
  ```java
  // BAD: magic strings scattered everywhere
  if (taskStatus.equals("Open")) { ... }
  if (config.getResources().get(0).equals("all")) { ... }

  // GOOD: use existing enums or define constants
  if (taskStatus == TaskStatus.OPEN) { ... }
  private static final String RESOURCE_ALL = "all";
  ```

#### No Convoluted if/else Chains
- **More than 3 `else if` branches means the structure is wrong — refactor:**
  - `else if` chain on `instanceof` → `switch` with pattern matching (Java 21)
  - `else if` chain on enum values → `switch` expression
  - `else if` chain on `.equals("string")` → `Map` dispatch or enum lookup
  - `else if` chain on `.contains("string")` → `Map` or list of predicates
- **Repeated compound conditions** (same multi-part `&&`/`||` expression in multiple places) → extract into a named method or `Set.contains()`
  ```java
  // BAD: 3-part condition repeated 3 times across the file
  if (!tenantId.equals("common") && !tenantId.equals("organizations")
      && !tenantId.equals("consumers")) { ... }

  // GOOD: define once, use everywhere
  private static final Set<String> MULTI_TENANT_IDS =
      Set.of("common", "organizations", "consumers");

  private boolean isSingleTenant(String tenantId) {
      return !MULTI_TENANT_IDS.contains(tenantId);
  }
  ```

#### No Code Duplication
- If the same logic exists in two places, extract to a shared method
- Near-identical methods (e.g., same logic for OpenSearch and ElasticSearch) should share a common implementation with only the engine-specific parts varying
- Copy-pasted blocks within the same file should be extracted into a parameterized method

#### Class Size
- **Classes should be under 500 lines.** Over 1000 lines is a design problem.
- If a class is large, look for clusters of methods that operate on the same subset of fields — extract them into a new focused class
- Resource classes should be thin orchestrators
- Repository classes handle data access, not business logic

#### Modern Java (Java 21)
- Use try-with-resources for all `AutoCloseable` objects
- Use diamond operator `<>` — `new ArrayList<>()` not `new ArrayList<String>()`
- Use pattern matching: `if (obj instanceof String s)` instead of cast
- Use `switch` expressions instead of `if/else if` chains on enums or types
- Use `List.of()`, `Map.of()`, `Set.of()` for immutable collection literals
- Use `Optional` correctly: never as a field type, never as a parameter, never assign `null` to it
- Use text blocks `"""` for multi-line strings

#### Common Bug Patterns to Avoid
- `equals()` without `hashCode()` (or vice versa)
- `equals()` on arrays — use `Arrays.equals()`
- Ignoring return values of `String.replace()`, `File.delete()`
- `collection.size() == 0` — use `collection.isEmpty()`
- String concatenation inside loops — use `StringBuilder`
- `synchronized` on non-final fields — the lock reference can change
- `toLowerCase()` without `Locale` — always use `toLowerCase(Locale.ROOT)`
- Double map lookups — use `computeIfAbsent()` or `getOrDefault()`

#### Testing
- Generate production-ready code, not tutorial code
- Create integration tests in `openmetadata-integration-tests` for new API endpoints
- **Never use `Thread.sleep()` in tests** — use condition-based waiting or `Awaitility`
- Bug fixes must include a test that fails without the fix
- 90% line coverage target on changed classes

#### Structure
- Do not use Fully Qualified Names in code (e.g., `org.openmetadata.schema.type.Status`) — import the class instead
- Do not import wildcard packages — import exactly the required classes
- No commented-out code — version control maintains history
- No TODOs without a ticket reference
- One statement per line — no `if (x) return y;` on one line

### TypeScript/Frontend Code Requirements
- **NEVER use `any` type** in TypeScript code - always use proper types
- Use `unknown` when the type is truly unknown and add type guards
- Import types from existing type definitions (e.g., `RJSFSchema` from `@rjsf/utils`)
- Add `// eslint-disable-next-line` comments only when absolutely necessary
- **Import Organization** — use `yarn organize-imports:cli` to auto-sort. Order:
  1. External libraries (React, etc.)
  2. Internal absolute imports from `generated/`, `constants/`, `hooks/`, etc.
  3. Relative imports for utilities and components
  4. Asset imports (SVGs, styles)
  5. Type imports grouped separately when needed

#### CI Checkstyle Rules (enforced on every PR)
These checks run automatically in CI. Code that violates them **will not merge**.
- **No `console.log/warn/error`** — `no-console` rule is enforced. Use the logger or remove.
- **Use `===` not `==`** — `eqeqeq` (smart mode, except for `null` checks)
- **Max 200 characters per line** — break long lines
- **Self-closing components** — `<Div />` not `<Div></Div>`
- **Sort JSX props alphabetically** — callbacks last
- **Space after `//` in comments** — `// comment` not `//comment`
- **Blank lines** before `function`, `class`, `export`, `return` statements
- **Use `it()` consistently in tests** — don't mix `test()` and `it()`
- **Blank lines around `describe`, `it`, `beforeEach`** in test files
- **JSON keys sorted alphabetically** in locale files (`src/locale/**/*.json`)
- **Apache 2.0 license header** on every new source file — run `yarn license-header-fix`
- **i18n keys synced** — after adding keys to `en-us.json`, run `yarn i18n` to sync all 17 locales
- **Prettier formatting** — 2-space indent, single quotes, strict HTML whitespace

#### Playwright Test Rules (lint-playwright)
- **No `waitForLoadState('networkidle')`** — flaky, use web-first assertions
- **No `page.pause()`** — remove before committing
- **No `.only` on tests** — blocks all other tests in CI
- Prefer `expect(locator).toBeVisible()` over manual `waitForSelector` checks
- Don't use `{ force: true }` — fix the locator instead
- Use locators, not element handles

### Python Code Requirements
- **Use pytest, not unittest** - write tests using pytest style with plain `assert` statements
- Use pytest fixtures for test setup instead of `setUp`/`tearDown` methods
- Use `unittest.mock` for mocking (MagicMock, patch) - this is compatible with pytest
- Test classes should not inherit from `TestCase` - use plain classes prefixed with `Test`
- Use `assert x == y` instead of `self.assertEqual(x, y)`
- Use `assert x is None` instead of `self.assertIsNone(x)`
- Use `assert "text" in string` instead of `self.assertIn("text", string)`

### Python Ingestion Connector Guidelines
- **Keep connector-specific logic in connector-specific files**, not in generic/shared files like `builders.py`
- Example: Redshift IAM auth should be in `ingestion/src/metadata/ingestion/source/database/redshift/connection.py`, not in `ingestion/src/metadata/ingestion/connections/builders.py`
- This keeps the codebase modular and prevents generic utilities from becoming cluttered with connector-specific edge cases
- **Use `model_str()` for Pydantic RootModel to string conversion** — OpenMetadata schema types like `ColumnName`, `EntityName`, `FullyQualifiedEntityName`, and `UUID` are Pydantic `RootModel[str]` subclasses where `str()` returns `"root='value'"` instead of the raw value. Always use `model_str()` from `metadata.ingestion.ometa.utils` instead of manual `hasattr(x, "root")` / `str(x.root)` checks.

### Testing Philosophy
- **Test real behavior, not mock wiring** - if a test requires mocking 3+ classes just to verify a method call, it's testing the wrong thing
- **Prefer integration tests** over heavily-mocked unit tests. This project has full integration test infrastructure (OpenMetadataApplicationTest, Docker containers, real OpenSearch). Use it.
- **Mocks are for boundaries, not internals** - mock external services (HTTP clients, third-party APIs), not your own classes. If you're mocking static methods left and right to test internal plumbing, write an integration test instead.
- **A test that mocks everything proves nothing** - it only verifies that your mocks are wired correctly, not that the system works
- **Ask "what breaks if this test passes but the code is wrong?"** - if the answer is "nothing, because everything real is mocked out", delete the test and write a better one
- **Test the outcome, not the implementation** - assert on observable results (API responses, database state, stats values) rather than verifying internal method calls with `verify()`

### Response Format
- Provide clean code blocks without unnecessary explanations
- Assume readers are experienced developers
- Focus on functionality over education
