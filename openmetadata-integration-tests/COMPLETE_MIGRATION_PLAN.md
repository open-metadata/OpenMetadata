# Complete Test Migration Plan
**Date:** 2025-10-02
**Scope:** Full migration of EntityResourceTest + DatabaseResourceTest (103 tests)

## Current Situation

### EntityResourceTest Analysis
- **File:** 8,163 lines of code
- **Common Tests:** 92 tests that ALL entities inherit
- **Setup Complexity:** Creates 50+ reference entities (users, teams, policies, services, tags, domains, etc.)
- **Feature Flags:** Tests conditionally run based on entity capabilities (supports Followers, Owners, Tags, etc.)
- **Execution:** Tests marked with `@Execution(ExecutionMode.CONCURRENT)` for parallel execution

### Test Categories in EntityResourceTest

1. **CRUD Operations** (20 tests)
   - Entity creation with various field combinations
   - Entity retrieval (by ID, by name, with field filtering)
   - Entity updates (PATCH operations)
   - Entity deletion (soft and hard delete)
   - List operations with pagination

2. **Permissions & Access Control** (15 tests)
   - Role-based access testing
   - Domain-level permissions
   - Team-only policies
   - Required field validation
   - Duplicate entity detection

3. **Ownership & Relationships** (20 tests)
   - Owner assignment (user/team)
   - Owner updates and removal
   - Follower management
   - Relationship filtering
   - Inheritance rules

4. **Tags & Classification** (10 tests)
   - Tag assignment and removal
   - Tag label management
   - Tier tagging
   - Tag-based filtering
   - Classification validation

5. **Domains & Data Products** (8 tests)
   - Domain assignment
   - Sub-domain inheritance
   - Data product linking
   - Domain-based filtering
   - Multi-domain rules

6. **Versioning & Change Events** (10 tests)
   - Version history tracking
   - Change event generation
   - Major vs minor updates
   - Soft delete and restore
   - Hard delete with cascade

7. **Extension & Custom Properties** (5 tests)
   - Custom property creation
   - Extension updates
   - Property removal
   - Extension validation

8. **Search & Advanced Features** (4 tests)
   - Search by term
   - Advanced filtering
   - Bulk operations
   - CSV import/export

### Database-Specific Tests (11 tests)
From DatabaseResourceTest:
1. `post_databaseFQN_as_admin_200_OK` ✅ DONE
2. `post_databaseWithoutRequiredService_4xx` ✅ DONE
3. `post_databaseWithDifferentService_200_ok`
4. `testImportInvalidCsv`
5. `testImportExport`
6. `testImportExportRecursive`
7. `testBulkServiceFetchingForDatabases`
8. `testDatabaseRdfRelationships`
9. `testDatabaseRdfSoftDeleteAndRestore`
10. `testDatabaseRdfHardDelete`
11. `testDatabaseCsvDocumentation`

## Migration Strategy

### Challenge: The Complexity Problem

**EntityResourceTest has massive setup complexity:**
```java
@BeforeAll
public void setup(TestInfo test) throws URISyntaxException, IOException {
    new PolicyResourceTest().setupPolicies();          // Creates policies
    new RoleResourceTest().setupRoles(test);           // Creates roles
    new PersonaResourceTest().setupPersonas(test);     // Creates personas
    new TeamResourceTest().setupTeams(test);           // Creates teams (with hierarchy)
    new UserResourceTest().setupUsers(test);           // Creates users
    new DomainResourceTest().setupDomains(test);       // Creates domains
    new DataProductResourceTest().setupDataProducts(test); // Creates data products
    new TagResourceTest().setupTags();                 // Creates tags/classifications
    new GlossaryResourceTest().setupGlossaries();      // Creates glossaries
    // ... 20+ more service setup calls
}
```

This creates a **dependency graph** of 50+ reference entities that tests rely on.

### Proposed Solution: Incremental Migration

Given the complexity, we should migrate in phases:

#### Phase 1: Core CRUD Tests (This Sprint - Week 1)
**Goal:** Migrate essential CRUD operations to validate the approach

**Tests to Migrate (10 tests):**
1. `post_entityCreate_200_OK`
2. `post_entityCreateWithInvalidName_400`
3. `post_duplicateEntity_409`
4. `get_entity_200_OK`
5. `get_entityByName_200_OK`
6. `get_entityList_200_OK`
7. `get_entityWithDifferentFields_200_OK`
8. `patch_entityAttributes_200_OK`
9. `delete_entity_soft_200`
10. `delete_entity_hard_200`

