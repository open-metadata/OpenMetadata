# Test Coverage Gap Analysis
**Date:** 2025-10-02
**Status:** ⚠️ SIGNIFICANT GAP IDENTIFIED

## Executive Summary

**Current Status:** Only 26 tests migrated out of **~80+ CRUD tests** in EntityResourceTest

### Test Count Comparison

| Category | EntityResourceTest | BaseEntityIT | Gap | Coverage |
|----------|-------------------|--------------|-----|----------|
| **POST (Create)** | 13 tests | 2 tests | 11 missing | 15% |
| **GET (Read)** | 9 tests | 3 tests | 6 missing | 33% |
| **PATCH (Update)** | 16 tests | 1 test | 15 missing | 6% |
| **PUT (Update)** | 10 tests | 0 tests | 10 missing | 0% |
| **DELETE** | 8 tests | 1 test | 7 missing | 12% |
| **Advanced** | 26 tests | 0 tests | 26 missing | 0% |
| **TOTAL** | **82 tests** | **8 tests** | **74 missing** | **10%** |

---

## Detailed Breakdown

### POST (Create) Tests - 13 total, 2 migrated (15%)

#### ✅ Migrated (2):
1. `post_entityCreate_200_OK` → ✅ BaseEntityIT
2. `post_entityCreateWithInvalidName_400` → ✅ BaseEntityIT

#### ❌ Missing (11):
1. `post_entity_as_non_admin_401` - Authorization test
2. `post_entityAlreadyExists_409_conflict` - Duplicate detection
3. `post_duplicateEntity_409` - Enhanced duplicate (in subclasses)
4. `post_entityWithDots_200` - Name validation
5. `post_entityWithInvalidOwnerType_4xx` - Owner validation
6. `post_entityWithMissingDescription_400` - Required field validation
7. `post_entityWithNonExistentOwner_4xx` - Reference validation
8. `post_delete_as_name_entity_as_admin_200` - Soft delete by name
9. `post_delete_entity_as_admin_200` - Soft delete by ID
10. `post_delete_entity_as_bot` - Bot authorization
11. `post_delete_entityWithOwner_200` - Delete with owner

---

### GET (Read) Tests - 9 total, 3 migrated (33%)

#### ✅ Migrated (3):
1. `get_entity_200_OK` → ✅ BaseEntityIT
2. `get_entityByName_200_OK` → ✅ BaseEntityIT
3. `get_entityNotFound_404` → ✅ BaseEntityIT

#### ❌ Missing (6):
1. `get_entityWithDifferentFields_200_OK` - Fields parameter
2. `get_entityWithDifferentFieldsQueryParam` - Query param validation
3. `get_entityIncludeDeleted_200` - Include deleted entities
4. `get_entityListWithInvalidLimit_4xx` - Pagination validation
5. `get_entityListWithInvalidPaginationCursors_4xx` - Cursor validation
6. `get_entityListWithPagination_200` - Pagination test
7. `get_entityWithEmptyDescriptionFromSearch` - Search integration
8. `get_entityWithNullDescriptionFromSearch` - Search integration
9. `get_deletedVersion` - Version history for deleted

---

### PATCH (Update) Tests - 16 total, 1 migrated (6%)

#### ✅ Migrated (1):
1. `patch_entityDescription_200_OK` → ✅ BaseEntityIT

#### ❌ Missing (15):
1. `patch_entityAttributes_200_ok` - General attribute updates
2. `patch_entityUpdateOwner_200` - Owner updates
3. `patch_entityUpdateOwnerFromNull_200` - Set owner from null
4. `patch_validEntityOwner_200` - Owner validation
5. `patch_dataProducts_200_ok` - Data product updates
6. `patch_dataProducts_multipleOperations_200` - Multiple ops
7. `patch_relationshipFields_consolidation_200_ok` - Relationship consolidation
8. `patch_concurrent_updates_with_etag` - Concurrency control
9. `patch_concurrentUpdates_dataLossTest` - Data loss prevention
10. `patch_with_valid_etag` - ETag validation
11. `patch_with_stale_etag` - Stale ETag handling
12. `patch_etag_in_get_response` - ETag in response
13. `patch_deleted_attribute_disallowed_400` - Delete attribute validation
14. `patch_entityDescriptionAndTestAuthorizer` - Authorization
15. `patch_entityUpdatesOutsideASession` - Session handling
16. `patchWrongDomainId` - Domain validation

