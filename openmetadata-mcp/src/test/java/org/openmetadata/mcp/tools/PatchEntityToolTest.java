package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.HashMap;
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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
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
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
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

  @Test
  void execute_passesImpersonationContextToRepository() {
    ImpersonationContext.setImpersonatedBy("McpApplicationBot");

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> mockRepo = mock(EntityRepository.class);
    EntityInterface mockEntity = mock(EntityInterface.class);
    RestUtil.PatchResponse<EntityInterface> patchResponse =
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
    EntityRepository<EntityInterface> mockRepo = mock(EntityRepository.class);
    EntityInterface mockEntity = mock(EntityInterface.class);
    RestUtil.PatchResponse<EntityInterface> patchResponse =
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
    EntityRepository<EntityInterface> mockRepo = mock(EntityRepository.class);
    EntityInterface mockEntity = mock(EntityInterface.class);
    RestUtil.PatchResponse<EntityInterface> patchResponse =
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
    EntityRepository<EntityInterface> mockRepo = mock(EntityRepository.class);
    EntityInterface mockEntity = mock(EntityInterface.class);
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

  @ParameterizedTest
  @ValueSource(
      strings = {
        "app",
        "document",
        "eventsubscription",
        "ingestionPipeline",
        "intakeForm",
        "notificationTemplate",
        "persona",
        "testCase",
        "testSuite",
        "task",
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
    EntityRepository<EntityInterface> mockRepo = mock(EntityRepository.class);
    EntityInterface mockEntity = mock(EntityInterface.class);
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

  @Test
  void execute_withLimits_throwsUnsupportedOperationException() {
    assertThatThrownBy(
            () -> new PatchEntityTool().execute(authorizer, null, securityContext, Map.of()))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