**Setup Required:**
- Minimal: Just create database service for container relationship
- No users, teams, policies needed for basic CRUD

**Deliverable:** `BaseEntityIT.java` with 10 core tests + `DatabaseResourceIT` implementing it

**Estimated Effort:** 3-4 days
**Coverage Improvement:** 2% → 12%

#### Phase 2: Ownership & Relationships (Week 2)
**Goal:** Add ownership tests

**Tests to Migrate (10 tests):**
1. `patch_addOwner_200`
2. `patch_removeOwner_200`
3. `patch_addTeamOwner_200`
4. `patch_addUserOwner_200`
5. `put_addFollower_200`
6. `put_removeFollower_200`
7. `get_entityFollowers_200`
8. `get_entitiesByOwner_200`
9. `patch_ownershipInheritance`
10. `patch_invalidOwner_400`

**Setup Required:**
- Create User factory
- Create Team factory
- Basic user/team entities

**Deliverable:** Extend `BaseEntityIT` with ownership tests

**Estimated Effort:** 3-4 days
**Coverage Improvement:** 12% → 22%

#### Phase 3: Tags & Domains (Week 3)
**Goal:** Add classification and domain tests

**Tests to Migrate (18 tests):**
- Tag operations (10 tests)
- Domain operations (8 tests)

**Setup Required:**
- Tag/Classification factory
- Domain factory
- Data Product factory

**Deliverable:** Extend `BaseEntityIT` with tags/domains

**Estimated Effort:** 4-5 days
**Coverage Improvement:** 22% → 40%

#### Phase 4: Permissions & Versioning (Week 4)
**Goal:** Add complex validation tests

**Tests to Migrate (25 tests):**
- Permission tests (15 tests)
- Versioning tests (10 tests)

**Setup Required:**
- Policy factory
- Role factory
- Version tracking utilities

**Deliverable:** Extend `BaseEntityIT` with permissions/versioning

**Estimated Effort:** 5-6 days
**Coverage Improvement:** 40% → 64%

#### Phase 5: Advanced Features (Week 5)
**Goal:** Complete common tests

**Tests to Migrate (29 tests):**
- Extensions (5 tests)
- Search (4 tests)
- Bulk operations (10 tests)
- CSV import/export (10 tests)

**Setup Required:**
- CSV utilities
- Search index helpers
- Extension schema

**Deliverable:** Complete `BaseEntityIT` with all 92 tests

**Estimated Effort:** 5-6 days
**Coverage Improvement:** 64% → 91%

#### Phase 6: Database-Specific Tests (Week 6)
**Goal:** Complete DatabaseResourceIT

**Tests to Migrate (9 remaining database tests):**
- Service-specific tests
- RDF relationship tests
- Bulk fetching tests

**Deliverable:** Complete `DatabaseResourceIT`

**Estimated Effort:** 3-4 days
**Coverage Improvement:** 91% → 100%

## Alternative: AI-Assisted Parallel Migration

Given the scale (92 tests), we can use the Hive Mind approach:

### Option A: Parallel Agent Migration (Recommended)
**Concept:** Spawn 4 specialized agents to migrate tests concurrently

**Agent Breakdown:**
1. **CRUD Agent** - Migrates 20 CRUD tests (Week 1-2)
2. **Ownership Agent** - Migrates 20 ownership/relationship tests (Week 1-2)
3. **Tags/Domains Agent** - Migrates 18 tag/domain tests (Week 2-3)
4. **Advanced Agent** - Migrates 34 advanced tests (Week 3-4)

**Timeline:** 4 weeks (vs 6 weeks sequential)

**Process:**
1. Queen coordinates overall architecture (BaseEntityIT design)
2. Each agent migrates their category independently
3. Agents commit their changes to separate branches
4. Week 5: Integration and validation
5. Week 6: Performance testing and optimization

### Option B: Manual Sequential Migration (Current Approach)
**Timeline:** 6 weeks
**Pros:** More control, easier to debug
**Cons:** Slower, manual effort

## Recommended Immediate Action

**Given your requirement for accurate performance comparison, let's do Phase 1 NOW:**

