package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.learning.CreateLearningResource;
import org.openmetadata.schema.api.learning.ResourceCategory;
import org.openmetadata.schema.entity.learning.LearningResource;
import org.openmetadata.schema.entity.learning.LearningResourceContext;
import org.openmetadata.schema.entity.learning.LearningResourceSource;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.learning.LearningResourceService;

/**
 * Integration tests for LearningResource entity operations.
 *
 * <p>Tests LearningResource CRUD operations, category validation, context handling, and
 * learning-resource-specific validations.
 *
 * <p>Migrated from: org.openmetadata.service.resources.learning.LearningResourceResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class LearningResourceIT extends BaseEntityIT<LearningResource, CreateLearningResource> {

  public LearningResourceIT() {
    supportsPatch = true;
    supportsFollowers = false;
    supportsTags = true;
    supportsDataProducts = false;
    supportsCustomExtension = true;
    supportsSearchIndex = false;
    supportsDomains = false;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateLearningResource createMinimalRequest(TestNamespace ns) {
    return new CreateLearningResource()
        .withName(ns.prefix("learning-resource"))
        .withDescription("Test learning resource")
        .withResourceType(CreateLearningResource.ResourceType.VIDEO)
        .withCategories(List.of(ResourceCategory.DISCOVERY))
        .withSource(
            new LearningResourceSource()
                .withProvider("YouTube")
                .withUrl(URI.create("https://youtube.com/watch?v=test")))
        .withContexts(List.of(new LearningResourceContext().withPageId("explore")));
  }

  @Override
  protected CreateLearningResource createRequest(String name, TestNamespace ns) {
    return new CreateLearningResource()
        .withName(name)
        .withDescription("Test learning resource")
        .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
        .withCategories(List.of(ResourceCategory.DATA_GOVERNANCE))
        .withSource(new LearningResourceSource().withUrl(URI.create("https://example.com/article")))
        .withContexts(List.of(new LearningResourceContext().withPageId("glossary")));
  }

  @Override
  protected LearningResource createEntity(CreateLearningResource createRequest) {
    return getLearningResourceService().create(createRequest);
  }

  @Override
  protected LearningResource getEntity(String id) {
    return getLearningResourceService().get(id);
  }

  @Override
  protected LearningResource getEntityByName(String fqn) {
    return getLearningResourceService().getByName(fqn);
  }

  @Override
  protected LearningResource patchEntity(String id, LearningResource entity) {
    return getLearningResourceService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getLearningResourceService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getLearningResourceService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getLearningResourceService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "learningResource";
  }

  @Override
  protected void validateCreatedEntity(
      LearningResource entity, CreateLearningResource createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    if (createRequest.getDisplayName() != null) {
      assertEquals(createRequest.getDisplayName(), entity.getDisplayName());
    }

    assertEquals(createRequest.getResourceType().value(), entity.getResourceType().value());
    assertNotNull(entity.getCategories());
    assertFalse(entity.getCategories().isEmpty());
    assertNotNull(entity.getContexts());
    assertFalse(entity.getContexts().isEmpty());

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain resource name");
  }

  @Override
  protected ListResponse<LearningResource> listEntities(ListParams params) {
    return getLearningResourceService().list(params);
  }

  @Override
  protected LearningResource getEntityWithFields(String id, String fields) {
    return getLearningResourceService().get(id, fields);
  }

  @Override
  protected LearningResource getEntityByNameWithFields(String fqn, String fields) {
    return getLearningResourceService().getByName(fqn, fields);
  }

  @Override
  protected LearningResource getEntityIncludeDeleted(String id) {
    return getLearningResourceService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getLearningResourceService().getVersionList(id);
  }

  @Override
  protected LearningResource getVersion(UUID id, Double version) {
    return getLearningResourceService().getVersion(id.toString(), version);
  }

  // ===================================================================
  // AI CATEGORY TESTS
  // ===================================================================

  @Test
  void post_learningResourceWithAICategory_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("ai-resource"))
            .withDescription("AI tutorial")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.AI))
            .withSource(
                new LearningResourceSource()
                    .withProvider("YouTube")
                    .withUrl(URI.create("https://youtube.com/watch?v=ai-tutorial")))
            .withContexts(List.of(new LearningResourceContext().withPageId("askCollate")));

    LearningResource resource = createEntity(request);
    assertNotNull(resource.getId());
    assertEquals(1, resource.getCategories().size());
    assertTrue(resource.getCategories().contains(ResourceCategory.AI));
  }

  @Test
  void post_learningResourceWithAIAndOtherCategories_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("ai-discovery-resource"))
            .withDescription("AI and Discovery tutorial")
            .withResourceType(CreateLearningResource.ResourceType.STORYLANE)
            .withCategories(List.of(ResourceCategory.AI, ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource()
                    .withProvider("Storylane")
                    .withUrl(URI.create("https://storylane.app/embed/ai-discovery")))
            .withContexts(
                List.of(
                    new LearningResourceContext().withPageId("askCollate"),
                    new LearningResourceContext().withPageId("explore")));

    LearningResource resource = createEntity(request);
    assertEquals(2, resource.getCategories().size());
    assertTrue(resource.getCategories().contains(ResourceCategory.AI));
    assertTrue(resource.getCategories().contains(ResourceCategory.DISCOVERY));
  }

  // ===================================================================
  // ALL CATEGORIES TESTS
  // ===================================================================

  @Test
  void post_learningResourceWithAllCategories_200_OK(TestNamespace ns) {
    for (ResourceCategory category : ResourceCategory.values()) {
      CreateLearningResource request =
          new CreateLearningResource()
              .withName(ns.prefix("cat-" + category.value().toLowerCase()))
              .withDescription("Resource for " + category.value())
              .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
              .withCategories(List.of(category))
              .withSource(
                  new LearningResourceSource()
                      .withUrl(URI.create("https://example.com/" + category.value())))
              .withContexts(List.of(new LearningResourceContext().withPageId("test")));

      LearningResource resource = createEntity(request);
      assertNotNull(resource.getId());
      assertTrue(resource.getCategories().contains(category));
    }
  }

  // ===================================================================
  // RESOURCE TYPE TESTS
  // ===================================================================

  @Test
  void post_learningResourceAllTypes_200_OK(TestNamespace ns) {
    CreateLearningResource.ResourceType[] types = CreateLearningResource.ResourceType.values();

    for (CreateLearningResource.ResourceType type : types) {
      CreateLearningResource request =
          new CreateLearningResource()
              .withName(ns.prefix("type-" + type.value().toLowerCase()))
              .withDescription("Resource type " + type.value())
              .withResourceType(type)
              .withCategories(List.of(ResourceCategory.DISCOVERY))
              .withSource(
                  new LearningResourceSource()
                      .withUrl(URI.create("https://example.com/" + type.value())))
              .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

      LearningResource resource = createEntity(request);
      assertEquals(type.value(), resource.getResourceType().value());
    }
  }

  // ===================================================================
  // DIFFICULTY TESTS
  // ===================================================================

  @Test
  void post_learningResourceAllDifficulties_200_OK(TestNamespace ns) {
    CreateLearningResource.ResourceDifficulty[] difficulties =
        CreateLearningResource.ResourceDifficulty.values();

    for (CreateLearningResource.ResourceDifficulty difficulty : difficulties) {
      CreateLearningResource request =
          new CreateLearningResource()
              .withName(ns.prefix("diff-" + difficulty.value().toLowerCase()))
              .withDescription("Difficulty " + difficulty.value())
              .withResourceType(CreateLearningResource.ResourceType.VIDEO)
              .withCategories(List.of(ResourceCategory.DISCOVERY))
              .withDifficulty(difficulty)
              .withSource(
                  new LearningResourceSource()
                      .withUrl(URI.create("https://example.com/diff-" + difficulty.value())))
              .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

      LearningResource resource = createEntity(request);
      assertEquals(difficulty.value(), resource.getDifficulty().value());
    }
  }

  // ===================================================================
  // STATUS TRANSITION TESTS
  // ===================================================================

  @Test
  void post_learningResourceStatusTransitions_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("status-test"))
            .withDescription("Status transition test")
            .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
            .withCategories(List.of(ResourceCategory.DATA_GOVERNANCE))
            .withStatus(CreateLearningResource.Status.DRAFT)
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/draft")))
            .withContexts(List.of(new LearningResourceContext().withPageId("glossary")));

    LearningResource resource = createEntity(request);
    assertEquals(CreateLearningResource.Status.DRAFT.value(), resource.getStatus().value());

    request.withStatus(CreateLearningResource.Status.ACTIVE);
    LearningResource updated = getLearningResourceService().put(request);
    assertEquals(CreateLearningResource.Status.ACTIVE.value(), updated.getStatus().value());

    request.withStatus(CreateLearningResource.Status.DEPRECATED);
    updated = getLearningResourceService().put(request);
    assertEquals(CreateLearningResource.Status.DEPRECATED.value(), updated.getStatus().value());
  }

  // ===================================================================
  // CONTEXT TESTS
  // ===================================================================

  @Test
  void post_learningResourceWithMultipleContexts_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("multi-context"))
            .withDescription("Multiple contexts test")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource()
                    .withUrl(URI.create("https://example.com/multi-context")))
            .withContexts(
                List.of(
                    new LearningResourceContext().withPageId("explore").withPriority(1),
                    new LearningResourceContext().withPageId("table").withPriority(2),
                    new LearningResourceContext()
                        .withPageId("glossary")
                        .withComponentId("header")
                        .withPriority(3)));

    LearningResource resource = createEntity(request);
    assertEquals(3, resource.getContexts().size());
  }

  @Test
  void post_learningResourceWithComponentId_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("component-context"))
            .withDescription("Component context test")
            .withResourceType(CreateLearningResource.ResourceType.STORYLANE)
            .withCategories(List.of(ResourceCategory.DATA_GOVERNANCE))
            .withSource(
                new LearningResourceSource()
                    .withUrl(URI.create("https://storylane.app/embed/component")))
            .withContexts(
                List.of(
                    new LearningResourceContext()
                        .withPageId("glossary")
                        .withComponentId("terms-table")
                        .withPriority(1)));

    LearningResource resource = createEntity(request);
    assertEquals("terms-table", resource.getContexts().get(0).getComponentId());
  }

  // ===================================================================
  // OPTIONAL FIELDS TESTS
  // ===================================================================

  @Test
  void post_learningResourceWithDisplayName_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("display-name-test"))
            .withDisplayName("Getting Started with Data Discovery")
            .withDescription("Display name test")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/display")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    LearningResource resource = createEntity(request);
    assertEquals("Getting Started with Data Discovery", resource.getDisplayName());
  }

  @Test
  void post_learningResourceWithProvider_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("provider-test"))
            .withDescription("Provider test")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource()
                    .withProvider("YouTube")
                    .withUrl(URI.create("https://youtube.com/watch?v=test")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    LearningResource resource = createEntity(request);
    assertEquals("YouTube", resource.getSource().getProvider());
  }

  @Test
  void post_learningResourceWithAllOptionalFields_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("all-fields"))
            .withDisplayName("Complete Tutorial")
            .withDescription("A comprehensive guide to all features.")
            .withResourceType(CreateLearningResource.ResourceType.STORYLANE)
            .withCategories(
                List.of(
                    ResourceCategory.DISCOVERY,
                    ResourceCategory.DATA_GOVERNANCE,
                    ResourceCategory.AI))
            .withDifficulty(CreateLearningResource.ResourceDifficulty.INTERMEDIATE)
            .withStatus(CreateLearningResource.Status.ACTIVE)
            .withEstimatedDuration(600)
            .withSource(
                new LearningResourceSource()
                    .withProvider("Storylane")
                    .withUrl(URI.create("https://storylane.app/embed/complete")))
            .withContexts(
                List.of(
                    new LearningResourceContext().withPageId("explore").withPriority(1),
                    new LearningResourceContext()
                        .withPageId("glossary")
                        .withComponentId("header")
                        .withPriority(2)));

    LearningResource resource = createEntity(request);
    assertEquals("Complete Tutorial", resource.getDisplayName());
    assertEquals("A comprehensive guide to all features.", resource.getDescription());
    assertEquals(3, resource.getCategories().size());
    assertEquals(
        CreateLearningResource.ResourceDifficulty.INTERMEDIATE.value(),
        resource.getDifficulty().value());
    assertEquals(600, resource.getEstimatedDuration());
    assertEquals(2, resource.getContexts().size());
  }

  // ===================================================================
  // VALIDATION TESTS
  // ===================================================================

  @Test
  void post_learningResourceWithoutRequiredFields_400(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () -> createEntity(new CreateLearningResource().withName(null)),
        "Creating resource without name should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateLearningResource()
                    .withName(ns.prefix("no-type"))
                    .withCategories(List.of(ResourceCategory.DISCOVERY))
                    .withSource(
                        new LearningResourceSource()
                            .withUrl(URI.create("https://example.com/test")))
                    .withContexts(List.of(new LearningResourceContext().withPageId("test")))),
        "Creating resource without resourceType should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateLearningResource()
                    .withName(ns.prefix("no-categories"))
                    .withResourceType(CreateLearningResource.ResourceType.VIDEO)
                    .withCategories(List.of())
                    .withSource(
                        new LearningResourceSource()
                            .withUrl(URI.create("https://example.com/test")))
                    .withContexts(List.of(new LearningResourceContext().withPageId("test")))),
        "Creating resource with empty categories should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateLearningResource()
                    .withName(ns.prefix("no-contexts"))
                    .withResourceType(CreateLearningResource.ResourceType.VIDEO)
                    .withCategories(List.of(ResourceCategory.DISCOVERY))
                    .withSource(
                        new LearningResourceSource()
                            .withUrl(URI.create("https://example.com/test")))
                    .withContexts(List.of())),
        "Creating resource with empty contexts should fail");
  }

  @Test
  void post_learningResourceWithInvalidValues_400(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateLearningResource()
                    .withName(ns.prefix("neg-duration"))
                    .withResourceType(CreateLearningResource.ResourceType.VIDEO)
                    .withCategories(List.of(ResourceCategory.DISCOVERY))
                    .withEstimatedDuration(-100)
                    .withSource(
                        new LearningResourceSource()
                            .withUrl(URI.create("https://example.com/test")))
                    .withContexts(List.of(new LearningResourceContext().withPageId("test")))),
        "Creating resource with negative duration should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateLearningResource()
                    .withName(ns.prefix("neg-priority"))
                    .withResourceType(CreateLearningResource.ResourceType.VIDEO)
                    .withCategories(List.of(ResourceCategory.DISCOVERY))
                    .withSource(
                        new LearningResourceSource()
                            .withUrl(URI.create("https://example.com/test")))
                    .withContexts(
                        List.of(
                            new LearningResourceContext().withPageId("test").withPriority(-5)))),
        "Creating resource with negative priority should fail");
  }

  @Test
  void post_learningResourceDuplicateName_409(TestNamespace ns) {
    String resourceName = ns.prefix("duplicate-test");

    CreateLearningResource request =
        new CreateLearningResource()
            .withName(resourceName)
            .withDescription("First resource")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/dup1")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    createEntity(request);

    CreateLearningResource duplicate =
        new CreateLearningResource()
            .withName(resourceName)
            .withDescription("Duplicate resource")
            .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
            .withCategories(List.of(ResourceCategory.DATA_QUALITY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/dup2")))
            .withContexts(List.of(new LearningResourceContext().withPageId("dataQuality")));

    assertThrows(Exception.class, () -> createEntity(duplicate), "Duplicate name should fail");
  }

  @Test
  void post_learningResourceWithMaxLengthDisplayName_200_OK(TestNamespace ns) {
    String maxDisplayName = "A".repeat(120);

    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("max-display"))
            .withDisplayName(maxDisplayName)
            .withDescription("Max length display name test")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/maxlen")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    LearningResource resource = createEntity(request);
    assertEquals(120, resource.getDisplayName().length());
  }

  @Test
  void post_learningResourceExceedingDisplayNameLength_400(TestNamespace ns) {
    String tooLongDisplayName = "A".repeat(121);

    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("too-long-display"))
            .withDisplayName(tooLongDisplayName)
            .withDescription("Too long display name test")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/toolong")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Display name exceeding 120 chars should fail");
  }

  // ===================================================================
  // BOUNDARY VALUE TESTS
  // ===================================================================

  @Test
  void post_learningResourceWithZeroValues_200_OK(TestNamespace ns) {
    CreateLearningResource request =
        new CreateLearningResource()
            .withName(ns.prefix("zero-values"))
            .withDescription("Zero values test")
            .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withEstimatedDuration(0)
            .withCompletionThreshold(0.0)
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/zero")))
            .withContexts(
                List.of(new LearningResourceContext().withPageId("explore").withPriority(0)));

    LearningResource resource = createEntity(request);
    assertEquals(0, resource.getEstimatedDuration());
    assertEquals(0, resource.getContexts().get(0).getPriority());
  }

  // ===================================================================
  // LIST TESTS
  // ===================================================================

  @Test
  void test_listLearningResources(TestNamespace ns) {
    CreateLearningResource request1 =
        new CreateLearningResource()
            .withName(ns.prefix("list-1"))
            .withDescription("First resource")
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/list1")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    CreateLearningResource request2 =
        new CreateLearningResource()
            .withName(ns.prefix("list-2"))
            .withDescription("Second resource")
            .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
            .withCategories(List.of(ResourceCategory.DATA_QUALITY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/list2")))
            .withContexts(List.of(new LearningResourceContext().withPageId("dataQuality")));

    createEntity(request1);
    createEntity(request2);

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<LearningResource> response = listEntities(params);

    assertNotNull(response);
    assertTrue(response.getData().size() >= 2);
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private LearningResourceService getLearningResourceService() {
    return new LearningResourceService(SdkClients.adminClient().getHttpClient());
  }
}