---

### PUT (Update) Tests - 10 total, 0 migrated (0%)

#### ❌ Missing (10):
1. `put_entityCreate_200` - Create via PUT
2. `put_entityCreate_as_owner_200` - Create as owner
3. `put_entityUpdateWithNoChange_200` - No-op update
4. `put_entityEmptyDescriptionUpdate_200` - Empty description
5. `put_entityNonEmptyDescriptionUpdate_200` - Update description
6. `put_entityNullDescriptionUpdate_200` - Null description
7. `put_entityUpdateOwner_200` - Update owner
8. `put_entityUpdate_as_non_owner_4xx` - Authorization
9. `put_addDeleteFollower_200` - Follower management
10. `put_addDeleteInvalidFollower_200` - Invalid follower
11. `put_addFollowerDeleteEntity_200` - Follower on deleted
12. `put_addEntityCustomAttributes` - Custom attributes

---

### DELETE Tests - 8 total, 1 migrated (12%)

#### ✅ Migrated (1):
1. `delete_entity_soft_200` → ✅ BaseEntityIT

#### ❌ Missing (7):
1. `delete_entity_as_non_admin_401` - Authorization
2. `delete_nonExistentEntity_404` - Delete non-existent
3. `delete_recursiveTest` - Recursive delete
4. `delete_restore_entity_200` - Restore deleted
5. `delete_systemEntity` - System entity protection
6. `delete_async_soft_delete` - Async soft delete
7. `delete_async_entity_as_non_admin_401` - Async auth
8. `delete_async_nonExistentEntity_404` - Async non-existent
9. `delete_async_with_recursive_hardDelete` - Async recursive

---

### Advanced Features - 26 total, 0 migrated (0%)

#### ❌ Search/Index (6):
1. `checkIndexCreated` - Elasticsearch index creation
2. `updateDescriptionAndCheckInSearch` - Search sync
3. `deleteTagAndCheckRelationshipsInSearch` - Search relationships
4. `get_entityWithEmptyDescriptionFromSearch`
5. `get_entityWithNullDescriptionFromSearch`
6. `checkCreatedEntity` - Index validation
7. `checkDeletedEntity` - Delete index validation

#### ❌ Tags (4):
1. `test_entityWithInvalidTag` - Tag validation
2. `test_tagUpdateOptimization_PUT` - Tag optimization
3. `test_tagUpdateOptimization_PATCH` - Tag patch optimization
4. `test_tagUpdateOptimization_LargeScale` - Performance test

#### ❌ Recognizer/ML Tags (4):
1. `test_recognizerFeedback_autoAppliedTags`
2. `test_recognizerFeedback_exceptionList`
3. `test_recognizerFeedback_multipleEntities`
4. `test_recognizerFeedback_invalidFeedback`

#### ❌ SDK Fluent API (5):
1. `testSearchFluentAPI`
2. `testListFluentAPI`
3. `testAutoPaginationFluentAPI`
4. `testLineageFluentAPI`
5. `testBulkFluentAPI`

#### ❌ SDK Entity Tests (3):
1. `test_sdkEntityWithTags`
2. `test_sdkEntityWithOwners`
3. `test_sdkEntityWithDomainAndDataProducts`

#### ❌ Lifecycle (2):
1. `postPutPatch_entityLifeCycle` - Full lifecycle test
2. `postPutPatch_entityCertification` - Certification workflow

---

## Current Test Coverage

### What We Have (26 tests total)