### Sprint: Core CRUD Migration (Next 3-4 Days)

**Day 1-2:** Create BaseEntityIT skeleton
- Define abstract methods
- Migrate 5 core CRUD tests
- Implement DatabaseResourceIT extension

**Day 3:** Complete remaining 5 CRUD tests
- Test pagination
- Test field filtering
- Test deletion

**Day 4:** Validation & Performance Testing
- Run old framework: `mvn test -Dtest=DatabaseResourceTest`
- Run new framework: `mvn test -Dtest=DatabaseResourceIT`
- Compare execution times with same test coverage

**Expected Results:**
- Old framework: ~117 seconds per test × 10 tests = ~19.5 minutes
- New framework: ~3 seconds per test × 10 tests = ~30 seconds
- **Speedup: 39x faster**

## Implementation Design

### BaseEntityIT Structure

```java
package org.openmetadata.it.tests;

@ExtendWith(TestNamespaceExtension.class)
public abstract class BaseEntityIT<T, K> {

    // Abstract methods for entity-specific operations
    protected abstract OpenMetadataClient.EntityClient<T, K> getEntityClient(OpenMetadataClient client);
    protected abstract K createMinimalRequest(TestNamespace ns);
    protected abstract String getEntityType();

    // Feature flags (like EntityResourceTest)
    protected boolean supportsFollowers = true;
    protected boolean supportsOwners = true;
    protected boolean supportsTags = true;
    protected boolean supportsDomains = true;
    protected boolean supportsDataProducts = true;

    // Common test methods
    @Test
    void post_entityCreate_200_OK(TestNamespace ns) {
        if (!supportsCreation()) return;

        OpenMetadataClient client = SdkClients.adminClient();
        K createRequest = createMinimalRequest(ns);
        T entity = getEntityClient(client).create(createRequest);

        assertNotNull(entity);
        // Common validations
    }

    @Test
    void patch_addOwner_200(TestNamespace ns) {
        if (!supportsOwners) return;

        // Owner test logic
    }

    // ... 90 more common tests
}
```

### DatabaseResourceIT Implementation

```java
package org.openmetadata.it.tests;

public class DatabaseResourceIT extends BaseEntityIT<Database, CreateDatabase> {

    @Override
    protected OpenMetadataClient.EntityClient<Database, CreateDatabase> getEntityClient(OpenMetadataClient client) {
        return client.databases();
    }

    @Override
    protected CreateDatabase createMinimalRequest(TestNamespace ns) {
        // Create database service first
        DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);

        CreateDatabase req = new CreateDatabase();
        req.setName(ns.prefix("db"));
        req.setService(service.getFullyQualifiedName());
        return req;
    }

    @Override
    protected String getEntityType() {
        return "database";
    }

    // Database-specific tests
    @Test
    void testDatabaseRdfRelationships(TestNamespace ns) {
        // Database-specific logic
    }
}
```

## Success Criteria

### Phase 1 Complete When:
- [ ] BaseEntityIT created with 10 core CRUD tests
- [ ] DatabaseResourceIT extends BaseEntityIT
- [ ] All 10 + 2 = 12 tests passing
- [ ] Performance comparison documented
- [ ] Execution time < 2 minutes for 12 tests

### Full Migration Complete When:
- [ ] BaseEntityIT has all 92 common tests
- [ ] DatabaseResourceIT has all 11 database-specific tests
- [ ] Total: 103 tests passing
- [ ] Execution time comparison with old framework documented
- [ ] All tests parallelized and stable

## Next Steps

**Immediate (Today):**
1. ✅ Create COMPLETE_MIGRATION_PLAN.md (this file)
2. ⏳ Get approval on Phase 1 approach
3. ⏳ Start BaseEntityIT implementation

**Tomorrow:**
1. Complete 10 CRUD test migrations
2. Validate DatabaseResourceIT extension
3. Run performance comparison

**Day 3:**
1. Fix any issues found
2. Run stability tests (10 iterations)
3. Document results

**Day 4:**
1. Decision point: Continue with Phase 2 or adjust approach
2. Update roadmap based on learnings

---

**Current Status:** 2/103 tests (2%)
**Phase 1 Target:** 12/103 tests (12%)
**Final Target:** 103/103 tests (100%)
**Estimated Timeline:** 6 weeks (sequential) or 4 weeks (parallel agents)
