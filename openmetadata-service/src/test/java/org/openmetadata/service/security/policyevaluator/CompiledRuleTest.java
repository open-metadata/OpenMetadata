package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.ALL_RESOURCES;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

class CompiledRuleTest {
  private static final List<String> RESOURCE_LIST =
      listOf("all", "table", "topic", "database", "databaseService");

  @Test
  void testResourceMatchAll() {
    // Rule with resource set to ALL_RESOURCES matches all the resources
    CompiledRule rule =
        new CompiledRule(new Rule().withName("test").withResources(List.of(ALL_RESOURCES)));
    for (String resourceName : RESOURCE_LIST) {
      assertTrue(rule.matchResource(resourceName));
    }
  }

  @Test
  void testResourceMatch() {
    Set<String> ruleResources = Set.of("table", "topic", "database");

    CompiledRule rule =
        new CompiledRule(new Rule().withName("test").withResources(new ArrayList<>(ruleResources)));
    for (String resource : RESOURCE_LIST) {
      assertEquals(
          rule.matchResource(resource),
          ruleResources.contains(resource),
          "Resource name " + resource + " not matched");
    }
  }

  @Test
  void allOperationsDoesNotSubsumeImpersonate() {
    CompiledRule allRule =
        new CompiledRule(
            new Rule()
                .withName("allOps")
                .withResources(List.of(Entity.USER))
                .withOperations(List.of(MetadataOperation.ALL))
                .withEffect(Rule.Effect.ALLOW));

    assertFalse(
        allows(allRule, MetadataOperation.IMPERSONATE),
        "A god-mode ALL policy must not grant Impersonate by subsumption");
    assertTrue(
        allows(allRule, MetadataOperation.DELETE),
        "A god-mode ALL policy still grants ordinary operations");
  }

  @Test
  void editAllDoesNotSubsumeImpersonate() {
    CompiledRule editAllRule =
        new CompiledRule(
            new Rule()
                .withName("editAll")
                .withResources(List.of(Entity.USER))
                .withOperations(List.of(MetadataOperation.EDIT_ALL))
                .withEffect(Rule.Effect.ALLOW));

    assertFalse(allows(editAllRule, MetadataOperation.IMPERSONATE));
  }

  @Test
  void explicitImpersonateGrantIsHonored() {
    CompiledRule explicitRule =
        new CompiledRule(
            new Rule()
                .withName("impersonate")
                .withResources(List.of(Entity.USER))
                .withOperations(List.of(MetadataOperation.IMPERSONATE))
                .withEffect(Rule.Effect.ALLOW));

    assertTrue(
        allows(explicitRule, MetadataOperation.IMPERSONATE),
        "A rule naming Impersonate explicitly must grant it");
  }

  private boolean allows(CompiledRule rule, MetadataOperation operation) {
    OperationContext operationContext = new OperationContext(Entity.USER, operation);
    rule.evaluateAllowRule(operationContext, null, null, null);
    return !operationContext.getOperations(null).contains(operation);
  }

  @Test
  void denyAdminUserRuleBlocksImpersonatingAdminTargetOnly() {
    CompiledRule denyAdmin =
        new CompiledRule(
            new Rule()
                .withName("BotNonAdminImpersonationPolicy-DenyAdminUsers")
                .withResources(List.of(Entity.USER))
                .withOperations(List.of(MetadataOperation.IMPERSONATE))
                .withEffect(Rule.Effect.DENY)
                .withCondition("isAdminUser()"));

    User adminTarget =
        new User().withId(UUID.randomUUID()).withName("admin-target").withIsAdmin(true);
    User regularTarget = new User().withId(UUID.randomUUID()).withName("regular-target");

    assertThrows(
        AuthorizationException.class,
        () -> evaluateDeny(denyAdmin, adminTarget),
        "deny isAdminUser() must block impersonating an admin target");
    assertDoesNotThrow(
        () -> evaluateDeny(denyAdmin, regularTarget),
        "deny isAdminUser() must not fire for a regular target");
  }

  private void evaluateDeny(CompiledRule denyRule, User target) {
    OperationContext operationContext =
        new OperationContext(Entity.USER, MetadataOperation.IMPERSONATE);
    SubjectContext botSubject = new SubjectContext(new User().withName("bot"), null);
    ResourceContext<User> targetResource = new ResourceContext<>(Entity.USER, target, null);
    PolicyContext policyContext =
        new PolicyContext(
            Entity.ROLE, "botRole", "botRole", "BotNonAdminImpersonationPolicy", null);
    denyRule.evaluateDenyRule(operationContext, botSubject, targetResource, policyContext);
  }
}