**BaseEntityIT (8 tests):**
- ✅ post_entityCreate_200_OK
- ✅ post_entityCreateWithInvalidName_400
- ✅ post_duplicateEntity_409
- ✅ get_entity_200_OK
- ✅ get_entityByName_200_OK
- ✅ get_entityNotFound_404
- ✅ patch_entityDescription_200_OK
- ✅ delete_entity_soft_200

**DatabaseResourceIT (14 tests = 8 inherited + 6 specific):**
- All 8 from BaseEntityIT
- ✅ post_databaseFQN_as_admin_200_OK
- ✅ post_databaseWithoutRequiredService_4xx
- ✅ post_databaseWithDifferentService_200_ok
- ✅ test_changeEvents_200_OK
- ✅ test_entityVersionHistory_200_OK
- ✅ test_bulkServiceFetching_200_OK

**TableResourceIT (12 tests = 8 inherited + 4 specific):**
- All 8 from BaseEntityIT
- ✅ post_tableFQN_200_OK
- ✅ post_tableWithColumns_200_OK
- ✅ post_tableWithoutSchema_400
- ✅ patch_tableAddColumn_200_OK

---

## Migration Priority

### Phase 1: Critical CRUD Coverage (Priority: HIGH)

Add to **BaseEntityIT** (20 tests):

**POST Tests (5):**
- [ ] post_entity_as_non_admin_401
- [ ] post_entityAlreadyExists_409_conflict
- [ ] post_entityWithInvalidOwnerType_4xx
- [ ] post_entityWithNonExistentOwner_4xx
- [ ] post_entityWithDots_200

**GET Tests (3):**
- [ ] get_entityWithDifferentFields_200_OK
- [ ] get_entityListWithPagination_200
- [ ] get_entityIncludeDeleted_200

**PATCH Tests (6):**
- [ ] patch_entityAttributes_200_ok
- [ ] patch_entityUpdateOwner_200
- [ ] patch_concurrent_updates_with_etag
- [ ] patch_with_valid_etag
- [ ] patch_with_stale_etag
- [ ] patch_deleted_attribute_disallowed_400

**PUT Tests (4):**
- [ ] put_entityCreate_200
- [ ] put_entityUpdateWithNoChange_200
- [ ] put_entityUpdateOwner_200
- [ ] put_entityUpdate_as_non_owner_4xx

**DELETE Tests (2):**
- [ ] delete_entity_as_non_admin_401
- [ ] delete_restore_entity_200

**Estimated Time:** 2-3 days

---

### Phase 2: Authorization & Validation (Priority: MEDIUM)

Add to **BaseEntityIT** (15 tests):

**Authorization (5):**
- [ ] post_entity_as_non_admin_401
- [ ] put_entityUpdate_as_non_owner_4xx
- [ ] delete_entity_as_non_admin_401
- [ ] patch_entityDescriptionAndTestAuthorizer
- [ ] post_delete_entity_as_bot

**Validation (10):**
- [ ] post_entityWithMissingDescription_400
- [ ] get_entityListWithInvalidLimit_4xx
- [ ] get_entityListWithInvalidPaginationCursors_4xx
- [ ] patch_validEntityOwner_200
- [ ] delete_nonExistentEntity_404
- [ ] delete_systemEntity
- [ ] put_addDeleteInvalidFollower_200
- [ ] get_entityWithDifferentFieldsQueryParam
- [ ] patchWrongDomainId
- [ ] test_entityWithInvalidTag

**Estimated Time:** 1-2 days

---

### Phase 3: Advanced Features (Priority: LOW)

**Async Operations (5 tests):**
- [ ] delete_async_soft_delete
- [ ] delete_async_entity_as_non_admin_401
- [ ] delete_async_nonExistentEntity_404
- [ ] delete_async_with_recursive_hardDelete

**Followers (4 tests):**
- [ ] put_addDeleteFollower_200
- [ ] put_addDeleteInvalidFollower_200
- [ ] put_addFollowerDeleteEntity_200
- [ ] put_addEntityCustomAttributes

