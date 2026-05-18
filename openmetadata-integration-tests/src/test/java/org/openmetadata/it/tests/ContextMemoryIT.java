package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.context.ContextMemoryService;

/**
 * Integration tests for ContextMemory entity operations.
 *
 * <p>Tests ContextMemory CRUD operations, status lifecycle transitions, scope/visibility handling,
 * and context-memory-specific validations.
 *
 * <p>Modeled on LearningResourceIT, the reference entity for the ContextMemory OSS implementation.
 */
@Execution(ExecutionMode.CONCURRENT)
public class ContextMemoryIT extends BaseEntityIT<ContextMemory, CreateContextMemory> {

  public ContextMemoryIT() {
    supportsPatch = true;
    supportsFollowers = false;
    supportsTags = true;
    supportsOwners = true;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsCustomExtension = true;
    supportsSearchIndex = false;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateContextMemory createMinimalRequest(TestNamespace ns) {
    return new CreateContextMemory()
        .withName(ns.prefix("context-memory"))
        .withDescription("Test context memory")
        .withQuestion("How do I find certified tables?")
        .withAnswer("Filter the Explore page by the Certification tag.");
  }

  @Override
  protected CreateContextMemory createRequest(String name, TestNamespace ns) {
    return new CreateContextMemory()
        .withName(name)
        .withDescription("Test context memory")
        .withQuestion("What is the data quality SLA?")
        .withAnswer("Critical tables must pass tests every 24 hours.");
  }

  @Override
  protected ContextMemory createEntity(CreateContextMemory createRequest) {
    return getContextMemoryService().create(createRequest);
  }

  @Override
  protected ContextMemory getEntity(String id) {
    return getContextMemoryService().get(id);
  }

  @Override
  protected ContextMemory getEntityByName(String fqn) {
    return getContextMemoryService().getByName(fqn);
  }

  @Override
  protected ContextMemory patchEntity(String id, ContextMemory entity) {
    return getContextMemoryService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getContextMemoryService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getContextMemoryService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getContextMemoryService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "contextMemory";
  }

  @Override
  protected void validateCreatedEntity(ContextMemory entity, CreateContextMemory createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    if (createRequest.getDisplayName() != null) {
      assertEquals(createRequest.getDisplayName(), entity.getDisplayName());
    }

    assertEquals(createRequest.getQuestion(), entity.getQuestion());
    assertEquals(createRequest.getAnswer(), entity.getAnswer());

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain memory name");
  }

  @Override
  protected ListResponse<ContextMemory> listEntities(ListParams params) {
    return getContextMemoryService().list(params);
  }

  @Override
  protected ContextMemory getEntityWithFields(String id, String fields) {
    return getContextMemoryService().get(id, fields);
  }

  @Override
  protected ContextMemory getEntityByNameWithFields(String fqn, String fields) {
    return getContextMemoryService().getByName(fqn, fields);
  }

  @Override
  protected ContextMemory getEntityIncludeDeleted(String id) {
    return getContextMemoryService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getContextMemoryService().getVersionList(id);
  }

  @Override
  protected ContextMemory getVersion(UUID id, Double version) {
    return getContextMemoryService().getVersion(id.toString(), version);
  }

  // ===================================================================
  // CRUD TESTS
  // ===================================================================

  @Test
  void post_contextMemory_200_OK(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("crud-memory"))
            .withDescription("CRUD happy path")
            .withQuestion("Where are the gold datasets?")
            .withAnswer("Under the Sales domain tagged Tier.Gold.");

    ContextMemory memory = createEntity(request);
    assertNotNull(memory.getId());
    assertEquals(request.getName(), memory.getName());
    assertEquals("Where are the gold datasets?", memory.getQuestion());
    assertEquals("Under the Sales domain tagged Tier.Gold.", memory.getAnswer());
    assertEquals(0.1, memory.getVersion(), 0.001);

    ContextMemory fetched = getEntity(memory.getId().toString());
    assertEquals(memory.getId(), fetched.getId());
    assertEquals(memory.getName(), fetched.getName());
  }

  @Test
  void post_contextMemoryWithQuestionAnswerSummaryTitle_200_OK(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("rich-memory"))
            .withDisplayName("Certification Lookup")
            .withDescription("Full content memory")
            .withTitle("How to find certified data")
            .withSummary("Use the Certification tag filter on Explore.")
            .withQuestion("How do I find certified tables?")
            .withAnswer("Filter the Explore page by Certification = Certified.");

