package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.AIGovernanceActivityResponse;
import org.openmetadata.schema.api.ai.AIGovernanceAssetSummary;
import org.openmetadata.schema.api.ai.AIGovernanceDashboardResponse;
import org.openmetadata.schema.api.ai.AIGovernancePolicyViolation;
import org.openmetadata.schema.api.ai.AIGovernancePolicyViolationsResponse;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

class AIGovernanceResourceTest {

  static {
    // Entity.registerEntity populates this at server startup; unit tests have no registry.
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("aiapplication", Entity.AI_APPLICATION);
  }

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

  @Test
  @SuppressWarnings("unchecked")
  void approvePreservesExistingApprovalMilestones() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      UUID id = UUID.randomUUID();
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
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
      when(repository.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(repository.get(any(), eq(id), any())).thenReturn(application);
      when(repository.patch(any(), eq(id), eq("bob"), any(JsonPatch.class)))
          .thenReturn(
              new RestUtil.PatchResponse<>(
                  Response.Status.OK, application, EventType.ENTITY_UPDATED));

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

  @Test
  @SuppressWarnings("unchecked")
  void getDashboardNarrowsToCallerViewableAssets() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      UUID visibleId = UUID.randomUUID();
      UUID hiddenId = UUID.randomUUID();
      AIApplication visible = application(visibleId, "campaign_copywriter");
      visible.setGovernanceMetadata(pendingApproval(123L));
      AIApplication hidden = application(hiddenId, "fraud_scorer");
      hidden.setGovernanceMetadata(pendingApproval(456L));
      EntityRepository<AIApplication> appRepo = mock(EntityRepository.class);
      EntityRepository emptyRepo = mock(EntityRepository.class);
      EntityRepository frameworkRepo = mock(EntityRepository.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("mallory");

      entityMock.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(appRepo);
      entityMock.when(() -> Entity.getEntityRepository(Entity.MCP_SERVER)).thenReturn(emptyRepo);
      entityMock.when(() -> Entity.getEntityRepository(Entity.LLM_MODEL)).thenReturn(emptyRepo);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_GOVERNANCE_FRAMEWORK))
          .thenReturn(frameworkRepo);
      when(appRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(emptyRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(frameworkRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(appRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(visible, hidden), null, null, 2));
      when(emptyRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(), null, null, 0));
      when(frameworkRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(), null, null, 0));
      when(appRepo.get(any(), any(), any(), any())).thenReturn(List.of(visible, hidden));
      SubjectContext subjectContext = nonAdminSubject();
      authMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(subjectContext);
      denyAsset(authorizer, securityContext, hiddenId);

      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      Response response = resource.getDashboard(null, securityContext);