**Data Products/Domains (3 tests):**
- [ ] patch_dataProducts_200_ok
- [ ] patch_dataProducts_multipleOperations_200
- [ ] test_sdkEntityWithDomainAndDataProducts

**Estimated Time:** 2-3 days

---

### Phase 4: SDK & Search Features (Priority: LOW)

**SDK Fluent API (5 tests):**
- [ ] testSearchFluentAPI
- [ ] testListFluentAPI
- [ ] testAutoPaginationFluentAPI
- [ ] testLineageFluentAPI
- [ ] testBulkFluentAPI

**SDK Entity Tests (3 tests):**
- [ ] test_sdkEntityWithTags
- [ ] test_sdkEntityWithOwners
- [ ] test_sdkEntityWithDomainAndDataProducts

**Search/Index (6 tests):**
- [ ] checkIndexCreated
- [ ] updateDescriptionAndCheckInSearch
- [ ] deleteTagAndCheckRelationshipsInSearch
- [ ] get_entityWithEmptyDescriptionFromSearch
- [ ] get_entityWithNullDescriptionFromSearch
- [ ] checkCreatedEntity

**Estimated Time:** 3-4 days

---

### Phase 5: Tags & ML Features (Priority: LOW)

**Tag Optimization (3 tests):**
- [ ] test_tagUpdateOptimization_PUT
- [ ] test_tagUpdateOptimization_PATCH
- [ ] test_tagUpdateOptimization_LargeScale

**Recognizer/ML (4 tests):**
- [ ] test_recognizerFeedback_autoAppliedTags
- [ ] test_recognizerFeedback_exceptionList
- [ ] test_recognizerFeedback_multipleEntities
- [ ] test_recognizerFeedback_invalidFeedback

**Lifecycle (2 tests):**
- [ ] postPutPatch_entityLifeCycle
- [ ] postPutPatch_entityCertification

**Estimated Time:** 2-3 days

---

## Impact Assessment

### Current State
- ✅ **Container reuse:** Working perfectly
- ✅ **Parallel execution:** Working perfectly
- ✅ **Basic CRUD:** 10% coverage
- ⚠️ **Comprehensive CRUD:** Missing 90%
- ❌ **Authorization:** 0% coverage
- ❌ **Advanced features:** 0% coverage

### Risks of Current Low Coverage
1. **Authorization bugs:** Not testing non-admin access
2. **Validation gaps:** Not testing invalid inputs
3. **Concurrency issues:** Not testing ETags
4. **Data loss:** Not testing concurrent updates
5. **Pagination bugs:** Not testing list operations
6. **Owner/follower bugs:** Not testing relationships

### Recommended Action

**Option 1: Rapid Core Coverage (Recommended)**
- Focus on Phase 1 (20 critical tests)
- Brings coverage to ~35% for core CRUD
- Estimated time: 2-3 days
- **Start immediately**

**Option 2: Comprehensive Coverage**
- All phases (74+ tests)
- Brings coverage to 100%
- Estimated time: 10-15 days
- **Phased approach over sprints**

**Option 3: Hybrid Approach**
- Phase 1 + Phase 2 (35 tests)
- Brings coverage to ~50% with auth/validation
- Estimated time: 4-5 days
- **Balanced approach**

---

## Summary

✅ **Infrastructure:** Perfect (container reuse, parallel execution)
⚠️ **Test Coverage:** **10%** of EntityResourceTest CRUD tests migrated
❌ **Missing:** 74+ critical tests including:
  - Authorization (12 tests)
  - Validation (15 tests)
  - PUT operations (10 tests)
  - PATCH variations (15 tests)
  - DELETE operations (7 tests)
  - Advanced features (26 tests)

**Bottom Line:** We have excellent test infrastructure but need to migrate 74+ more tests to achieve true parity with EntityResourceTest.
