package org.openmetadata.service.resources.ai;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

class AIGovernanceResourceTest {

  @Test
  @SuppressWarnings("unchecked")
  void getIntakeChecksAuthorizesViewBeforeLoadingEntity() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("alice");
      AIApplication application =
          new AIApplication()
              .withId(UUID.randomUUID())
              .withName("churnRisk")
              .withFullyQualifiedName("churnRisk");

      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(repository.getByName(any(), eq("churnRisk"), any())).thenReturn(application);

      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      resource.getIntakeChecksByFqn(null, securityContext, Entity.AI_APPLICATION, "churnRisk");

      InOrder inOrder = inOrder(authorizer, repository);
      inOrder
          .verify(authorizer)
          .authorize(
              eq(securityContext),
              any(OperationContext.class),
              any(ResourceContextInterface.class));
      inOrder.verify(repository).getByName(any(), eq("churnRisk"), any());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void submitForReviewAuthorizesPatchBeforePersisting() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      UUID id = UUID.randomUUID();
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("alice");
      AIApplication application =
          new AIApplication().withId(id).withName("churnRisk").withFullyQualifiedName("churnRisk");

      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(repository.get(any(), eq(id), any())).thenReturn(application);
      when(repository.patch(any(), eq(id), eq("alice"), any(JsonPatch.class)))
          .thenReturn(
              new RestUtil.PatchResponse<>(
                  Response.Status.OK, application, EventType.ENTITY_UPDATED));

      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      resource.submitForReview(null, securityContext, Entity.AI_APPLICATION, id.toString());

      InOrder inOrder = inOrder(authorizer, repository);
      inOrder.verify(repository).get(any(), eq(id), any());
      inOrder
          .verify(authorizer)
          .authorize(
              eq(securityContext),
              any(OperationContext.class),
              any(ResourceContextInterface.class));
      inOrder.verify(repository).patch(any(), eq(id), eq("alice"), any(JsonPatch.class));
    }
  }

  private SecurityContext securityContext(String user) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(user);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
