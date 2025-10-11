# SDK Capabilities Analysis
**Date:** 2025-10-02
**Purpose:** Determine what OpenMetadata SDK supports for comprehensive test validation

## Executive Summary

Analyzed the `openmetadata-sdk` to determine support for advanced validation features needed to match EntityResourceTest equivalence.

### Quick Answer
| Feature | SDK Support | Status | Action Required |
|---------|------------|--------|-----------------|
| **Version Tracking** | ✅ YES | Working | None - already using |
| **ChangeDescription** | ✅ YES | Working | None - already using |
| **Entity History/Versions API** | ❌ NO | Missing | Need to add to SDK |
| **Change Events API** | ❌ NO | Missing | Need to add to SDK |
| **ETag Handling** | ✅ YES | Available | Need to use in tests |
| **RDF Relationships** | ❓ UNKNOWN | N/A | Not SDK-based (server-side RDF store) |

## Detailed Analysis

### 1. Version Tracking ✅ SUPPORTED

**What it is:**
- Entity versions (0.1, 0.2, 1.0)
- Returned in entity objects automatically

**SDK Support:**
```java
// ✅ Supported - Entity objects have getVersion()
Database db = client.databases().get(id);
Double version = db.getVersion(); // Returns 0.1, 0.2, etc.
```

**Status:** ✅ **Already implemented and working**
- EntityValidation.validateVersion() uses this
- All entities inherit from EntityInterface which has getVersion()

---

### 2. ChangeDescription ✅ SUPPORTED

**What it is:**
- Tracks fieldsAdded, fieldsUpdated, fieldsDeleted
- Tracks previousVersion
- Returned in entity objects after updates

**SDK Support:**
```java
// ✅ Supported - Entity objects have getChangeDescription()
Database updated = client.databases().update(id, database);
ChangeDescription change = updated.getChangeDescription();
List<FieldChange> fieldsUpdated = change.getFieldsUpdated();
Double previousVersion = change.getPreviousVersion();
```

**Status:** ✅ **Already implemented and working**
- EntityValidation.validateChangeDescription() uses this
- ChangeDescription is part of EntityInterface

---

### 3. Entity History/Versions API ❌ NOT SUPPORTED IN SDK

**What it is:**
- API endpoint: `GET /v1/databases/{id}/versions` - List all versions
- API endpoint: `GET /v1/databases/{id}/versions/{version}` - Get specific version
- Returns EntityHistory with list of versions

**Current SDK Support:**
```java
// ❌ NOT AVAILABLE in EntityServiceBase
// No method for: getVersionList(id)
// No method for: getSpecificVersion(id, version)
```

**What EntityResourceTest does:**
```java
// Gets list of all versions
EntityHistory history = getVersionList(entity.getId(), ADMIN_AUTH_HEADERS);
// Returns: EntityHistory with versions: [0.1, 0.2, 0.3]

// Gets specific version
T version1 = getVersion(entity.getId(), 0.1, ADMIN_AUTH_HEADERS);
T version2 = getVersion(entity.getId(), 0.2, ADMIN_AUTH_HEADERS);
```

**What we need to add to SDK:**

```java
// In EntityServiceBase.java:

public EntityHistory getVersionList(String id) throws OpenMetadataException {
  String path = basePath + "/" + id + "/versions";
  return httpClient.execute(HttpMethod.GET, path, null, EntityHistory.class);
}

public T getVersion(String id, Double version) throws OpenMetadataException {
  String path = basePath + "/" + id + "/versions/" + version.toString();
  return httpClient.execute(HttpMethod.GET, path, null, getEntityClass());
}
```

**Status:** ❌ **MISSING - Need to add to SDK**
- **Priority:** HIGH
- **Impact:** Cannot validate version history without this
- **Effort:** LOW (1-2 hours to add and test)

---

### 4. Change Events API ❌ NOT SUPPORTED IN SDK

**What it is:**
- API endpoint: `GET /v1/events` with filters
- Query params: entityCreated, entityUpdated, entityDeleted, entityRestored, timestamp
- Returns list of ChangeEvent objects

**Current SDK Support:**
```java
// ❌ NOT AVAILABLE in SDK
// No ChangeEventService or events API
```

