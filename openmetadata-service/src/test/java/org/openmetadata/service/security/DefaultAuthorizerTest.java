package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class DefaultAuthorizerTest {
  private final DefaultAuthorizer authorizer = new DefaultAuthorizer();

  @AfterEach
  void clearImpersonationState() {
    ImpersonationContext.clear();
    CatalogSecurityContext.clearThreadLocalImpersonatedUser();
  }

  @Test
  void initAndAdminPathsShortCircuitPermissionEvaluation() {
    SecurityContext securityContext = securityContext("admin");
    SubjectContext adminContext = subjectContext("admin", true, false, null);
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    when(resourceContext.getResource()).thenReturn(Entity.TABLE);
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL);
    List<ResourcePermission> permissions = List.of(resourcePermission(Entity.TABLE));
    ResourcePermission resourcePermission = resourcePermission(Entity.TABLE);
    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(adminContext);
      mockedPolicyEvaluator
          .when(() -> PolicyEvaluator.getResourcePermissions(Permission.Access.ALLOW))
          .thenReturn(permissions);
      mockedPolicyEvaluator
          .when(() -> PolicyEvaluator.getResourcePermission(Entity.TABLE, Permission.Access.ALLOW))
          .thenReturn(resourcePermission);

      assertDoesNotThrow(() -> authorizer.init(config));
      assertSame(permissions, authorizer.listPermissions(securityContext, null));
      assertSame(resourcePermission, authorizer.getPermission(securityContext, null, Entity.TABLE));
      assertSame(
          resourcePermission, authorizer.getPermission(securityContext, null, resourceContext));
      assertDoesNotThrow(
          () -> authorizer.authorize(securityContext, operationContext, resourceContext));
      assertDoesNotThrow(
          () ->
              authorizer.authorizeRequests(
                  securityContext,
                  List.of(new AuthRequest(operationContext, resourceContext)),
                  AuthorizationLogic.ALL));
      assertDoesNotThrow(() -> authorizer.authorizeAdmin(securityContext));
      assertDoesNotThrow(() -> authorizer.authorizeAdminOrBot(securityContext));
      assertTrue(authorizer.authorizePII(securityContext, null));
      assertTrue(authorizer.shouldMaskPasswords(securityContext));
    }
  }

  @Test
  void nonAdminCannotReadAnotherUsersPermissions() {
    SecurityContext securityContext = securityContext("analyst");
    SubjectContext analystContext = subjectContext("analyst", false, false, null);
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);

    try (MockedStatic<SubjectContext> mockedSubjectContext = mockStatic(SubjectContext.class)) {
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("analyst"))
          .thenReturn(analystContext);

      AuthorizationException listException =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.listPermissions(securityContext, "another-user"));
      AuthorizationException typeException =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.getPermission(securityContext, "another-user", Entity.TABLE));
      AuthorizationException resourceException =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.getPermission(securityContext, "another-user", resourceContext));

      assertTrue(listException.getMessage().contains("is not admin"));
      assertTrue(typeException.getMessage().contains("is not admin"));
      assertTrue(resourceException.getMessage().contains("is not admin"));
    }
  }

  @Test
  void adminCanReadAnotherUsersPermissions() {
    SecurityContext securityContext = securityContext("admin");
    SubjectContext adminContext = subjectContext("admin", true, false, null);
    SubjectContext analystContext = subjectContext("analyst", false, false, null);
    List<ResourcePermission> permissions = List.of(resourcePermission(Entity.TABLE));
    ResourcePermission tablePermission = resourcePermission(Entity.TABLE);
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);

    try (MockedStatic<SubjectContext> mockedSubjectContext = mockStatic(SubjectContext.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("admin"))
          .thenReturn(adminContext);
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("analyst"))
          .thenReturn(analystContext);
      mockedPolicyEvaluator
          .when(() -> PolicyEvaluator.listPermission(analystContext))
          .thenReturn(permissions);
      mockedPolicyEvaluator
          .when(() -> PolicyEvaluator.getPermission(analystContext, Entity.TABLE))
          .thenReturn(tablePermission);
      mockedPolicyEvaluator
          .when(() -> PolicyEvaluator.getPermission(analystContext, resourceContext))
          .thenReturn(tablePermission);

      assertSame(permissions, authorizer.listPermissions(securityContext, "analyst"));
      assertSame(
          tablePermission, authorizer.getPermission(securityContext, "analyst", Entity.TABLE));
      assertSame(
          tablePermission, authorizer.getPermission(securityContext, "analyst", resourceContext));
    }
  }

  @Test
  void authorizeSkipsPolicyEvaluationForReviewers() {
    SecurityContext securityContext = securityContext("reviewer");
    SubjectContext reviewerContext = subjectContext("reviewer", false, false, null);
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getReviewers()).thenReturn(List.of(entityReference(Entity.USER, "reviewer")));
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    when(resourceContext.getEntity()).thenReturn(entity);
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.EDIT_ALL);

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(reviewerContext);

      assertDoesNotThrow(
          () -> authorizer.authorize(securityContext, operationContext, resourceContext));

      mockedPolicyEvaluator.verifyNoInteractions();
    }
  }

  @Test
  void authorizeDelegatesPolicyEvaluationForRegularUsers() {
    SecurityContext securityContext = securityContext("analyst");
    SubjectContext analystContext = subjectContext("analyst", false, false, null);
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getReviewers()).thenReturn(null);
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    when(resourceContext.getEntity()).thenReturn(entity);
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL);

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(analystContext);

      authorizer.authorize(securityContext, operationContext, resourceContext);

      mockedPolicyEvaluator.verify(
          () -> PolicyEvaluator.hasPermission(analystContext, resourceContext, operationContext));
    }
  }

  @Test
  void authorizeRejectsMissingOrMisconfiguredImpersonationBots() {
    SecurityContext securityContext = securityContext("target-user");
    SubjectContext impersonatedContext =
        new SubjectContext(new User().withName("target-user"), "missing-bot");
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    when(resourceContext.getEntity()).thenReturn(null);
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL);

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(impersonatedContext);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER,
                      "missing-bot",
                      "id,name,isBot,allowImpersonation,roles",
                      org.openmetadata.schema.type.Include.ALL))
          .thenThrow(new IllegalArgumentException("missing"));

      AuthorizationException missingBot =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.authorize(securityContext, operationContext, resourceContext));
      assertTrue(missingBot.getMessage().contains("Bot user not found"));
    }

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(impersonatedContext);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER,
                      "missing-bot",
                      "id,name,isBot,allowImpersonation,roles",
                      org.openmetadata.schema.type.Include.ALL))
          .thenReturn(null);

      AuthorizationException nullBot =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.authorize(securityContext, operationContext, resourceContext));
      assertTrue(nullBot.getMessage().contains("Bot user not found"));
    }

    SubjectContext flaggedContext =
        new SubjectContext(new User().withName("target-user"), "bot-user");
    User bot = new User().withName("bot-user").withIsBot(true);
    bot.setAllowImpersonation(false);

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(flaggedContext);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER,
                      "bot-user",
                      "id,name,isBot,allowImpersonation,roles",
                      org.openmetadata.schema.type.Include.ALL))
          .thenReturn(bot);

      AuthorizationException disabledImpersonation =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.authorize(securityContext, operationContext, resourceContext));
      assertTrue(disabledImpersonation.getMessage().contains("impersonation enabled"));
    }
  }

  @Test
  void authorizeRejectsBotsWithoutImpersonatePermission() {
    SecurityContext securityContext = securityContext("target-user");
    SubjectContext impersonatedContext =
        new SubjectContext(new User().withName("target-user"), "bot-user");
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    when(resourceContext.getEntity()).thenReturn(null);
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL);

    User bot = new User().withName("bot-user").withIsBot(true);
    bot.setAllowImpersonation(true);
    EntityReference roleRef = entityReference(Entity.ROLE, "bot-role");
    bot.setRoles(List.of(roleRef));
    Role role =
        new Role()
            .withName("bot-role")
            .withPolicies(List.of(entityReference(Entity.POLICY, "view-only")));
    Rule rule = new Rule().withName("viewOnly").withOperations(List.of(MetadataOperation.VIEW_ALL));
    Policy policy = new Policy().withName("view-only").withRules(List.of(rule));

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(impersonatedContext);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER,
                      "bot-user",
                      "id,name,isBot,allowImpersonation,roles",
                      org.openmetadata.schema.type.Include.ALL))
          .thenReturn(bot);
      mockedEntity
          .when(
              () ->
                  Entity.getEntities(
                      List.of(roleRef), "policies", org.openmetadata.schema.type.Include.ALL))
          .thenReturn(List.of(role));
      mockedEntity
          .when(
              () ->
                  Entity.getEntities(
                      List.of(role.getPolicies().get(0)),
                      "rules",
                      org.openmetadata.schema.type.Include.ALL))
          .thenReturn(List.of(policy));

      AuthorizationException exception =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.authorize(securityContext, operationContext, resourceContext));
      assertTrue(exception.getMessage().contains("Impersonate permission"));
    }
  }

  @Test
  void authorizeAllowsValidImpersonationBots() {
    SecurityContext securityContext = securityContext("target-user");
    SubjectContext impersonatedContext =
        new SubjectContext(new User().withName("target-user"), "bot-user");
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    when(resourceContext.getEntity()).thenReturn(null);
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL);

    User bot = new User().withName("bot-user").withIsBot(true);
    bot.setAllowImpersonation(true);
    EntityReference roleRef = entityReference(Entity.ROLE, "bot-role");
    EntityReference policyRef = entityReference(Entity.POLICY, "impersonate-policy");
    bot.setRoles(List.of(roleRef));
    Role role = new Role().withName("bot-role").withPolicies(List.of(policyRef));
    Rule rule =
        new Rule().withName("impersonate").withOperations(List.of(MetadataOperation.IMPERSONATE));
    Policy policy = new Policy().withName("impersonate-policy").withRules(List.of(rule));

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(impersonatedContext);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER,
                      "bot-user",
                      "id,name,isBot,allowImpersonation,roles",
                      org.openmetadata.schema.type.Include.ALL))
          .thenReturn(bot);
      mockedEntity
          .when(
              () ->
                  Entity.getEntities(
                      List.of(roleRef), "policies", org.openmetadata.schema.type.Include.ALL))
          .thenReturn(List.of(role));
      mockedEntity
          .when(
              () ->
                  Entity.getEntities(
                      List.of(policyRef), "rules", org.openmetadata.schema.type.Include.ALL))
          .thenReturn(List.of(policy));

      assertDoesNotThrow(
          () -> authorizer.authorize(securityContext, operationContext, resourceContext));

      mockedPolicyEvaluator.verify(
          () ->
              PolicyEvaluator.hasPermission(
                  impersonatedContext, resourceContext, operationContext));
    }
  }

  @Test
  void authorizeRequestsSupportsAnyAndAllModes() {
    SecurityContext securityContext = securityContext("analyst");
    SubjectContext analystContext = subjectContext("analyst", false, false, null);
    AuthRequest firstRequest =
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.VIEW_ALL),
            mock(ResourceContextInterface.class));
    AuthRequest secondRequest =
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.EDIT_ALL),
            mock(ResourceContextInterface.class));

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(analystContext);
      mockedPolicyEvaluator
          .when(
              () ->
                  PolicyEvaluator.hasPermission(
                      analystContext,
                      firstRequest.resourceContext(),
                      firstRequest.operationContext()))
          .thenThrow(new AuthorizationException("denied"));

      assertDoesNotThrow(
          () ->
              authorizer.authorizeRequests(
                  securityContext, List.of(firstRequest, secondRequest), AuthorizationLogic.ANY));

      mockedPolicyEvaluator.verify(
          () ->
              PolicyEvaluator.hasPermission(
                  analystContext,
                  secondRequest.resourceContext(),
                  secondRequest.operationContext()));
    }

    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(analystContext);
      mockedPolicyEvaluator
          .when(
              () ->
                  PolicyEvaluator.hasPermission(
                      eq(analystContext),
                      any(ResourceContextInterface.class),
                      any(OperationContext.class)))
          .thenThrow(new AuthorizationException("denied"));

      AuthorizationException exception =
          assertThrows(
              AuthorizationException.class,
              () ->
                  authorizer.authorizeRequests(
                      securityContext,
                      List.of(firstRequest, secondRequest),
                      AuthorizationLogic.ANY));
      assertEquals("User does not have ANY of the required permissions.", exception.getMessage());
    }

    AtomicInteger evaluations = new AtomicInteger();
    try (MockedStatic<DefaultAuthorizer> mockedAuthorizer = mockStatic(DefaultAuthorizer.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedAuthorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(analystContext);
      mockedPolicyEvaluator
          .when(
              () ->
                  PolicyEvaluator.hasPermission(
                      eq(analystContext),
                      any(ResourceContextInterface.class),
                      any(OperationContext.class)))
          .thenAnswer(
              invocation -> {
                evaluations.incrementAndGet();
                return null;
              });

      assertDoesNotThrow(
          () ->
              authorizer.authorizeRequests(
                  securityContext, List.of(firstRequest, secondRequest), AuthorizationLogic.ALL));
      assertEquals(2, evaluations.get());
    }
  }

  @Test
  void adminAndBotGuardsBehaveAsExpected() {
    SecurityContext userSecurityContext = securityContext("analyst");
    SecurityContext botSecurityContext = securityContext("ingestion-bot");
    SubjectContext userContext = subjectContext("analyst", false, false, null);
    SubjectContext botContext = subjectContext("ingestion-bot", false, true, null);
    User ownerUser = new User().withName("owner");
    SubjectContext ownerContext = new SubjectContext(ownerUser, null);
    List<EntityReference> owners = List.of(entityReference(Entity.USER, "owner"));

    try (MockedStatic<SubjectContext> mockedSubjectContext = mockStatic(SubjectContext.class)) {
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("admin"))
          .thenReturn(subjectContext("admin", true, false, null));
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("analyst"))
          .thenReturn(userContext);
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("ingestion-bot"))
          .thenReturn(botContext);
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("owner"))
          .thenReturn(ownerContext);

      assertThrows(
          AuthorizationException.class, () -> authorizer.authorizeAdmin(userSecurityContext));
      assertDoesNotThrow(() -> authorizer.authorizeAdmin("admin"));
      assertThrows(AuthorizationException.class, () -> authorizer.authorizeAdmin("analyst"));
      assertThrows(
          AuthorizationException.class, () -> authorizer.authorizeAdminOrBot(userSecurityContext));
      assertDoesNotThrow(() -> authorizer.authorizeAdminOrBot(botSecurityContext));
      assertTrue(authorizer.shouldMaskPasswords(userSecurityContext));
      assertFalse(authorizer.shouldMaskPasswords(botSecurityContext));
      assertFalse(authorizer.authorizePII(userSecurityContext, owners));
      assertTrue(authorizer.authorizePII(botSecurityContext, owners));
      assertTrue(authorizer.authorizePII(securityContext("owner"), owners));
    }
  }

  @Test
  void authorizeImpersonationRequiresBotsAndUsesImpersonateOperation() {
    SecurityContext userSecurityContext = securityContext("analyst");
    SecurityContext botSecurityContext = securityContext("ingestion-bot");
    SubjectContext userContext = subjectContext("analyst", false, false, null);
    SubjectContext botContext = subjectContext("ingestion-bot", false, true, null);
    EntityRepository<?> repository = mock(EntityRepository.class);
    AtomicReference<ResourceContextInterface> capturedResourceContext = new AtomicReference<>();
    AtomicReference<OperationContext> capturedOperationContext = new AtomicReference<>();

    try (MockedStatic<SubjectContext> mockedSubjectContext = mockStatic(SubjectContext.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<PolicyEvaluator> mockedPolicyEvaluator = mockStatic(PolicyEvaluator.class)) {
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("analyst"))
          .thenReturn(userContext);
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("ingestion-bot"))
          .thenReturn(botContext);
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      mockedPolicyEvaluator
          .when(
              () ->
                  PolicyEvaluator.hasPermission(
                      any(SubjectContext.class),
                      any(ResourceContextInterface.class),
                      any(OperationContext.class)))
          .thenAnswer(
              invocation -> {
                capturedResourceContext.set(invocation.getArgument(1));
                capturedOperationContext.set(invocation.getArgument(2));
                return null;
              });

      AuthorizationException exception =
          assertThrows(
              AuthorizationException.class,
              () -> authorizer.authorizeImpersonation(userSecurityContext, "owner"));
      assertEquals("Only bot users can impersonate", exception.getMessage());

      assertDoesNotThrow(() -> authorizer.authorizeImpersonation(botSecurityContext, "owner"));
      assertNotNull(capturedResourceContext.get());
      assertNotNull(capturedOperationContext.get());
      assertEquals(Entity.USER, capturedResourceContext.get().getResource());
      assertEquals(
          List.of(MetadataOperation.IMPERSONATE),
          capturedOperationContext.get().getOperations(capturedResourceContext.get()));
    }
  }

  @Test
  void getSubjectContextRejectsMissingPrincipal() {
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(null);

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () -> DefaultAuthorizer.getSubjectContext(securityContext));

    assertEquals("No principal in security context", exception.getMessage());
  }

  @Test
  void getSubjectContextUsesCatalogAndThreadLocalImpersonationHints() {
    SubjectContext subjectContext = subjectContext("alice", false, false, null);
    SubjectContext threadLocalContext = subjectContext("bob", false, false, null);
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(
            principal("alice"),
            "https",
            CatalogSecurityContext.OPENID_AUTH,
            Set.of(),
            false,
            "bot-user");
    SecurityContext wrappedSecurityContext = securityContext("bob");
    ImpersonationContext.setImpersonatedBy("job-bot");

    try (MockedStatic<SubjectContext> mockedSubjectContext = mockStatic(SubjectContext.class)) {
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("alice", "bot-user"))
          .thenReturn(subjectContext);
      mockedSubjectContext
          .when(() -> SubjectContext.getSubjectContext("bob", "job-bot"))
          .thenReturn(threadLocalContext);

      assertSame(subjectContext, DefaultAuthorizer.getSubjectContext(catalogSecurityContext));
      assertSame(threadLocalContext, DefaultAuthorizer.getSubjectContext(wrappedSecurityContext));
    }
  }

  private static SubjectContext subjectContext(
      String userName, boolean isAdmin, boolean isBot, List<EntityReference> teams) {
    return new SubjectContext(
        new User().withName(userName).withIsAdmin(isAdmin).withIsBot(isBot).withTeams(teams), null);
  }

  private static SecurityContext securityContext(String userName) {
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal(userName));
    return securityContext;
  }

  private static Principal principal(String userName) {
    return () -> userName;
  }

  private static EntityReference entityReference(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private static ResourcePermission resourcePermission(String resource) {
    return new ResourcePermission()
        .withResource(resource)
        .withPermissions(List.of(new Permission().withOperation(MetadataOperation.VIEW_ALL)));
  }
}