    ContextMemory memory = createEntity(request);
    assertEquals("Certification Lookup", memory.getDisplayName());
    assertEquals("How to find certified data", memory.getTitle());
    assertEquals("Use the Certification tag filter on Explore.", memory.getSummary());
    assertEquals("How do I find certified tables?", memory.getQuestion());
    assertEquals("Filter the Explore page by Certification = Certified.", memory.getAnswer());
  }

  @Test
  void post_contextMemoryWithoutRequiredFields_400(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () -> createEntity(new CreateContextMemory().withName(null)),
        "Creating memory without name should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateContextMemory()
                    .withName(ns.prefix("no-question"))
                    .withAnswer("An answer without a question.")),
        "Creating memory without question should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateContextMemory()
                    .withName(ns.prefix("no-answer"))
                    .withQuestion("A question without an answer?")),
        "Creating memory without answer should fail");
  }

  @Test
  void post_contextMemoryDuplicateName_409(TestNamespace ns) {
    String memoryName = ns.prefix("duplicate-memory");

    createEntity(
        new CreateContextMemory()
            .withName(memoryName)
            .withDescription("First memory")
            .withQuestion("First question?")
            .withAnswer("First answer."));

    CreateContextMemory duplicate =
        new CreateContextMemory()
            .withName(memoryName)
            .withDescription("Duplicate memory")
            .withQuestion("Duplicate question?")
            .withAnswer("Duplicate answer.");

    assertThrows(Exception.class, () -> createEntity(duplicate), "Duplicate name should fail");
  }

  @Test
  void get_contextMemoryByFqn_200_OK(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("fqn-memory"))
            .withDescription("FQN lookup test")
            .withQuestion("What is the FQN of this memory?")
            .withAnswer("The FQN equals the name for context memories.");

    ContextMemory memory = createEntity(request);

    // FQN == name for ContextMemory (ContextMemoryRepository.setFullyQualifiedName).
    assertEquals(memory.getName(), memory.getFullyQualifiedName());

    ContextMemory byFqn = getEntityByName(memory.getFullyQualifiedName());
    assertEquals(memory.getId(), byFqn.getId());
    assertEquals(memory.getName(), byFqn.getName());
  }

  // ===================================================================
  // STATUS LIFECYCLE TESTS
  // ===================================================================

  @Test
  void put_contextMemoryStatusTransitions_valid_200_OK(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("status-valid"))
            .withDescription("Valid status transitions")
            .withQuestion("What is the status flow?")
            .withAnswer("Draft to Active to Archived and back to Active.")
            .withStatus(ContextMemoryStatus.DRAFT);

    ContextMemory memory = createEntity(request);
    assertEquals(ContextMemoryStatus.DRAFT, memory.getStatus());

    request.withStatus(ContextMemoryStatus.ACTIVE);
    ContextMemory active = getContextMemoryService().put(request);
    assertEquals(ContextMemoryStatus.ACTIVE, active.getStatus());

    request.withStatus(ContextMemoryStatus.ARCHIVED);
    ContextMemory archived = getContextMemoryService().put(request);
    assertEquals(ContextMemoryStatus.ARCHIVED, archived.getStatus());

    request.withStatus(ContextMemoryStatus.ACTIVE);
    ContextMemory reactivated = getContextMemoryService().put(request);
    assertEquals(ContextMemoryStatus.ACTIVE, reactivated.getStatus());
  }

  @Test
  void put_contextMemoryStatusTransition_invalid_fails(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("status-invalid"))
            .withDescription("Invalid status transition")
            .withQuestion("Can Active go back to Draft?")
            .withAnswer("No, Active cannot revert to Draft.")
            .withStatus(ContextMemoryStatus.ACTIVE);

    ContextMemory memory = createEntity(request);
    assertEquals(ContextMemoryStatus.ACTIVE, memory.getStatus());

    request.withStatus(ContextMemoryStatus.DRAFT);
    assertThrows(
        Exception.class,
        () -> getContextMemoryService().put(request),
        "Transition from Active to Draft should be rejected");
  }

  @Test
  void put_statusOnlyChange_persistsAfterGet(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("status-persist"))
            .withDescription("Status-only update persistence test")
            .withQuestion("Does the status persist?")
            .withAnswer("Yes, after a status-only PUT.")
            .withStatus(ContextMemoryStatus.DRAFT);

    ContextMemory memory = createEntity(request);
    assertEquals(ContextMemoryStatus.DRAFT, memory.getStatus());

    request.withStatus(ContextMemoryStatus.ACTIVE);
    ContextMemory putResponse = getContextMemoryService().put(request);
    assertEquals(ContextMemoryStatus.ACTIVE, putResponse.getStatus());

    ContextMemory fetched = getEntity(memory.getId().toString());
    assertEquals(
        ContextMemoryStatus.ACTIVE,
        fetched.getStatus(),
        "Status should persist after a status-only PUT update");
    assertTrue(
        fetched.getVersion() > memory.getVersion(),
        "Version should be incremented after status change");
  }

  @Test
  void put_statusChanges_recordVersionHistory(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("status-history"))
            .withDescription("Status change history test")
            .withQuestion("Are status changes versioned?")
            .withAnswer("Yes, each transition bumps the version.")
            .withStatus(ContextMemoryStatus.DRAFT);

    ContextMemory memory = createEntity(request);

    request.withStatus(ContextMemoryStatus.ACTIVE);
    getContextMemoryService().put(request);

    request.withStatus(ContextMemoryStatus.ARCHIVED);
    getContextMemoryService().put(request);

    EntityHistory history = getVersionHistory(memory.getId());
    assertTrue(
        history.getVersions().size() >= 3,
        "Should have at least 3 versions: create + 2 status updates");
  }

  // ===================================================================
  // SCOPE / TYPE / VISIBILITY TESTS
  // ===================================================================

  @Test
  void post_contextMemoryWithScopeAndType_200_OK(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("scope-type"))
            .withDescription("Scope and type test")
            .withQuestion("What is my reporting preference?")
            .withAnswer("Always include row counts in summaries.")
            .withMemoryScope(ContextMemoryScope.USER_GLOBAL)
            .withMemoryType(ContextMemoryType.PREFERENCE);

    ContextMemory memory = createEntity(request);
    assertEquals(ContextMemoryScope.USER_GLOBAL, memory.getMemoryScope());
    assertEquals(ContextMemoryType.PREFERENCE, memory.getMemoryType());
  }

  @Test
  void post_contextMemoryWithShareConfigVisibility_200_OK(TestNamespace ns) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("visibility"))
            .withDescription("Visibility test")
            .withQuestion("Who can see this memory?")
            .withAnswer("Only the owner while visibility is Private.")
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));

    ContextMemory memory = createEntity(request);
    assertNotNull(memory.getShareConfig());
    assertEquals(MemoryVisibility.PRIVATE, memory.getShareConfig().getVisibility());
  }

  @Test
  void post_contextMemoryAllTypes_200_OK(TestNamespace ns) {
    for (ContextMemoryType type : ContextMemoryType.values()) {
      CreateContextMemory request =
          new CreateContextMemory()
              .withName(ns.prefix("type-" + type.value().toLowerCase()))
              .withDescription("Memory of type " + type.value())
              .withQuestion("Question for " + type.value() + "?")
              .withAnswer("Answer for " + type.value() + ".")
              .withMemoryType(type);

      ContextMemory memory = createEntity(request);
      assertEquals(type, memory.getMemoryType());
    }
  }

  // ===================================================================
  // LIST TESTS
  // ===================================================================

  @Test
  void test_listContextMemories(TestNamespace ns) {
    CreateContextMemory request1 =
        new CreateContextMemory()
            .withName(ns.prefix("list-1"))
            .withDescription("First memory")
            .withQuestion("First list question?")
            .withAnswer("First list answer.");

    CreateContextMemory request2 =
        new CreateContextMemory()
            .withName(ns.prefix("list-2"))
            .withDescription("Second memory")
            .withQuestion("Second list question?")
            .withAnswer("Second list answer.");

    createEntity(request1);
    createEntity(request2);

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<ContextMemory> response = listEntities(params);

    assertNotNull(response);
    assertFalse(response.getData().isEmpty());
    assertTrue(response.getData().size() >= 2);
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private ContextMemoryService getContextMemoryService() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }
}