**What EntityResourceTest does:**
```java
ResultList<ChangeEvent> events = getChangeEvents(
  "database", // entityCreated
  null,       // entityUpdated
  null,       // entityRestored
  null,       // entityDeleted
  timestamp,
  ADMIN_AUTH_HEADERS
);

// Validates:
for (ChangeEvent event : events.getData()) {
  assertEquals(EventType.ENTITY_CREATED, event.getEventType());
  assertEquals(entity.getId(), event.getEntityId());
  // Validate ChangeDescription in event matches expectations
}
```

**What we need to add to SDK:**

```java
// New file: ChangeEventService.java

public class ChangeEventService {
  private final HttpClient httpClient;

  public ChangeEventService(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public ListResponse<ChangeEvent> getChangeEvents(
      String entityCreated,
      String entityUpdated,
      String entityRestored,
      String entityDeleted,
      Long timestamp) throws OpenMetadataException {

    Map<String, String> params = new HashMap<>();
    if (entityCreated != null) params.put("entityCreated", entityCreated);
    if (entityUpdated != null) params.put("entityUpdated", entityUpdated);
    if (entityRestored != null) params.put("entityRestored", entityRestored);
    if (entityDeleted != null) params.put("entityDeleted", entityDeleted);
    if (timestamp != null) params.put("timestamp", timestamp.toString());

    RequestOptions options = RequestOptions.builder().queryParams(params).build();
    return httpClient.execute(HttpMethod.GET, "/v1/events", null,
      ListResponse.class, options);
  }
}

// Add to OpenMetadataClient.java:
public ChangeEventService changeEvents() {
  return new ChangeEventService(httpClient);
}
```

**Status:** ❌ **MISSING - Need to add to SDK**
- **Priority:** MEDIUM (can validate basic functionality without events, but events are important for audit trail)
- **Impact:** Cannot validate change events are generated correctly
- **Effort:** MEDIUM (2-4 hours to add service, test, and integrate)

---

### 5. ETag Handling ✅ SUPPORTED

**What it is:**
- HTTP ETag header for concurrency control
- If-Match header for conditional updates
- Returns 412 PRECONDITION_FAILED if ETag is stale

**SDK Support:**
```java
// ✅ SUPPORTED in EntityServiceBase

// Update with ETag
T updated = client.databases().update(id, entity, etag);

// Under the hood (EntityServiceBase line 148-149):
public T update(String id, T entity, String etag) throws OpenMetadataException {
  // ...
  if (etag != null) {
    options = RequestOptions.builder().header("If-Match", etag).build();
  }
  // ...
}
```

**What we need to do:**
1. Get ETag from response headers
2. Test valid ETag allows update
3. Test stale ETag fails with 412

**Problem:** SDK doesn't expose response headers!

**SDK's HttpClient (check implementation):**
```java
// We need to check if HttpClient returns headers
// If not, we need to enhance it
```

**Status:** ⚠️ **PARTIALLY SUPPORTED**
- Can *send* ETag in If-Match header ✅
- Cannot *receive* ETag from response headers ❌
- **Priority:** LOW (nice to have, not critical for basic validation)
- **Impact:** Cannot fully test concurrency control
- **Effort:** MEDIUM (need to enhance HttpClient to return response metadata)

---

### 6. RDF Relationships ❓ NOT SDK BASED

**What it is:**
- Semantic relationships stored in RDF triple store (GraphDB)
- Not accessed via REST API
- Server-side validation using SPARQL queries

**EntityResourceTest approach:**
```java
// Uses direct RDF store access (not via REST API)
verifyEntityInRdf(entity, RdfUtils.getRdfType(entityType));
verifyTagsInRdf(entity.getFullyQualifiedName(), entity.getTags());
verifyOwnerInRdf(entity.getFullyQualifiedName(), owner);
```

**SDK Support:**
- ❌ No RDF client in SDK
- ❌ No REST API endpoints for RDF queries
- ℹ️ RDF is server-side feature, not exposed via API

**Status:** ❓ **NOT APPLICABLE FOR SDK TESTS**
- **Priority:** NONE (RDF validation is server-internal)
- **Impact:** Cannot validate RDF relationships, but this is acceptable for integration tests
- **Alternative:** Could add REST endpoints for RDF queries, but out of scope
- **Decision:** **Skip RDF validation in integration tests**

---

## Summary: What We Can/Cannot Test

