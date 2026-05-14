package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
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
              eq(ChangeSource.MANUAL),
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
              eq(ChangeSource.MANUAL),
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
  void execute_nullPatch_throwsIllegalArgumentException() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("fqn", "db.schema.test_table");
    params.put("patch", null);

    assertThatThrownBy(() -> new PatchEntityTool().execute(authorizer, securityContext, params))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Patch cannot be null or empty");
  }

  @Test
  void execute_withLimits_throwsUnsupportedOperationException() {
    assertThatThrownBy(
            () -> new PatchEntityTool().execute(authorizer, null, securityContext, Map.of()))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
