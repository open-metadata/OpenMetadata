package org.openmetadata.mcp.tools;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;

class CreateEntityToolTest {

  private static final String TOOLS = "json/data/mcp/tools.json";

  @Test
  void entityTypeIsAnOpenStringInBothToolSchemas() throws IOException {
    assertFalse(hasEntityTypeEnum("create_entity"));
    assertFalse(hasEntityTypeEnum("describe_entity_type"));
  }

  @Test
  void createEntityContractIsCreateOnly() throws IOException {
    String description = tool("create_entity").path("description").asText();

    assertTrue(description.contains("never modifies an existing entity"));
    assertTrue(description.contains("Use patch_entity for every edit"));
    assertFalse(description.contains("UPDATES"));
  }

  @Test
  void repositorySuppliesTheEntityClassAndWritePath() {
    EntityRepository<EntityInterface> repository = repositoryFor(Glossary.class);
    Glossary saved = new Glossary().withId(UUID.randomUUID()).withName("Finance");
    saved.setFullyQualifiedName("Finance");
    stubWrite(repository, saved);
    Authorizer authorizer = mock(Authorizer.class);
    Limits limits = mock(Limits.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);

    withRepository(
        Entity.GLOSSARY,
        repository,
        ruleEngine,
        () -> new CreateEntityTool().execute(authorizer, limits, securityContext(), glossary()));

    InOrder ordered = inOrder(limits, authorizer, ruleEngine, repository);
    ordered.verify(limits).enforceLimits(any(), any(), any());
    ordered.verify(authorizer).authorize(any(), any(), any());
    ordered.verify(ruleEngine).evaluate(any());
    ordered.verify(repository).create(isNull(), any(), anyString(), any());
  }

  @Test
  void aTypeOutsideTheFormerEightIsResolvedFromEntity() {
    EntityRepository<EntityInterface> repository = repositoryFor(Team.class);

    Map<String, Object> described =
        withRepository(
            Entity.TEAM,
            repository,
            () ->
                new DescribeEntityTypeTool()
                    .execute(null, null, Map.of("entityType", Entity.TEAM)));

    assertEquals(Entity.TEAM, described.get("entityType"));
    assertTrue(attributeNames(described).contains("teamType"));
  }

  @Test
  void entityTypesWithDedicatedCreateLifecyclesAreRejectedByBothTools() {
    for (String entityType :
        List.of(
            Entity.USER,
            Entity.BOT,
            Entity.APPLICATION,
            Entity.EVENT_SUBSCRIPTION,
            Entity.INGESTION_PIPELINE,
            Entity.TEST_CASE)) {
      IllegalArgumentException createFailure =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  new CreateEntityTool()
                      .execute(null, null, securityContext(), params(entityType)));
      IllegalArgumentException describeFailure =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  new DescribeEntityTypeTool()
                      .execute(null, null, Map.of("entityType", entityType)));

