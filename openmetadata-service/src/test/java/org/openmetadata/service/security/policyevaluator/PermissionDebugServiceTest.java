package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.PermissionDebugInfo.TeamPermission;
import org.openmetadata.service.security.policyevaluator.PermissionEvaluationDebugInfo.PolicyEvaluationStep;
import org.openmetadata.service.util.EntityUtil;

@SuppressWarnings("unchecked")
class PermissionDebugServiceTest {

  @Test
  void debugUserPermissionsByNameBuildsRoleTeamAndInheritedSummaries() {
    UserRepository userRepository = mock(UserRepository.class);
    TeamRepository teamRepository = mock(TeamRepository.class);
    RoleRepository roleRepository = mock(RoleRepository.class);
    PolicyRepository policyRepository = mock(PolicyRepository.class);

    stubFields(userRepository, teamRepository, roleRepository, policyRepository);

    Policy mixedPolicy =
        policy(
            "mixed-policy",
            rule(
                "allow-view",
                Rule.Effect.ALLOW,
                List.of(MetadataOperation.VIEW_BASIC),
                List.of(Entity.TABLE),
                null),
            rule(
                "deny-delete",
                Rule.Effect.DENY,
                List.of(MetadataOperation.DELETE),
                List.of(Entity.TABLE),
                null));
    Policy editPolicy =
        policy(
            "edit-policy",
            rule(
                "allow-edit",
                Rule.Effect.ALLOW,
                List.of(MetadataOperation.EDIT_ALL),
                List.of(Entity.TABLE),
                null));
    Policy createPolicy =
        policy(
            "create-policy",
            rule(
                "allow-create",
                Rule.Effect.ALLOW,
                List.of(MetadataOperation.CREATE),
                List.of(Entity.TABLE),
                null));
    Policy viewAllPolicy =
        policy(
            "view-all-policy",
            rule(
                "allow-view-all",
                Rule.Effect.ALLOW,
                List.of(MetadataOperation.VIEW_ALL),
                List.of(Entity.TABLE),
                null));

    Role analystRole = role("analyst", mixedPolicy);
    Role editorRole = role("editor", editPolicy);
    Role parentRole = role("parent-role", viewAllPolicy);

    Team parentTeam =
        team("parent-team", TeamType.DEPARTMENT, List.of(parentRole), List.of(), List.of());
    Team childTeam =
        team(
            "child-team",
            TeamType.GROUP,
            List.of(editorRole),
            List.of(createPolicy),
            List.of(parentTeam));

    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withRoles(List.of(analystRole.getEntityReference()))
            .withTeams(List.of(childTeam.getEntityReference()))
            .withIsAdmin(true)
            .withDomains(
                List.of(
                    new EntityReference()
                        .withType(Entity.DOMAIN)
                        .withId(UUID.randomUUID())
                        .withName("Engineering")
                        .withFullyQualifiedName("Engineering")));

    when(userRepository.getByName(isNull(), eq("alice"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(user);
    stubById(teamRepository, Map.of(childTeam.getId(), childTeam, parentTeam.getId(), parentTeam));
    stubById(
        roleRepository,
        Map.of(
            analystRole.getId(),
            analystRole,
            editorRole.getId(),
            editorRole,
            parentRole.getId(),
            parentRole));
    stubById(
        policyRepository,
        Map.of(
            mixedPolicy.getId(),
            mixedPolicy,
            editPolicy.getId(),
            editPolicy,
            createPolicy.getId(),
            createPolicy,
            viewAllPolicy.getId(),
            viewAllPolicy));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubRepositories(
          entityMock, userRepository, teamRepository, roleRepository, policyRepository);

      PermissionDebugInfo debugInfo =
          new PermissionDebugService().debugUserPermissionsByName("alice");

      assertEquals("alice", debugInfo.getUser().getName());
      assertEquals(1, debugInfo.getDirectRoles().size());
      assertEquals("analyst", debugInfo.getDirectRoles().get(0).getRole().getName());
      assertEquals("MIXED", debugInfo.getDirectRoles().get(0).getPolicies().get(0).getEffect());
      assertIterableEquals(
          List.of("allow", "deny"),
          debugInfo.getDirectRoles().get(0).getPolicies().get(0).getRules().stream()
              .map(PermissionDebugInfo.RuleInfo::getEffect)
              .toList());

      assertEquals(2, debugInfo.getTeamPermissions().size());
      TeamPermission directTeam = debugInfo.getTeamPermissions().get(0);
      TeamPermission inheritedTeam = debugInfo.getTeamPermissions().get(1);
      assertEquals("child-team", directTeam.getTeam().getName());
      assertEquals(0, directTeam.getHierarchyLevel());
      assertIterableEquals(
          List.of("child-team", "parent-team"),
          directTeam.getTeamHierarchy().stream().map(EntityReference::getName).toList());
      assertEquals("parent-team", inheritedTeam.getTeam().getName());
      assertEquals(1, inheritedTeam.getHierarchyLevel());

      assertEquals(2, debugInfo.getInheritedPermissions().size());
      assertEquals("ADMIN", debugInfo.getInheritedPermissions().get(0).getPermissionType());
      assertEquals("DOMAIN_ACCESS", debugInfo.getInheritedPermissions().get(1).getPermissionType());

      assertEquals(1, debugInfo.getSummary().getDirectRoles());
      assertEquals(3, debugInfo.getSummary().getTotalRoles());
      assertEquals(2, debugInfo.getSummary().getInheritedRoles());
      assertEquals(4, debugInfo.getSummary().getTotalPolicies());
      assertEquals(5, debugInfo.getSummary().getTotalRules());
      assertEquals(2, debugInfo.getSummary().getTeamCount());
      assertEquals(1, debugInfo.getSummary().getMaxHierarchyDepth());
      assertTrue(
          debugInfo
              .getSummary()
              .getEffectiveOperations()
              .contains(MetadataOperation.VIEW_BASIC.value()));
      assertTrue(
          debugInfo
              .getSummary()
              .getEffectiveOperations()
              .contains(MetadataOperation.EDIT_ALL.value()));
      assertTrue(
          debugInfo
              .getSummary()
              .getEffectiveOperations()
              .contains(MetadataOperation.VIEW_ALL.value()));
      assertTrue(
          debugInfo.getSummary().getDeniedOperations().contains(MetadataOperation.DELETE.value()));
    }
  }

  @Test
  void debugPermissionEvaluationPrefersDenyRulesOverAllows() {
    UserRepository userRepository = mock(UserRepository.class);
    TeamRepository teamRepository = mock(TeamRepository.class);
    RoleRepository roleRepository = mock(RoleRepository.class);
    PolicyRepository policyRepository = mock(PolicyRepository.class);
    EntityRepository<EntityInterface> resourceRepository = mock(EntityRepository.class);

    stubFields(
        userRepository, teamRepository, roleRepository, policyRepository, resourceRepository);
    when(resourceRepository.getEntityType()).thenReturn(Entity.TABLE);

    User user = new User().withId(UUID.randomUUID()).withName("alice");
    EntityReference ownerRef =
        new EntityReference().withType(Entity.USER).withId(user.getId()).withName(user.getName());
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("sales")
            .withFullyQualifiedName("service.db.sales")
            .withOwners(List.of(ownerRef));

    when(userRepository.getByName(isNull(), eq("alice"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(user);
    when(resourceRepository.get(isNull(), eq(table.getId()), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(table);

    SubjectContext.PolicyContext allowContext =
        new SubjectContext.PolicyContext(
            Entity.USER,
            "alice",
            "analyst",
            "allow-policy",
            List.of(
                compiledRule(
                    "allow-view-all",
                    Rule.Effect.ALLOW,
                    List.of(MetadataOperation.VIEW_ALL),
                    List.of(Entity.TABLE),
                    null)));
    SubjectContext.PolicyContext denyContext =
        new SubjectContext.PolicyContext(
            Entity.TEAM,
            "governance",
            null,
            "deny-policy",
            List.of(
                compiledRule(
                    "deny-view",
                    Rule.Effect.DENY,
                    List.of(MetadataOperation.VIEW_BASIC),
                    List.of(Entity.TABLE),
                    null)));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      stubRepositories(
          entityMock,
          userRepository,
          teamRepository,
          roleRepository,
          policyRepository,
          resourceRepository);
      subjectCacheMock
          .when(() -> SubjectCache.getPolicies("alice"))
          .thenReturn(List.of(allowContext, denyContext));

      PermissionEvaluationDebugInfo debugInfo =
          new PermissionDebugService()
              .debugPermissionEvaluation(
                  "alice", Entity.TABLE, table.getId().toString(), MetadataOperation.VIEW_BASIC);

      assertFalse(debugInfo.isAllowed());
      assertEquals("DENIED", debugInfo.getFinalDecision());
      assertEquals(2, debugInfo.getEvaluationSteps().size());
      assertEquals(2, debugInfo.getSummary().getTotalPoliciesEvaluated());
      assertEquals(2, debugInfo.getSummary().getTotalRulesEvaluated());
      assertEquals(2, debugInfo.getSummary().getMatchingRules());
      assertEquals(1, debugInfo.getSummary().getAllowRules());
      assertEquals(1, debugInfo.getSummary().getDenyRules());
      assertTrue(
          debugInfo
              .getSummary()
              .getReasonsForDecision()
              .contains("Denied by explicit DENY rule(s)"));

      PolicyEvaluationStep allowStep = debugInfo.getEvaluationSteps().get(0);
      PolicyEvaluationStep denyStep = debugInfo.getEvaluationSteps().get(1);
      assertEquals("DIRECT_ROLE", allowStep.getSource());
      assertEquals("analyst", allowStep.getSourceEntity().getName());
      assertEquals("allow", allowStep.getEffect());
      assertTrue(allowStep.isMatched());
      assertEquals("TEAM_POLICY", denyStep.getSource());
      assertEquals("governance", denyStep.getSourceEntity().getName());
      assertEquals("deny", denyStep.getEffect());
      assertTrue(denyStep.isMatched());
    }
  }

  @Test
  void debugPermissionEvaluationUsesFqnLookupAndEvaluatesOwnerConditions() {
    UserRepository userRepository = mock(UserRepository.class);
    TeamRepository teamRepository = mock(TeamRepository.class);
    RoleRepository roleRepository = mock(RoleRepository.class);
    PolicyRepository policyRepository = mock(PolicyRepository.class);
    EntityRepository<EntityInterface> resourceRepository = mock(EntityRepository.class);

    stubFields(
        userRepository, teamRepository, roleRepository, policyRepository, resourceRepository);
    when(resourceRepository.getEntityType()).thenReturn(Entity.TABLE);

    User user = new User().withId(UUID.randomUUID()).withName("alice");
    EntityReference ownerRef =
        new EntityReference().withType(Entity.USER).withId(user.getId()).withName(user.getName());
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("sales")
            .withFullyQualifiedName("service.db.schema.sales")
            .withOwners(List.of(ownerRef));

    when(userRepository.getByName(isNull(), eq("alice"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(user);
    when(resourceRepository.getByName(
            isNull(), eq(table.getFullyQualifiedName()), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(table);

    SubjectContext.PolicyContext policyContext =
        new SubjectContext.PolicyContext(
            Entity.USER,
            "alice",
            null,
            "owner-policy",
            List.of(
                compiledRule(
                    "owner-view",
                    Rule.Effect.ALLOW,
                    List.of(MetadataOperation.VIEW_ALL),
                    List.of(Entity.TABLE),
                    "isOwner()")));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      stubRepositories(
          entityMock,
          userRepository,
          teamRepository,
          roleRepository,
          policyRepository,
          resourceRepository);
      subjectCacheMock
          .when(() -> SubjectCache.getPolicies("alice"))
          .thenReturn(List.of(policyContext));

      PermissionEvaluationDebugInfo debugInfo =
          new PermissionDebugService()
              .debugPermissionEvaluation(
                  "alice",
                  Entity.TABLE,
                  table.getFullyQualifiedName(),
                  MetadataOperation.VIEW_BASIC);

      assertTrue(debugInfo.isAllowed());
      assertEquals("ALLOWED", debugInfo.getFinalDecision());
      assertEquals(1, debugInfo.getEvaluationSteps().size());
      assertEquals(1, debugInfo.getSummary().getAllowRules());
      assertEquals(1, debugInfo.getSummary().getMatchingRules());
      assertTrue(
          debugInfo
              .getSummary()
              .getReasonsForDecision()
              .contains("Allowed by matching ALLOW rule(s)"));

      PolicyEvaluationStep step = debugInfo.getEvaluationSteps().get(0);
      assertEquals("USER_POLICY", step.getSource());
      assertEquals("alice", step.getSourceEntity().getName());
      assertEquals("allow", step.getEffect());
      assertTrue(step.isMatched());
      assertEquals(1, step.getConditionEvaluations().size());
      assertTrue(step.getConditionEvaluations().get(0).isResult());
      assertEquals(
          "Condition evaluated to true",
          step.getConditionEvaluations().get(0).getEvaluationDetails());

      verify(resourceRepository)
          .getByName(
              isNull(), eq(table.getFullyQualifiedName()), eq(EntityUtil.Fields.EMPTY_FIELDS));
    }
  }

  @Test
  void debugPermissionEvaluationReportsConditionFailuresAsNonMatches() {
    UserRepository userRepository = mock(UserRepository.class);
    TeamRepository teamRepository = mock(TeamRepository.class);
    RoleRepository roleRepository = mock(RoleRepository.class);
    PolicyRepository policyRepository = mock(PolicyRepository.class);

    stubFields(userRepository, teamRepository, roleRepository, policyRepository);

    User user = new User().withId(UUID.randomUUID()).withName("alice");
    when(userRepository.getByName(isNull(), eq("alice"), eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenReturn(user);

    SubjectContext.PolicyContext policyContext =
        new SubjectContext.PolicyContext(
            Entity.USER,
            "alice",
            "analyst",
            "broken-policy",
            List.of(
                compiledRule(
                    "broken-condition",
                    Rule.Effect.ALLOW,
                    List.of(MetadataOperation.VIEW_BASIC),
                    List.of(Entity.TABLE),
                    "isOwner(")));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      stubRepositories(
          entityMock, userRepository, teamRepository, roleRepository, policyRepository);
      subjectCacheMock
          .when(() -> SubjectCache.getPolicies("alice"))
          .thenReturn(List.of(policyContext));

      PermissionEvaluationDebugInfo debugInfo =
          new PermissionDebugService()
              .debugPermissionEvaluation("alice", Entity.TABLE, null, MetadataOperation.VIEW_BASIC);

      assertFalse(debugInfo.isAllowed());
      assertEquals("DENIED", debugInfo.getFinalDecision());
      assertEquals(1, debugInfo.getSummary().getTotalPoliciesEvaluated());
      assertEquals(1, debugInfo.getSummary().getTotalRulesEvaluated());
      assertEquals(0, debugInfo.getSummary().getMatchingRules());
      assertEquals(0, debugInfo.getSummary().getAllowRules());
      assertTrue(
          debugInfo.getSummary().getReasonsForDecision().contains("No matching ALLOW rules found"));

      PolicyEvaluationStep step = debugInfo.getEvaluationSteps().get(0);
      assertFalse(step.isMatched());
      assertEquals(1, step.getConditionEvaluations().size());
      assertFalse(step.getConditionEvaluations().get(0).isResult());
      assertTrue(
          step.getConditionEvaluations()
              .get(0)
              .getEvaluationDetails()
              .startsWith("Condition evaluation failed:"));
      assertTrue(step.getMatchReason().contains("Condition evaluation failed"));
    }
  }

  private static void stubRepositories(
      MockedStatic<Entity> entityMock,
      UserRepository userRepository,
      TeamRepository teamRepository,
      RoleRepository roleRepository,
      PolicyRepository policyRepository) {
    entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
    entityMock.when(() -> Entity.getEntityRepository(Entity.TEAM)).thenReturn(teamRepository);
    entityMock.when(() -> Entity.getEntityRepository(Entity.ROLE)).thenReturn(roleRepository);
    entityMock.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(policyRepository);
  }

  private static void stubRepositories(
      MockedStatic<Entity> entityMock,
      UserRepository userRepository,
      TeamRepository teamRepository,
      RoleRepository roleRepository,
      PolicyRepository policyRepository,
      EntityRepository<EntityInterface> resourceRepository) {
    stubRepositories(entityMock, userRepository, teamRepository, roleRepository, policyRepository);
    entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(resourceRepository);
  }

  private static void stubFields(EntityRepository<?>... repositories) {
    for (EntityRepository<?> repository : repositories) {
      when(repository.getFields("*")).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    }
  }

  private static <T extends EntityInterface> void stubById(
      EntityRepository<T> repository, Map<UUID, T> entities) {
    when(repository.get(
            isNull(),
            org.mockito.ArgumentMatchers.any(UUID.class),
            eq(EntityUtil.Fields.EMPTY_FIELDS)))
        .thenAnswer(invocation -> entities.get(invocation.getArgument(1)));
  }

  private static Policy policy(String name, Rule... rules) {
    return new Policy().withId(UUID.randomUUID()).withName(name).withRules(List.of(rules));
  }

  private static Role role(String name, Policy... policies) {
    return new Role()
        .withId(UUID.randomUUID())
        .withName(name)
        .withPolicies(List.of(policies).stream().map(Policy::getEntityReference).toList());
  }

  private static Team team(
      String name,
      TeamType teamType,
      List<Role> defaultRoles,
      List<Policy> directPolicies,
      List<Team> parents) {
    return new Team()
        .withId(UUID.randomUUID())
        .withName(name)
        .withTeamType(teamType)
        .withDefaultRoles(defaultRoles.stream().map(Role::getEntityReference).toList())
        .withPolicies(directPolicies.stream().map(Policy::getEntityReference).toList())
        .withParents(parents.stream().map(Team::getEntityReference).toList());
  }

  private static Rule rule(
      String name,
      Rule.Effect effect,
      List<MetadataOperation> operations,
      List<String> resources,
      String condition) {
    return new Rule()
        .withName(name)
        .withEffect(effect)
        .withOperations(operations)
        .withResources(resources)
        .withCondition(condition);
  }

  private static CompiledRule compiledRule(
      String name,
      Rule.Effect effect,
      List<MetadataOperation> operations,
      List<String> resources,
      String condition) {
    return new CompiledRule(rule(name, effect, operations, resources, condition));
  }
}