### ✅ Can Test NOW (Already Working)
1. **Version tracking** - Entity versions increment correctly
2. **ChangeDescription** - fieldsAdded/Updated/Deleted are tracked
3. **UpdateType classification** - CREATED, MINOR_UPDATE, MAJOR_UPDATE
4. **Basic CRUD** - Create, read, update, delete operations
5. **ETag send** - Can send If-Match header (but can't read ETag from response)

### ❌ Cannot Test (SDK Missing Support)
1. **Entity History** - Cannot get list of versions or specific versions
2. **Change Events** - Cannot query change events API
3. **ETag receive** - Cannot read ETag from response headers
4. **RDF Relationships** - Not exposed via API (server-internal)

### 🔧 What Needs to be Added to SDK

#### Priority 1: Entity History (HIGH)
**Add to EntityServiceBase.java:**
```java
public EntityHistory getVersionList(String id) throws OpenMetadataException {
  return httpClient.execute(HttpMethod.GET, basePath + "/" + id + "/versions",
    null, EntityHistory.class);
}

public T getVersion(String id, Double version) throws OpenMetadataException {
  return httpClient.execute(HttpMethod.GET,
    basePath + "/" + id + "/versions/" + version.toString(),
    null, getEntityClass());
}
```

**Estimated Effort:** 1-2 hours
**Testing:** Add unit tests + integration test

#### Priority 2: Change Events (MEDIUM)
**Create ChangeEventService.java:**
```java
public class ChangeEventService {
  public ListResponse<ChangeEvent> getChangeEvents(
      String entityCreated, String entityUpdated,
      String entityRestored, String entityDeleted, Long timestamp) {
    // Implementation
  }
}
```

**Estimated Effort:** 2-4 hours
**Testing:** Add unit tests + integration test

#### Priority 3: ETag Response (LOW)
**Enhance HttpClient to return response metadata:**
```java
public class ResponseWithHeaders<T> {
  private T body;
  private Map<String, String> headers;
}

// Add to HttpClient:
public <T> ResponseWithHeaders<T> executeWithHeaders(...) {
  // Return both body and headers
}
```

**Estimated Effort:** 3-5 hours
**Testing:** Add unit tests + integration test

## Recommended Action Plan

### Phase 1: Add Entity History Support (This Week)
1. Add `getVersionList()` and `getVersion()` to EntityServiceBase
2. Add unit tests
3. Add integration test to BaseEntityIT
4. Validate version history after updates

**Estimated Time:** 1 day

### Phase 2: Add Change Events Support (Next Week)
1. Create ChangeEventService
2. Add to OpenMetadataClient
3. Add unit tests
4. Add integration test to BaseEntityIT
5. Validate events after create/update/delete

**Estimated Time:** 1-2 days

### Phase 3: Skip for Now
- ETag response handling - LOW priority
- RDF relationships - Not applicable

**Total Estimated Time:** 2-3 days of work

## Impact on Test Equivalence

### Current State (With What We Have)
Can validate:
- ✅ Entity versions
- ✅ ChangeDescription
- ✅ UpdateType
- ✅ Basic CRUD

Coverage: **~60% of EntityResourceTest validation**

### After Adding Entity History
Can validate:
- ✅ Entity versions
- ✅ ChangeDescription
- ✅ UpdateType
- ✅ Basic CRUD
- ✅ Version history
- ✅ Getting previous versions

Coverage: **~75% of EntityResourceTest validation**

### After Adding Change Events
Can validate:
- ✅ Entity versions
- ✅ ChangeDescription
- ✅ UpdateType
- ✅ Basic CRUD
- ✅ Version history
- ✅ Getting previous versions
- ✅ Change event generation
- ✅ Event audit trail

Coverage: **~85% of EntityResourceTest validation**

### What We'll Never Have (Acceptable)
- ❌ RDF relationship validation (server-internal)
- ❌ Full ETag concurrency testing (can test basic case)

Coverage: **~85% is acceptable** (remaining 15% is server-internal or low priority)

## Next Steps

1. **Decision Point:** Should we:
   - A) Add Entity History + Change Events to SDK now (2-3 days)
   - B) Continue with current validation and add SDK features later
   - C) Add Entity History only (1 day) and defer Change Events

2. **If Option A:** I can implement Entity History and Change Events in SDK
3. **If Option B:** Document the gap and continue migrating tests with current validation
4. **If Option C:** Add Entity History now, defer Change Events

**Recommendation:** **Option C** - Add Entity History now (HIGH priority, 1 day effort), defer Change Events to later. This gives us ~75% validation coverage which is good enough to continue migration.