      assertTrue(
          createFailure.getMessage().contains("cannot be created through create_entity"),
          createFailure.getMessage());
      assertEquals(createFailure.getMessage(), describeFailure.getMessage());
    }
  }

  @Test
  void credentialBearingEntityCategoriesUseTheirDedicatedApis() {
    assertDedicatedApiRequired(Entity.DATABASE_SERVICE, DatabaseService.class);
    assertDedicatedApiRequired(Entity.WORKFLOW, Workflow.class);
  }

  @Test
  void unknownEntityTypeReturnsCorrectiveGuidance() {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository("glosary"))
          .thenThrow(new EntityNotFoundException("repository not found"));
      entities.when(Entity::getEntityList).thenReturn(Set.of(Entity.GLOSSARY, Entity.TEAM));

      IllegalArgumentException failure =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  new DescribeEntityTypeTool()
                      .execute(null, null, Map.of("entityType", "glosary")));

      assertTrue(failure.getMessage().contains("Unknown entityType 'glosary'"));
      assertTrue(failure.getMessage().contains(Entity.GLOSSARY));
      assertTrue(failure.getMessage().contains("describe_entity_type"));
    }
  }

  @Test
  void tagClassificationIsResolvedBeforeAuthorization() {
    EntityRepository<EntityInterface> repository = repositoryFor(Tag.class);
    EntityRepository<EntityInterface> classificationRepository =
        repositoryFor(Classification.class);
    EntityReference parent = new EntityReference().withType(Entity.TAG).withId(UUID.randomUUID());
    EntityReference resolvedParent =
        new EntityReference()
            .withType(Entity.TAG)
            .withId(parent.getId())
            .withFullyQualifiedName("PII.Sensitive");
    EntityReference resolvedClassification =
        new EntityReference()
            .withType(Entity.CLASSIFICATION)
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("PII");
    Tag saved = new Tag().withId(UUID.randomUUID()).withName("Restricted");
    saved.setFullyQualifiedName("PII.Sensitive.Restricted");
    stubWrite(repository, saved);
    Authorizer authorizer = mock(Authorizer.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);
    Map<String, Object> input = params(Entity.TAG);
    input.put("description", "restricted data");
    input.put("attributes", Map.of("parent", parent));

    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<RuleEngine> rules = mockStatic(RuleEngine.class);
        MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class)) {
      entities.when(() -> Entity.getEntityRepository(Entity.TAG)).thenReturn(repository);
      entities
          .when(() -> Entity.getEntityRepository(Entity.CLASSIFICATION))
          .thenReturn(classificationRepository);
      entities.when(() -> Entity.getEntityTypeFromClass(Tag.class)).thenReturn(Entity.TAG);
      entities
          .when(() -> Entity.getEntityReference(parent, Include.NON_DELETED))
          .thenReturn(resolvedParent);
      entities
          .when(
              () ->
                  Entity.getEntityReference(
                      new EntityReference()
                          .withType(Entity.CLASSIFICATION)
                          .withFullyQualifiedName("PII"),
                      Include.NON_DELETED))
          .thenReturn(resolvedClassification);
      rules.when(RuleEngine::getInstance).thenReturn(ruleEngine);

      new CreateEntityTool().execute(authorizer, mock(Limits.class), securityContext(), input);
    }

    ArgumentCaptor<EntityInterface> captor = ArgumentCaptor.forClass(EntityInterface.class);
    verify(repository).create(isNull(), captor.capture(), anyString(), any());
    Tag created = (Tag) captor.getValue();
    assertEquals("PII", created.getClassification().getFullyQualifiedName());
    assertEquals(resolvedClassification.getId(), created.getClassification().getId());

    ArgumentCaptor<CreateResourceContext<EntityInterface>> contextCaptor =
        ArgumentCaptor.forClass(CreateResourceContext.class);
    verify(authorizer).authorize(any(), any(), contextCaptor.capture());
    Tag authorized = (Tag) contextCaptor.getValue().getEntity();
    assertEquals(resolvedClassification.getId(), authorized.getClassification().getId());
    InOrder ordered = inOrder(repository, authorizer, ruleEngine);
    ordered.verify(authorizer).authorize(any(), any(), any());
    ordered.verify(ruleEngine).evaluate(created);
    ordered.verify(repository).create(isNull(), eq(created), anyString(), any());

    Map<String, Object> described =
        withRepository(
            Entity.TAG,
            repository,
            () ->
                new DescribeEntityTypeTool().execute(null, null, Map.of("entityType", Entity.TAG)));
    assertTrue(described.get("conditionalRequirements").toString().contains("classification"));
    assertFalse(described.get("alsoRequired").toString().contains("classification"));
  }

  @Test
  void requiredFieldsComeFromTheRegisteredEntityClass() {
    EntityRepository<EntityInterface> repository = repositoryFor(Glossary.class);

    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    Entity.GLOSSARY,
                    repository,
                    () -> new CreateEntityTool().execute(null, null, securityContext(), params())));

    assertTrue(failure.getMessage().contains("description"));
  }

  @Test
  void unknownAttributeIsRejectedBeforeTheRepositoryIsCalled() {
    EntityRepository<EntityInterface> repository = repositoryFor(Glossary.class);
    Map<String, Object> params = glossary();
    params.put("attributes", Map.of("classification", "PII"));

    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    Entity.GLOSSARY,
                    repository,
                    () -> new CreateEntityTool().execute(null, null, securityContext(), params)));

    assertTrue(failure.getMessage().contains("classification"));
    verify(repository, never()).prepareInternal(any(), anyBoolean());
  }

  @Test
  void referenceAttributesUseTheEntitySchema() {
    EntityRepository<EntityInterface> repository = repositoryFor(GlossaryTerm.class);
    Map<String, Object> described =
        withRepository(
            Entity.GLOSSARY_TERM,
            repository,
            () ->
                new DescribeEntityTypeTool()
                    .execute(null, null, Map.of("entityType", Entity.GLOSSARY_TERM)));

    assertEquals("EntityReference", attribute(described, "glossary").get("type"));
    assertTrue(described.get("alsoRequired").toString().contains("glossary"));
  }

  @Test
  void anEmptyRequiredObjectIsRejectedBeforePersistence() {
    EntityRepository<EntityInterface> repository = repositoryFor(Metric.class);
    Map<String, Object> params = params();
    params.put("entityType", Entity.METRIC);
    params.put("attributes", Map.of("metricExpression", Map.of()));

    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    Entity.METRIC,
                    repository,
                    () -> new CreateEntityTool().execute(null, null, securityContext(), params)));

    assertTrue(failure.getMessage().contains("metricExpression"));
    verify(repository, never()).prepareInternal(any(), anyBoolean());
  }

  @Test
  void domainDefaultIsPreservedAfterRepositoryDrivenBinding() {
    EntityRepository<EntityInterface> repository = repositoryFor(Domain.class);
    Domain saved = new Domain().withId(UUID.randomUUID()).withName("Marketing");
    saved.setFullyQualifiedName("Marketing");
    stubWrite(repository, saved);
    Map<String, Object> params = params();
    params.put("entityType", Entity.DOMAIN);
    params.put("description", "a domain");

    withRepository(
        Entity.DOMAIN,
        repository,
        () ->
            new CreateEntityTool()
                .execute(mock(Authorizer.class), mock(Limits.class), securityContext(), params));

    ArgumentCaptor<EntityInterface> captor = ArgumentCaptor.forClass(EntityInterface.class);
    verify(repository).create(isNull(), captor.capture(), anyString(), any());
    assertEquals(CreateDomain.DomainType.AGGREGATE, ((Domain) captor.getValue()).getDomainType());
  }

  @Test
  void contextMemoryKeepsMcpProvenance() {
    EntityRepository<EntityInterface> repository = repositoryFor(ContextMemory.class);
    ContextMemory saved = new ContextMemory().withId(UUID.randomUUID()).withName("memory");
    saved.setFullyQualifiedName("memory");
    stubWrite(repository, saved);
    Map<String, Object> params = params();
    params.put("entityType", Entity.CONTEXT_MEMORY);
    params.put("attributes", Map.of("question", "Q", "answer", "A"));

    withRepository(
        Entity.CONTEXT_MEMORY,
        repository,
        () ->
            new CreateEntityTool()
                .execute(mock(Authorizer.class), mock(Limits.class), securityContext(), params));

    ArgumentCaptor<EntityInterface> captor = ArgumentCaptor.forClass(EntityInterface.class);
    verify(repository).create(isNull(), captor.capture(), anyString(), any());
    assertEquals(
        ContextMemorySourceType.REMEMBER_REQUEST,
        ((ContextMemory) captor.getValue()).getSourceType());

    Map<String, Object> described =
        withRepository(
            Entity.CONTEXT_MEMORY,
            repository,
            () ->
                new DescribeEntityTypeTool()
                    .execute(null, null, Map.of("entityType", Entity.CONTEXT_MEMORY)));
    assertFalse(attributeNames(described).contains("sourceType"));
  }

  @Test
  void deniedCallerDoesNotReachPersistence() {
    EntityRepository<EntityInterface> repository = repositoryFor(Glossary.class);
    Authorizer authorizer = mock(Authorizer.class);
    RuleEngine ruleEngine = mock(RuleEngine.class);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () ->
            withRepository(
                Entity.GLOSSARY,
                repository,
                ruleEngine,
                () ->
                    new CreateEntityTool()
                        .execute(authorizer, mock(Limits.class), securityContext(), glossary())));

    verify(ruleEngine, never()).evaluate(any());
    verify(repository, never()).prepareInternal(any(), anyBoolean());
    verify(repository, never()).create(isNull(), any(), anyString(), any());
    verify(repository, never()).createOrUpdate(isNull(), any(), anyString(), any());
  }

  @Test
  void aDuplicateCreateFailureIsPropagatedWithoutUpdating() {
    EntityRepository<EntityInterface> repository = repositoryFor(Glossary.class);
    IllegalArgumentException duplicate = new IllegalArgumentException("already exists");
    doThrow(duplicate).when(repository).create(isNull(), any(), anyString(), any());

    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    Entity.GLOSSARY,
                    repository,
                    () ->
                        new CreateEntityTool()
                            .execute(
                                mock(Authorizer.class),
                                mock(Limits.class),
                                securityContext(),
                                glossary())));

    assertEquals(duplicate, failure);
    verify(repository).create(isNull(), any(), anyString(), any());
    verify(repository, never()).createOrUpdate(isNull(), any(), anyString(), any());
  }

  @Test
  void anArticleUsesTheCreatePageContract() {
    EntityRepository<EntityInterface> repository = repositoryFor(Page.class);
    Page saved = new Page().withId(UUID.randomUUID()).withName("runbook");
    saved.setFullyQualifiedName("runbook");
    stubWrite(repository, saved);
    Map<String, Object> params = params(Entity.PAGE);
    params.put("attributes", Map.of("pageType", PageType.ARTICLE.value(), "page", Map.of()));

    withRepository(
        Entity.PAGE,
        repository,
        () ->
            new CreateEntityTool()
                .execute(mock(Authorizer.class), mock(Limits.class), securityContext(), params));

    ArgumentCaptor<EntityInterface> captor = ArgumentCaptor.forClass(EntityInterface.class);
    verify(repository).create(isNull(), captor.capture(), anyString(), any());
    Page created = (Page) captor.getValue();
    assertEquals(PageType.ARTICLE, created.getPageType());
    assertNotNull(created.getPage());
    assertEquals(0, created.getVotes().getUpVotes());
    assertEquals(
        Entity.ORGANIZATION_NAME, created.getRelatedEntities().getFirst().getFullyQualifiedName());

    Map<String, Object> described =
        withRepository(
            Entity.PAGE,
            repository,
            () ->
                new DescribeEntityTypeTool()
                    .execute(null, null, Map.of("entityType", Entity.PAGE)));
    assertTrue(described.get("alsoRequired").toString().contains("pageType"));
    assertTrue(described.get("alsoRequired").toString().contains("page"));
  }

  @Test
  void anEmptyQuickLinkIsRejectedBeforePersistence() {
    EntityRepository<EntityInterface> repository = repositoryFor(Page.class);
    Map<String, Object> params = params(Entity.PAGE);
    params.put("attributes", Map.of("pageType", PageType.QUICK_LINK.value(), "page", Map.of()));

    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    Entity.PAGE,
                    repository,
                    () -> new CreateEntityTool().execute(null, null, securityContext(), params)));

    assertTrue(failure.getMessage().contains("page"));
    verify(repository, never()).prepareInternal(any(), anyBoolean());
  }

  @Test
  void aReferenceAttributeSaysItTakesAFullyQualifiedName() {
    // The eight tools this one replaced took references as plain FQN strings. The generic path
    // still resolves a name-only reference, but callers were told to send ids and given the
    // EntityReference schema blurb, so they spent a lookup they did not need.
    EntityRepository<EntityInterface> repository = repositoryFor(Page.class);

    Map<String, Object> described =
        withRepository(
            Entity.PAGE,
            repository,
            () ->
                new DescribeEntityTypeTool()
                    .execute(null, null, Map.of("entityType", Entity.PAGE)));

    String parent = String.valueOf(attribute(described, "parent").get("description"));
    assertTrue(parent.contains("fullyQualifiedName"), parent);
    assertFalse(parent.contains("This schema defines"), parent);
    assertTrue(
        String.valueOf(attribute(described, "relatedEntities").get("description"))
            .contains("fullyQualifiedName"));
  }

  @Test
  void anArticleBodySuppliedByTheCallerIsKept() {
    EntityRepository<EntityInterface> repository = repositoryFor(Page.class);
    Page saved = new Page().withId(UUID.randomUUID()).withName("runbook");
    saved.setFullyQualifiedName("runbook");
    stubWrite(repository, saved);
    Map<String, Object> params = params(Entity.PAGE);
    params.put(
        "attributes",
        Map.of(
            "pageType",
            PageType.ARTICLE.value(),
            "page",
            Map.of("publicationDate", "2026-08-28T00:00:00.000Z"),
            "entityStatus",
            EntityStatus.DRAFT.value()));

    withRepository(
        Entity.PAGE,
        repository,
        () ->
            new CreateEntityTool()
                .execute(mock(Authorizer.class), mock(Limits.class), securityContext(), params));

    ArgumentCaptor<EntityInterface> captor = ArgumentCaptor.forClass(EntityInterface.class);
    verify(repository).create(isNull(), captor.capture(), anyString(), any());
    Page created = (Page) captor.getValue();
    assertNotNull(
        JsonUtils.convertValue(created.getPage(), Article.class).getPublicationDate(),
        "the caller's article body must not be replaced by the default");
    assertEquals(EntityStatus.DRAFT, created.getEntityStatus());
  }

  @Test
  void aPageOffersOnlyTheFieldsItsCreateRequestCarries() {
    // Binding straight to the entity class exposed fields no caller sets - children and editors are
    // written from relationships, votes and the extraction fields by background work. Offering
    // 'children' was the harmful one: storeRelationships reads child.getId() and a caller has no id
    // to give, so an accepted value would have written a relationship row with a null id.
    EntityRepository<EntityInterface> repository = repositoryFor(Page.class);

    Map<String, Object> described =
        withRepository(
            Entity.PAGE,
            repository,
            () ->
                new DescribeEntityTypeTool()
                    .execute(null, null, Map.of("entityType", Entity.PAGE)));

    assertEquals(
        Set.of("pageType", "page", "parent", "relatedEntities", "entityStatus"),
        attributeNames(described));

    Map<String, Object> params = params(Entity.PAGE);
    params.put(
        "attributes",
        Map.of("pageType", PageType.ARTICLE.value(), "children", List.of(Map.of("type", "page"))));
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    Entity.PAGE,
                    repository,
                    () -> new CreateEntityTool().execute(null, null, securityContext(), params)));

    assertTrue(failure.getMessage().contains("children"), failure.getMessage());
    verify(repository, never()).prepareInternal(any(), anyBoolean());
  }

  @SuppressWarnings("unchecked")
  private static EntityRepository<EntityInterface> repositoryFor(
      Class<? extends EntityInterface> entityClass) {
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    when(repository.getEntityClass()).thenReturn((Class<EntityInterface>) entityClass);
    when(repository.getParentEntity(any(), anyString()))
        .thenThrow(new EntityNotFoundException("no parent"));
    return repository;
  }

  private static void stubWrite(
      EntityRepository<EntityInterface> repository, EntityInterface saved) {
    when(repository.create(isNull(), any(), anyString(), any())).thenReturn(saved);
  }

  private static <T> T withRepository(
      String entityType, EntityRepository<?> repository, Supplier<T> action) {
    return withRepository(entityType, repository, mock(RuleEngine.class), action);
  }

  private static <T> T withRepository(
      String entityType,
      EntityRepository<?> repository,
      RuleEngine ruleEngine,
      Supplier<T> action) {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<RuleEngine> rules = mockStatic(RuleEngine.class);
        MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class)) {
      entities.when(() -> Entity.getEntityRepository(entityType)).thenReturn(repository);
      entities
          .when(() -> Entity.getEntityTypeFromClass(repository.getEntityClass()))
          .thenReturn(entityType);
      entities
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      Entity.TEAM, Entity.ORGANIZATION_NAME, Include.ALL))
          .thenReturn(
              new EntityReference()
                  .withType(Entity.TEAM)
                  .withFullyQualifiedName(Entity.ORGANIZATION_NAME));
      rules.when(RuleEngine::getInstance).thenReturn(ruleEngine);
      return action.get();
    }
  }

  private static Map<String, Object> glossary() {
    Map<String, Object> params = params();
    params.put("description", "a glossary");
    return params;
  }

  private static Map<String, Object> params() {
    return params(Entity.GLOSSARY);
  }

  private static Map<String, Object> params(String entityType) {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", entityType);
    params.put("name", "Finance");
    return params;
  }

  private static void assertDedicatedApiRequired(
      String entityType, Class<? extends EntityInterface> entityClass) {
    EntityRepository<EntityInterface> repository = repositoryFor(entityClass);
    IllegalArgumentException createFailure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    entityType,
                    repository,
                    () ->
                        new CreateEntityTool()
                            .execute(null, null, securityContext(), params(entityType))));
    IllegalArgumentException describeFailure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                withRepository(
                    entityType,
                    repository,
                    () ->
                        new DescribeEntityTypeTool()
                            .execute(null, null, Map.of("entityType", entityType))));

    assertTrue(
        createFailure.getMessage().contains("dedicated OpenMetadata API"),
        createFailure.getMessage());
    assertEquals(createFailure.getMessage(), describeFailure.getMessage());
  }

  private static CatalogSecurityContext securityContext() {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(() -> "admin");
    return securityContext;
  }

  private static Set<String> attributeNames(Map<String, Object> described) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> attributes = (List<Map<String, Object>>) described.get("attributes");
    return attributes.stream()
        .map(attribute -> String.valueOf(attribute.get("name")))
        .collect(Collectors.toSet());
  }

  private static Map<String, Object> attribute(Map<String, Object> described, String name) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> attributes = (List<Map<String, Object>>) described.get("attributes");
    return attributes.stream()
        .filter(attribute -> name.equals(attribute.get("name")))
        .findFirst()
        .orElseThrow();
  }

  private static boolean hasEntityTypeEnum(String toolName) throws IOException {
    return tool(toolName).path("parameters").path("properties").path("entityType").has("enum");
  }

  private static JsonNode tool(String toolName) throws IOException {
    for (JsonNode tool : JsonUtils.readTree(toolsJson()).path("tools")) {
      if (toolName.equals(tool.path("name").asText())) {
        return tool;
      }
    }
    throw new AssertionError("no tool named " + toolName + " in " + TOOLS);
  }

  private static String toolsJson() throws IOException {
    try (InputStream stream =
        CreateEntityToolTest.class.getClassLoader().getResourceAsStream(TOOLS)) {
      if (stream == null) {
        throw new AssertionError(TOOLS + " is not on the test classpath");
      }
      return new String(stream.readAllBytes(), UTF_8);
    }
  }
}
