package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.ALL_RESOURCES;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

class CompiledRuleTest {
  private static final List<String> RESOURCE_LIST =
      listOf("all", "table", "topic", "database", "databaseService");
  private static final String RDF = "rdf";
  private static final MetadataOperation SPARQL = MetadataOperation.EXECUTE_SPARQL_QUERY;
  private static final MetadataOperation IMPERSONATE = MetadataOperation.IMPERSONATE;

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
  void wildcardAllowDoesNotGrantExecuteSparqlQuery() {
    assertFalse(
        allowsOnRdf(rule(ALL_RESOURCES, MetadataOperation.ALL, Rule.Effect.ALLOW), SPARQL),
        "An All/All allow must not open the unfiltered RDF query endpoint");
    assertFalse(allowsOnRdf(rule(RDF, MetadataOperation.ALL, Rule.Effect.ALLOW), SPARQL));
    assertFalse(allowsOnRdf(rule(RDF, MetadataOperation.VIEW_ALL, Rule.Effect.ALLOW), SPARQL));
  }

  @Test
  void namedAllowGrantsExecuteSparqlQueryOnAnyMatchingResource() {
    assertTrue(allowsOnRdf(rule(RDF, SPARQL, Rule.Effect.ALLOW), SPARQL));
    assertTrue(
        allowsOnRdf(rule(ALL_RESOURCES, SPARQL, Rule.Effect.ALLOW), SPARQL),
        "Naming the operation is an explicit grant even on resource All");
  }

  @Test
  void wildcardDenyStillDeniesExecuteSparqlQuery() {
    assertTrue(denies(rule(ALL_RESOURCES, MetadataOperation.ALL, Rule.Effect.DENY), SPARQL));
    assertTrue(denies(rule(RDF, MetadataOperation.ALL, Rule.Effect.DENY), SPARQL));
    assertTrue(denies(rule(RDF, SPARQL, Rule.Effect.DENY), SPARQL));
  }

  @Test
  void impersonateMatchingIsUnchangedForDenies() {
    assertFalse(
        denies(rule(ALL_RESOURCES, MetadataOperation.ALL, Rule.Effect.DENY), IMPERSONATE),
        "Wildcard denies keep not applying to Impersonate");
    assertTrue(denies(rule(Entity.USER, IMPERSONATE, Rule.Effect.DENY), IMPERSONATE));
  }

  @Test
  void permissionListingReflectsExplicitSparqlGrant() {
    assertEquals(
        Permission.Access.NOT_ALLOW,
        listedAccess(rule(ALL_RESOURCES, MetadataOperation.ALL, Rule.Effect.ALLOW)));
    assertEquals(Permission.Access.ALLOW, listedAccess(rule(RDF, SPARQL, Rule.Effect.ALLOW)));
    assertEquals(
        Permission.Access.DENY,
        listedAccess(rule(ALL_RESOURCES, MetadataOperation.ALL, Rule.Effect.DENY)));
  }

  private static CompiledRule rule(
      String resource, MetadataOperation operation, Rule.Effect effect) {
    return new CompiledRule(
        new Rule()
            .withName("rule")
            .withResources(List.of(resource))
            .withOperations(List.of(operation))
            .withEffect(effect));
  }

  private static boolean allowsOnRdf(CompiledRule rule, MetadataOperation operation) {
    OperationContext operationContext = new OperationContext(RDF, operation);
    rule.evaluateAllowRule(operationContext, null, null, null);
    return !operationContext.getOperations(null).contains(operation);
  }

  private static boolean denies(CompiledRule rule, MetadataOperation operation) {
    String resource = operation == IMPERSONATE ? Entity.USER : RDF;
    OperationContext operationContext = new OperationContext(resource, operation);
    PolicyContext policyContext = new PolicyContext(Entity.ROLE, "role", "role", "policy", null);
    SubjectContext subject = new SubjectContext(new User().withName("caller"), null);
    try {
      rule.evaluateDenyRule(operationContext, subject, null, policyContext);
      return false;
    } catch (AuthorizationException denied) {
      return true;
    }
  }

  private static Permission.Access listedAccess(CompiledRule rule) {
    ResourcePermission resourcePermission =
        new ResourcePermission()
            .withResource(RDF)
            .withPermissions(
                new ArrayList<>(
                    List.of(
                        new Permission()
                            .withOperation(SPARQL)
                            .withAccess(Permission.Access.NOT_ALLOW))));
    rule.evaluatePermission(
        Map.of(RDF, resourcePermission),
        new PolicyContext(Entity.ROLE, "role", "role", "policy", null));
    return resourcePermission.getPermissions().getFirst().getAccess();
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
