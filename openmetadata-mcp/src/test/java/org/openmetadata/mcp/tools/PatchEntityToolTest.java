package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

/**
 * Tests that PatchEntityTool correctly threads ImpersonationContext through to the repository
 * and publishes change events with the caller's userName.
 */
class PatchEntityToolTest {

  private Authorizer authorizer;
  private CatalogSecurityContext securityContext;
  private Principal principal;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    securityContext = mock(CatalogSecurityContext.class);
    principal = mock(Principal.class);
    when(principal.getName()).thenReturn("alice");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
  }

  @AfterEach
  void clearImpersonationContext() {
    ImpersonationContext.clear();
  }

  /**
   * A patch answers with the patched entity, which makes it a read too, so the per-entity
   * visibility rule runs before the write.
   */
  @Test
  void execute_refusesToPatchAnotherUsersPrivateMemory() {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    ContextMemory memory =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName("bobs-private-note")
            .withFullyQualifiedName("bobs-private-note")
            .withAnswer("the secret answer")
            .withOwners(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType(Entity.USER)
                        .withName("bob")
                        .withFullyQualifiedName("bob")))
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));

    Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.CONTEXT_MEMORY);
    params.put("fqn", "bobs-private-note");
    params.put("patch", "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"x\"}]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
          .thenReturn(repository);
      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.CONTEXT_MEMORY), eq("bobs-private-note"), anyString(), any()))
          .thenReturn(memory);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName("alice"), null, null));

      assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
          .isInstanceOf(ForbiddenException.class);
    }

    verify(repository, never()).patch(any(), anyString(), any(), any(), any(), any(), any());
  }

  /** A bot may patch a memory citing a Query it cannot view; the answer is still a read. */
  @Test
  void execute_reducesAQueryTheCallerMayNotViewToIdAndType() {
    final EntityReference query = hiddenQueryRef();
    final ContextMemory memory = memoryCitingQuery(query);
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.CONTEXT_MEMORY);
    params.put("fqn", "salary-bands");
    params.put(
        "patch",
        "[{\"op\": \"replace\", \"path\": \"/relatedEntities\", \"value\": [{\"id\": \""
            + query.getId()
            + "\", \"type\": \"query\"}]}]");

    final Map<String, Object> result = executeMemoryPatchWithDeniedQuery(memory, params);

    assertThat(result.get("relatedEntities"))
        .isEqualTo(List.of(Map.of("id", query.getId().toString(), "type", Entity.QUERY)));
    assertThat(memory.getRelatedEntities()).containsExactly(query);
  }

  @Test
  void execute_compactPatchOnDescriptionOmitsUntouchedHiddenQueryReferences() {
    final EntityReference query = hiddenQueryRef();
    final ContextMemory memory = memoryCitingQuery(query).withDescription("updated");
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.CONTEXT_MEMORY);
    params.put("fqn", "salary-bands");
    params.put(
        "patch", "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"updated\"}]");

    final Map<String, Object> result = executeMemoryPatchWithDeniedQuery(memory, params);

    assertThat(result).containsEntry("description", "updated").doesNotContainKey("relatedEntities");
    assertThat(result.toString())
        .doesNotContain("payroll", "erp.payroll", "Who earns more than the CEO?");
  }

  @Test
  void execute_responseFull_reducesAQueryTheCallerMayNotViewToIdAndType() {
    final EntityReference query = hiddenQueryRef();
    final ContextMemory memory = memoryCitingQuery(query).withDescription("updated");
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.CONTEXT_MEMORY);
    params.put("fqn", "salary-bands");
    params.put(
        "patch", "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"updated\"}]");
    params.put("response", "full");

    final Map<String, Object> result = executeMemoryPatchWithDeniedQuery(memory, params);

    assertThat(result.get("relatedEntities"))
        .isEqualTo(List.of(Map.of("id", query.getId().toString(), "type", Entity.QUERY)));
    assertThat(memory.getRelatedEntities()).containsExactly(query);
  }

  private static EntityReference hiddenQueryRef() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.QUERY)
        .withName("payroll")
        .withFullyQualifiedName("erp.payroll")
        .withDisplayName("Who earns more than the CEO?");
  }

  private static ContextMemory memoryCitingQuery(final EntityReference query) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("salary-bands")
        .withFullyQualifiedName("salary-bands")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
        .withRelatedEntities(List.of(query));
  }

  private Map<String, Object> executeMemoryPatchWithDeniedQuery(
      final ContextMemory memory, final Map<String, Object> params) {
    @SuppressWarnings("unchecked")
    final EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    when(repository.patch(any(), anyString(), any(), any(), any(), any(), any()))
        .thenReturn(
            new RestUtil.PatchResponse<>(Response.Status.OK, memory, EventType.ENTITY_UPDATED));
    doThrow(new AuthorizationException("denied"))
        .when(authorizer)
        .authorize(
            eq(securityContext),
            argThat(operation -> Entity.QUERY.equals(operation.getResource())),
            any());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
          .thenReturn(repository);
      CitedQueries.stillExist(entityMock);
      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.CONTEXT_MEMORY), eq("salary-bands"), anyString(), any()))
          .thenReturn(memory);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName("alice"), null, null));

      return new PatchEntityTool().execute(authorizer, securityContext, params);
    }
  }

  @Test
  void execute_passesImpersonationContextToRepository() {
    ImpersonationContext.setImpersonatedBy("McpApplicationBot");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> mockRepo = mock(EntityRepository.class);
    EntityInterface<?> mockEntity = mock(EntityInterface.class);
    RestUtil.PatchResponse<EntityInterface<?>> patchResponse =
        new RestUtil.PatchResponse<>(Response.Status.OK, mockEntity, EventType.ENTITY_UPDATED);
    when(mockRepo.patch(any(), any(String.class), any(), any(), any(), any(), any()))
        .thenReturn(patchResponse);

    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", "[]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {

      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());

      new PatchEntityTool().execute(authorizer, securityContext, params);

      ArgumentCaptor<String> impersonatedByCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockRepo)
          .patch(
              isNull(),
              any(String.class),
              eq("alice"),
              any(),
              eq(ChangeSource.AUTOMATED),
              isNull(),
              impersonatedByCaptor.capture());

      assertThat(impersonatedByCaptor.getValue())
          .as("impersonatedBy passed to repository must equal what was set in ImpersonationContext")
          .isEqualTo("McpApplicationBot");
    }
  }

  @Test
  void execute_withNoImpersonationContext_passesNullImpersonatedBy() {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> mockRepo = mock(EntityRepository.class);
    EntityInterface<?> mockEntity = mock(EntityInterface.class);
    RestUtil.PatchResponse<EntityInterface<?>> patchResponse =
        new RestUtil.PatchResponse<>(Response.Status.OK, mockEntity, EventType.ENTITY_UPDATED);
    when(mockRepo.patch(any(), any(String.class), any(), any(), any(), any(), any()))
        .thenReturn(patchResponse);

    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", "[]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {

      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());

      new PatchEntityTool().execute(authorizer, securityContext, params);

      ArgumentCaptor<String> impersonatedByCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockRepo)
          .patch(
              isNull(),
              any(String.class),
              eq("alice"),
              any(),
              eq(ChangeSource.AUTOMATED),
              isNull(),
              impersonatedByCaptor.capture());

      assertThat(impersonatedByCaptor.getValue())
          .as("impersonatedBy must be null when ImpersonationContext is not set")
          .isNull();
    }
  }

  @Test
  void execute_publishesChangeEventWithCallerUserName() {
    ImpersonationContext.setImpersonatedBy("McpApplicationBot");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> mockRepo = mock(EntityRepository.class);
    EntityInterface<?> mockEntity = mock(EntityInterface.class);
    RestUtil.PatchResponse<EntityInterface<?>> patchResponse =
        new RestUtil.PatchResponse<>(Response.Status.OK, mockEntity, EventType.ENTITY_UPDATED);
    when(mockRepo.patch(any(), any(String.class), any(), any(), any(), any(), any()))
        .thenReturn(patchResponse);

    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", "[]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {

      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());

      new PatchEntityTool().execute(authorizer, securityContext, params);

      changeEventMock.verify(
          () ->
              McpChangeEventUtil.publishChangeEvent(
                  eq(mockEntity), eq(EventType.ENTITY_UPDATED), eq("alice")));
    }
  }

  @Test
  void execute_authorizesWithPatchResourceContext() {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> mockRepo = mock(EntityRepository.class);
    EntityInterface<?> mockEntity = mock(EntityInterface.class);
    when(mockRepo.getPatchFields()).thenReturn(new Fields(Set.of()));
    when(mockRepo.patch(any(), any(String.class), any(), any(), any(), any(), any()))
        .thenReturn(
            new RestUtil.PatchResponse<>(Response.Status.OK, mockEntity, EventType.ENTITY_UPDATED));
    doAnswer(
            invocation -> {
              ResourceContextInterface resourceContext = invocation.getArgument(2);
              resourceContext.getEntity();
              return null;
            })
        .when(authorizer)
        .authorize(eq(securityContext), any(), any());

    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", "[]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());

      new PatchEntityTool().execute(authorizer, securityContext, params);
    }

    verify(mockRepo).getPatchFields();
  }

  @Test
  void execute_letsMetricDescriptionEditsThrough() {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> mockRepo = mock(EntityRepository.class);
    EntityInterface<?> mockEntity = mock(EntityInterface.class);
    when(mockRepo.patch(any(), any(String.class), any(), any(), any(), any(), any()))
        .thenReturn(
            new RestUtil.PatchResponse<>(Response.Status.OK, mockEntity, EventType.ENTITY_UPDATED));
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "metric");
    params.put("fqn", "revenue");
    params.put("patch", "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Net\"}]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {
      entityMock.when(() -> Entity.getEntityRepository("metric")).thenReturn(mockRepo);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());
      jsonMock.when(() -> JsonUtils.extractPatchedFields(any())).thenCallRealMethod();

      new PatchEntityTool().execute(authorizer, securityContext, params);
    }

    verify(mockRepo).patch(any(), eq("revenue"), any(), any(), any(), any(), any());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "announcement",
        "app",
        "contextFile",
        "document",
        "eventsubscription",
        "ingestionPipeline",
        "intakeForm",
        "notificationTemplate",
        "persona",
        "testCase",
        "testSuite",
        "task",
        "team",
        "user",
        "workflow"
      })
  void execute_rejectsEntitiesWhoseResourceOwnsThePatchLifecycle(String entityType) {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", entityType);
    params.put("fqn", "target");
    params.put("patch", "[]");

    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("entityType '" + entityType + "'")
        .hasMessageContaining("dedicated OpenMetadata REST PATCH API")
        .hasMessageContaining("Nothing was changed");
    verifyNoInteractions(authorizer);
  }

  @Test
  void execute_rejectsTimeSeriesEntitiesBeforeAuthorization() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TEST_CASE_RESOLUTION_STATUS);
    params.put("fqn", "target");
    params.put("patch", "[]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.isTimeSeriesEntity(Entity.TEST_CASE_RESOLUTION_STATUS))
          .thenReturn(true);

      assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("time-series entities")
          .hasMessageContaining("dedicated OpenMetadata API")
          .hasMessageContaining("Nothing was changed");
    }
    verifyNoInteractions(authorizer);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "[{\"op\":\"replace\",\"path\":\"/connection/config/authType/password\",\"value\":\"*\"}]",
        "[{\"op\":\"replace\",\"path\":\"/connection\",\"value\":{}}]",
        "[{\"op\":\"replace\",\"path\":\"\",\"value\":{}}]",
        "[{\"op\":\"copy\",\"from\":\"/connection/config/authType/password\",\"path\":\"/description\"}]",
        "[{\"op\":\"test\",\"path\":\"/connection/config/authType/password\",\"value\":\"guess\"}]"
      })
  void execute_rejectsPatchesThatReachAServiceConnection(String patch) {
    DatabaseServiceRepository serviceRepository = mock(DatabaseServiceRepository.class);
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.DATABASE_SERVICE);
    params.put("fqn", "mysqlService");
    params.put("patch", patch);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SERVICE))
          .thenReturn(serviceRepository);

      assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("'/connection'")
          .hasMessageContaining("Nothing was changed");
    }
    verifyNoInteractions(authorizer, serviceRepository);
  }

  @Test
  void execute_servicePatchOutsideTheConnectionReachesTheRepository() {
    DatabaseServiceRepository serviceRepository = mock(DatabaseServiceRepository.class);
    doReturn(
            new RestUtil.PatchResponse<>(
                Response.Status.OK, mock(EntityInterface.class), EventType.ENTITY_UPDATED))
        .when(serviceRepository)
        .patch(any(), any(String.class), any(), any(), any(), any(), any());
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.DATABASE_SERVICE);
    params.put("fqn", "mysqlService");
    params.put("patch", "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"x\"}]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SERVICE))
          .thenReturn(serviceRepository);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());

      new PatchEntityTool().execute(authorizer, securityContext, params);

      verify(serviceRepository).patch(any(), any(String.class), any(), any(), any(), any(), any());
    }
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"x\"}]",
        "[{\"op\":\"add\",\"path\":\"/owners/-\",\"value\":{\"id\":\"u\",\"type\":\"user\"}}]",
        "[{\"op\":\"remove\",\"path\":\"/owners/0\"}]",
        "[{\"op\":\"move\",\"from\":\"/a\",\"path\":\"/b\"}]",
        "[{\"op\":\"test\",\"path\":\"/description\",\"value\":\"x\"}]"
      })
  void execute_validPatchReachesTheRepository(String goodPatch) {
    // Validation must judge the DOCUMENT, never the entity. An earlier attempt checked the patch by
    // applying it to an empty object, which rejected every one of these - including the
    // owner-append
    // the tool description itself advertises - because the paths do not exist in '{}'. Whether a
    // path exists is the repository's question to answer against the real entity.
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> mockRepo = mock(EntityRepository.class);
    EntityInterface<?> mockEntity = mock(EntityInterface.class);
    when(mockRepo.patch(any(), any(String.class), any(), any(), any(), any(), any()))
        .thenReturn(
            new RestUtil.PatchResponse<>(Response.Status.OK, mockEntity, EventType.ENTITY_UPDATED));

    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", goodPatch);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class);
        MockedStatic<JsonUtils> jsonMock = mockStatic(JsonUtils.class)) {
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);
      jsonMock.when(() -> JsonUtils.convertValue(any(), eq(Map.class))).thenReturn(Map.of());

      new PatchEntityTool().execute(authorizer, securityContext, params);

      verify(mockRepo).patch(any(), any(String.class), any(), any(), any(), any(), any());
    }
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "[{\"foo\":\"bar\"}]",
        "[{\"op\":\"bogus\",\"path\":\"/x\",\"value\":1}]",
        "[{\"op\":\"replace\"}]",
        "[\"not-an-object\"]"
      })
  void execute_validJsonButInvalidPatch_isAlsoTheCallersProblem(String badPatch) {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", badPatch);

    // Json.createPatch does not validate operations - it builds happily and only fails on apply(),
    // inside the repository. There an unknown op is a JsonException and a bare object is a raw
    // NullPointerException; the dispatcher reads neither as the caller's fault and returns 500
    // with "retrying will not help", for a document the model wrote and could fix.
    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not a valid JSONPatch document");
  }

  @Test
  void execute_malformedPatch_isTheCallersProblemNotABackendFault() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", "[{\"op\": \"add\", \"path\": \"/owners/-\", \"value\": {\"id\": \"x\"}]");

    // An IllegalArgumentException is what the dispatcher maps to 400. Letting the JSON library's
    // own exception escape produced a 500 telling the model its arguments were fine and not to
    // retry - for a document the model wrote and could fix.
    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not valid JSON");
  }

  @Test
  void execute_missingPatch_throwsIllegalArgumentException() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", null);

    // The patch document is the whole interface, so its absence names the RFC and shows the shape.
    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("'patch' is required")
        .hasMessageContaining("RFC 6902");
  }

  @Test
  void execute_missingTarget_namesBothRequiredParameters() {
    Map<String, Object> params = new HashMap<>();
    params.put("fqn", "db.schema.test_table");

    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("'entityType' and 'fqn' are required");
  }

  /** A held write leaves the entity as published, so the reply must not say it was updated. */
  @Test
  void execute_reportsAWriteAnApprovalWorkflowHeldAsPendingApproval() {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    Table published =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("shop.db.sales.orders")
            .withDescription("old")
            .withVersion(0.2)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("tags"))));
    UUID changeRequestId = UUID.randomUUID();
    when(repository.patch(any(), anyString(), any(), any(), any(), any(), any()))
        .thenReturn(
            new RestUtil.PatchResponse<>(
                Response.Status.ACCEPTED, published, EventType.ENTITY_NO_CHANGE, changeRequestId));
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put("patch", "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"new\"}]");
    Map<String, Object> result;

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      result = new PatchEntityTool().execute(authorizer, securityContext, params);
    }

    assertThat(result)
        .containsEntry("_operation", "pendingApproval")
        .containsEntry("changeRequestId", changeRequestId.toString())
        .containsEntry("entityType", Entity.TABLE)
        .containsEntry("description", "old")
        .doesNotContainKeys("changed", "tags", "columns");
  }

  @Test
  void execute_defaultCompactResponseOmitsWideTableColumns() {
    final Table patchedTable =
        sampleWideTable()
            .withDescription("Curated orders table")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("description"))));
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put(
        "patch",
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Curated orders table\"}]");

    final Map<String, Object> result = executeTablePatch(patchedTable, params);

    assertThat(result)
        .containsEntry("id", patchedTable.getId().toString())
        .containsEntry("name", "orders")
        .containsEntry("fullyQualifiedName", "shop.db.sales.orders")
        .containsEntry("entityType", Entity.TABLE)
        .containsEntry("version", 0.2)
        .containsEntry("updatedAt", 1_700_000_000_000L)
        .containsEntry("_operation", "updated")
        .containsEntry("changed", List.of("description"))
        .containsEntry("description", "Curated orders table")
        .doesNotContainKeys(
            "columns", "owners", "schemaDefinition", "changeDescription", "updatedBy");
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "   ", "compact"})
  void execute_blankOrExplicitCompactResponseUsesCompactMode(final String responseMode) {
    final Table patchedTable =
        sampleWideTable()
            .withDescription("Curated orders table")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("description"))));
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put(
        "patch",
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Curated orders table\"}]");
    params.put("response", responseMode);

    final Map<String, Object> result = executeTablePatch(patchedTable, params);

    assertThat(result)
        .containsEntry("entityType", Entity.TABLE)
        .containsEntry("description", "Curated orders table")
        .doesNotContainKey("columns");
  }

  @Test
  void execute_responseFull_returnsFullEntityWithConfirmationMetadata() {
    final Table patchedTable =
        sampleWideTable()
            .withDescription("Curated orders table")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("description"))));
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put(
        "patch",
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Curated orders table\"}]");
    params.put("response", "full");

    final Map<String, Object> result = executeTablePatch(patchedTable, params);

    assertThat(result)
        .containsEntry("entityType", Entity.TABLE)
        .containsEntry("version", 0.2)
        .containsEntry("updatedAt", 1_700_000_000_000L)
        .containsEntry("_operation", "updated")
        .containsEntry("changed", List.of("description"))
        .containsEntry("description", "Curated orders table")
        .containsKeys("columns", "owners", "schemaDefinition")
        .doesNotContainKeys("changeDescription", "updatedBy");
  }

  @ParameterizedTest
  @ValueSource(strings = {"verbose", "xml", "COMPACT", "true"})
  void execute_invalidResponseString_throwsBeforeAuthorizingOrPatching(final String badMode) {
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put("patch", "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"x\"}]");
    params.put("response", badMode);

    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("'response'")
        .hasMessageContaining("Nothing was changed");
    verifyNoInteractions(authorizer);
  }

  @Test
  void execute_nonStringResponseParameter_throwsBeforeAuthorizingOrPatching() {
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put("patch", "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"x\"}]");
    params.put("response", 123);

    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("'response'")
        .hasMessageContaining("Nothing was changed");
    verifyNoInteractions(authorizer);
  }

  @Test
  void execute_unescapesRfc6901ExtensionPointerInOrder() {
    final Map<String, Object> extension = new LinkedHashMap<>();
    extension.put("cost/center", "FIN-99");
    extension.put("~1", "literal-tilde-one");
    extension.put("untouchedProp", "huge-untouched-value");
    final Table patchedTable =
        sampleWideTable()
            .withExtension(extension)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsAdded(List.of(new FieldChange().withName("extension"))));
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put(
        "patch",
        "[{\"op\":\"add\",\"path\":\"/extension/cost~1center\",\"value\":\"FIN-99\"},"
            + "{\"op\":\"add\",\"path\":\"/extension/~01\",\"value\":\"literal-tilde-one\"}]");

    final Map<String, Object> result = executeTablePatch(patchedTable, params);

    assertThat(result)
        .containsEntry("extension", Map.of("cost/center", "FIN-99", "~1", "literal-tilde-one"))
        .doesNotContainKey("columns");
  }

  @Test
  void execute_collectsMoveAndCopyFromPointersAndIgnoresTestOperations() {
    final List<TagLabel> tags = List.of(new TagLabel().withTagFQN("Tier.Tier1"));
    final Table patchedTable =
        sampleWideTable()
            .withTags(tags)
            .withDescription("copied")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("description"))));
    final Map<String, Object> params = new HashMap<>();
    params.put("entityType", Entity.TABLE);
    params.put("fqn", "shop.db.sales.orders");
    params.put(
        "patch",
        "[{\"op\":\"test\",\"path\":\"/owners\",\"value\":[]},"
            + "{\"op\":\"copy\",\"from\":\"/tags/0/tagFQN\",\"path\":\"/description\"}]");

    final Map<String, Object> result = executeTablePatch(patchedTable, params);

    assertThat(result)
        .containsEntry("description", "copied")
        .containsKey("tags")
        .doesNotContainKeys("owners", "columns");
  }

  private Map<String, Object> executeTablePatch(
      final Table patchedTable, final Map<String, Object> params) {
    @SuppressWarnings("unchecked")
    final EntityRepository<EntityInterface<?>> repository = mock(EntityRepository.class);
    when(repository.patch(any(), anyString(), any(), any(), any(), any(), any()))
        .thenReturn(
            new RestUtil.PatchResponse<>(
                Response.Status.OK, patchedTable, EventType.ENTITY_UPDATED));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<McpChangeEventUtil> changeEventMock = mockStatic(McpChangeEventUtil.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      return new PatchEntityTool().execute(authorizer, securityContext, params);
    }
  }

  private static Table sampleWideTable() {
    final List<Column> columns = new ArrayList<>();
    for (int i = 0; i < 20; i++) {
      columns.add(
          new Column()
              .withName("col_" + i)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(128));
    }
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("shop.db.sales.orders")
        .withVersion(0.2)
        .withUpdatedAt(1_700_000_000_000L)
        .withUpdatedBy("alice")
        .withColumns(columns)
        .withSchemaDefinition("CREATE TABLE orders (col_0 VARCHAR(128))")
        .withOwners(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.USER)
                    .withName("owner1")));
  }

  /** As REST's identity endpoints: an impersonated call never writes what grants privileges. */
  @ParameterizedTest
  @ValueSource(strings = {Entity.POLICY, Entity.ROLE, Entity.BOT})
  void execute_refusesAnImpersonatedWriteThatGrantsPrivileges(String entityType) {
    when(securityContext.impersonatedUser()).thenReturn("ingestion-bot");
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", entityType);
    params.put("fqn", "target");
    params.put("patch", "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"x\"}]");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
          .isInstanceOf(AuthorizationException.class)
          .hasMessageContaining("Impersonated requests cannot write a " + entityType);
    }
    verifyNoInteractions(authorizer);
  }

  @Test
  void execute_withLimits_throwsUnsupportedOperationException() {
    assertThatThrownBy(
            () -> new PatchEntityTool().execute(authorizer, null, securityContext, Map.of()))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
