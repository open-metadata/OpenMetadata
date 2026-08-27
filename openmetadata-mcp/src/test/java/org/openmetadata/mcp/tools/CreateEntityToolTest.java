package org.openmetadata.mcp.tools;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
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
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
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
import org.openmetadata.service.util.RestUtil;

class CreateEntityToolTest {

  private static final String TOOLS = "json/data/mcp/tools.json";

  @Test
  void entityTypeIsAnOpenStringInBothToolSchemas() throws IOException {
    assertFalse(hasEntityTypeEnum("create_entity"));
    assertFalse(hasEntityTypeEnum("describe_entity_type"));
  }

  @Test
  void repositorySuppliesTheEntityClassAndWritePath() {
    EntityRepository<EntityInterface> repository = repositoryFor(Glossary.class);
    Glossary saved = new Glossary().withId(UUID.randomUUID()).withName("Finance");
    saved.setFullyQualifiedName("Finance");
    when(repository.createOrUpdate(isNull(), any(), anyString(), any()))
        .thenReturn(new RestUtil.PutResponse<>(null, saved, EventType.ENTITY_CREATED));
    setPreparedFqn(repository, "Finance");
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
    ordered.verify(repository).prepareInternal(any(), anyBoolean());
    ordered.verify(authorizer).authorize(any(), any(), any());
    ordered.verify(repository).createOrUpdate(isNull(), any(), anyString(), any());
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
    when(repository.createOrUpdate(isNull(), any(), anyString(), any()))
        .thenReturn(new RestUtil.PutResponse<>(null, saved, EventType.ENTITY_CREATED));
    setPreparedFqn(repository, saved.getFullyQualifiedName());
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
    verify(repository).prepareInternal(captor.capture(), anyBoolean());
    Tag prepared = (Tag) captor.getValue();
    assertEquals("PII", prepared.getClassification().getFullyQualifiedName());
    assertEquals(resolvedClassification.getId(), prepared.getClassification().getId());

    ArgumentCaptor<CreateResourceContext<EntityInterface>> contextCaptor =
        ArgumentCaptor.forClass(CreateResourceContext.class);
    verify(authorizer).authorize(any(), any(), contextCaptor.capture());
    Tag authorized = (Tag) contextCaptor.getValue().getEntity();
    assertEquals(resolvedClassification.getId(), authorized.getClassification().getId());
    InOrder ordered = inOrder(authorizer, ruleEngine, repository);
    ordered.verify(authorizer).authorize(any(), any(), any());
    ordered.verify(ruleEngine).evaluate(prepared);
    ordered.verify(repository).prepareInternal(prepared, false);

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
    when(repository.createOrUpdate(isNull(), any(), anyString(), any()))
        .thenReturn(new RestUtil.PutResponse<>(null, saved, EventType.ENTITY_CREATED));
    setPreparedFqn(repository, "Marketing");
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
    verify(repository).createOrUpdate(isNull(), captor.capture(), anyString(), any());
    assertEquals(CreateDomain.DomainType.AGGREGATE, ((Domain) captor.getValue()).getDomainType());
  }

  @Test
  void contextMemoryKeepsMcpProvenance() {
    EntityRepository<EntityInterface> repository = repositoryFor(ContextMemory.class);
    ContextMemory saved = new ContextMemory().withId(UUID.randomUUID()).withName("memory");
    saved.setFullyQualifiedName("memory");
    when(repository.createOrUpdate(isNull(), any(), anyString(), any()))
        .thenReturn(new RestUtil.PutResponse<>(null, saved, EventType.ENTITY_CREATED));
    setPreparedFqn(repository, "memory");
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
    verify(repository).createOrUpdate(isNull(), captor.capture(), anyString(), any());
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
    verify(repository, never()).createOrUpdate(isNull(), any(), anyString(), any());
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

  private static void setPreparedFqn(
      EntityRepository<EntityInterface> repository, String fullyQualifiedName) {
    doAnswer(
            invocation -> {
              invocation.<EntityInterface>getArgument(0).setFullyQualifiedName(fullyQualifiedName);
              return null;
            })
        .when(repository)
        .prepareInternal(any(), anyBoolean());
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
