package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityFieldPolicyFixture;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.read.EntityReadFixture;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityPatchFixture;
import org.openmetadata.service.entity.write.EntityPatchService;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.RestUtil;

class AIGovernanceResourceTest {

  @Test
  @SuppressWarnings("unchecked")
  void getIntakeChecksAuthorizesViewBeforeLoadingEntity() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      EntityPolicy<AIApplication> repository = mock(EntityPolicy.class);
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
      when(repository.fieldPolicy())
          .thenReturn(EntityFieldPolicyFixture.forEntity(AIApplication.class));
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
      List<String> steps = new ArrayList<>();
      EntityPolicy<AIApplication> repository = mock(EntityPolicy.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("alice");
      AIApplication application =
          new AIApplication().withId(id).withName("churnRisk").withFullyQualifiedName("churnRisk");
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.fieldPolicy())
          .thenReturn(EntityFieldPolicyFixture.forEntity(AIApplication.class));
      when(repository.reads())
          .thenReturn(
              EntityReadFixture.byId(
                  (readId, readQuery) -> {
                    assertEquals(id, readId);
                    steps.add("read");
                    return application;
                  }));
      doAnswer(
              invocation -> {
                steps.add("authorize");
                return null;
              })
          .when(authorizer)
          .authorize(
              eq(securityContext),
              any(OperationContext.class),
              any(ResourceContextInterface.class));
      when(repository.patches())
          .thenReturn(
              new EntityPatchFixture<AIApplication>(
                  request -> {
                    assertEquals(new EntityPatchService.Target.Id(id), request.target());
                    assertEquals(new EntityCommandActor("alice", null), request.actor());
                    steps.add("write");
                    return new RestUtil.PatchResponse<>(
                        Response.Status.OK, application, EventType.ENTITY_UPDATED);
                  }));
      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      resource.submitForReview(null, securityContext, Entity.AI_APPLICATION, id.toString());
      assertEquals(List.of("read", "authorize", "write"), steps);
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void approvePreservesExistingApprovalMilestones() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      UUID id = UUID.randomUUID();
      EntityPolicy<AIApplication> repository = mock(EntityPolicy.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("bob");
      AIApplication application =
          new AIApplication()
              .withId(id)
              .withName("churnRisk")
              .withFullyQualifiedName("churnRisk")
              .withGovernanceMetadata(
                  new GovernanceMetadata().withApprovedBy("alice").withApprovedAt(123L));
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.fieldPolicy())
          .thenReturn(EntityFieldPolicyFixture.forEntity(AIApplication.class));
      when(repository.reads())
          .thenReturn(
              EntityReadFixture.byId(
                  (readId, readQuery) -> {
                    assertEquals(id, readId);
                    return application;
                  }));
      when(repository.patches())
          .thenReturn(
              new EntityPatchFixture<AIApplication>(
                  request -> {
                    assertEquals(new EntityPatchService.Target.Id(id), request.target());
                    assertEquals(new EntityCommandActor("bob", null), request.actor());
                    return new RestUtil.PatchResponse<>(
                        Response.Status.OK, application, EventType.ENTITY_UPDATED);
                  }));
      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      resource.approve(null, securityContext, Entity.AI_APPLICATION, id.toString(), null);
      assertEquals(EntityStatus.APPROVED, application.getEntityStatus());
      assertEquals(
          GovernanceMetadata.RegistrationStatus.APPROVED,
          application.getGovernanceMetadata().getRegistrationStatus());
      assertEquals("alice", application.getGovernanceMetadata().getApprovedBy());
      assertEquals(123L, application.getGovernanceMetadata().getApprovedAt());
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