      AIGovernanceDashboardResponse dashboard =
          (AIGovernanceDashboardResponse) response.getEntity();
      assertEquals(1, dashboard.getEstateStats().getTotal());
      assertEquals(
          List.of("campaign_copywriter"),
          dashboard.getTopApprovals().stream().map(AIGovernanceAssetSummary::getName).toList());
      assertEquals(
          List.of(),
          dashboard.getTopShadow().stream().map(AIGovernanceAssetSummary::getName).toList());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void getActivityNarrowsToCallerViewableAssets() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      UUID visibleId = UUID.randomUUID();
      UUID hiddenId = UUID.randomUUID();
      AIApplication visible = application(visibleId, "campaign_copywriter");
      visible.setGovernanceMetadata(
          new GovernanceMetadata().withRegisteredBy("admin").withRegisteredAt(123L));
      AIApplication hidden = application(hiddenId, "fraud_scorer");
      hidden.setGovernanceMetadata(
          new GovernanceMetadata().withRegisteredBy("admin").withRegisteredAt(456L));
      EntityRepository<AIApplication> appRepo = mock(EntityRepository.class);
      EntityRepository emptyRepo = mock(EntityRepository.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("mallory");

      entityMock.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(appRepo);
      entityMock.when(() -> Entity.getEntityRepository(Entity.MCP_SERVER)).thenReturn(emptyRepo);
      entityMock.when(() -> Entity.getEntityRepository(Entity.LLM_MODEL)).thenReturn(emptyRepo);
      when(appRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(emptyRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(appRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(visible, hidden), null, null, 2));
      when(emptyRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(), null, null, 0));
      when(appRepo.get(any(), any(), any(), any())).thenReturn(List.of(visible, hidden));
      SubjectContext subjectContext = nonAdminSubject();
      authMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(subjectContext);
      denyAsset(authorizer, securityContext, hiddenId);

      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      Response response = resource.getActivity(null, securityContext, null, null, 50);

      AIGovernanceActivityResponse activity = (AIGovernanceActivityResponse) response.getEntity();
      assertEquals(1, activity.getEvents().size());
      assertEquals("campaign_copywriter", activity.getEvents().get(0).getEntityName());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void getPolicyViolationsNarrowsToCallerViewableAssets() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      UUID visibleId = UUID.randomUUID();
      UUID hiddenId = UUID.randomUUID();
      AIApplication visible = application(visibleId, "campaign_copywriter");
      visible.setUpdatedAt(789L);
      AIApplication hidden = application(hiddenId, "fraud_scorer");
      hidden.setUpdatedAt(789L);
      EntityRepository<AIApplication> appRepo = mock(EntityRepository.class);
      EntityRepository emptyRepo = mock(EntityRepository.class);
      AIGovernancePolicyRepository policyRepo = mock(AIGovernancePolicyRepository.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("mallory");
      UUID policyId = UUID.randomUUID();

      entityMock.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(appRepo);
      entityMock.when(() -> Entity.getEntityRepository(Entity.MCP_SERVER)).thenReturn(emptyRepo);
      entityMock.when(() -> Entity.getEntityRepository(Entity.LLM_MODEL)).thenReturn(emptyRepo);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_GOVERNANCE_POLICY))
          .thenReturn(policyRepo);
      when(appRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(emptyRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(policyRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      when(appRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(visible, hidden), null, null, 2));
      when(emptyRepo.listAfter(any(), any(), any(), anyInt(), any()))
          .thenReturn(new ResultList<>(List.of(), null, null, 0));
      when(policyRepo.get(any(), eq(policyId), any()))
          .thenReturn(new AIGovernancePolicy().withName("Audit log retention"));
      when(appRepo.get(any(), any(), any(), any())).thenReturn(List.of(visible, hidden));
      SubjectContext subjectContext = nonAdminSubject();
      authMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(subjectContext);
      denyAsset(authorizer, securityContext, hiddenId);

      AIGovernanceResource resource = new AIGovernanceResource(authorizer, mock(Limits.class));
      Response response = resource.getPolicyViolations(null, securityContext, policyId, null, 50);

      AIGovernancePolicyViolationsResponse violations =
          (AIGovernancePolicyViolationsResponse) response.getEntity();
      assertEquals(1, violations.getData().size());
      AIGovernancePolicyViolation row = violations.getData().get(0);
      assertEquals("campaign_copywriter", row.getEntityName());
      assertEquals("Audit log retention", row.getRuleName());
    }
  }

  private GovernanceMetadata pendingApproval(long registeredAt) {
    return new GovernanceMetadata()
        .withRegistrationStatus(GovernanceMetadata.RegistrationStatus.PENDING_APPROVAL)
        .withRegisteredBy("admin")
        .withRegisteredAt(registeredAt);
  }

  private AIApplication application(UUID id, String name) {
    return new AIApplication().withId(id).withName(name).withFullyQualifiedName(name);
  }

  private void denyAsset(Authorizer authorizer, SecurityContext securityContext, UUID hiddenId) {
    doThrow(new AuthorizationException("operation ViewBasic denied by DomainAccessDenyRule"))
        .when(authorizer)
        .authorize(
            eq(securityContext),
            any(OperationContext.class),
            argThat(context -> hasEntityId(context, hiddenId)));
  }

  private boolean hasEntityId(ResourceContextInterface context, UUID id) {
    boolean matches = false;
    try {
      EntityInterface<?> entity = context.getEntity();
      matches = entity != null && id.equals(entity.getId());
    } catch (RuntimeException e) {
      matches = false;
    }
    return matches;
  }

  private SubjectContext nonAdminSubject() {
    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(false);
    return subjectContext;
  }

  private SecurityContext securityContext(String user) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(user);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
