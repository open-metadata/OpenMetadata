package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/**
 * Reproduces the OperationContext reuse bypass: {@link PolicyEvaluator#hasPermission} drains the
 * requested operations list in place as it grants them, and an empty list makes it skip deny
 * evaluation and pass its final check vacuously. Reusing one OperationContext across decisions
 * therefore lets a first success authorize every later decision without evaluating any deny rule -
 * an authorization bypass reachable on GET /v1/permissions/policies?ids=.
 */
class ContextReuseDenyBypassTest {

  @Test
  void freshOperationContextEnforcesConditionalDeny() {
    // Control case: a fresh OperationContext per decision. The owned resource is allowed (deny
    // condition !isOwner() is false); the non-owned resource is denied (condition is true).
    assertDoesNotThrow(() -> authorizeWithFreshContext(true));
    AuthorizationException denied =
        assertThrows(AuthorizationException.class, () -> authorizeWithFreshContext(false));
    assertTrue(denied.getMessage().contains("caller"), denied.getMessage());
  }

  @Test
  void reusedOperationContextBypassesConditionalDeny() {
    // The first (owned) call drains the operations list. Without a reset the second (non-owned)
    // call would skip deny evaluation and authorize vacuously; with the reset it must throw.
    AuthorizationException denied =
        assertThrows(
            AuthorizationException.class, () -> authorizeReusingSameContext(List.of(true, false)));
    assertTrue(denied.getMessage().contains("caller"), denied.getMessage());
  }

  @Test
  void reusedOperationContextEnforcesDenyOnEveryDeniedId() {
    // Only denied ids: the first decision itself must throw, proving the deny is not skipped.
    assertThrows(
        AuthorizationException.class,
        () -> authorizeReusingSameContext(List.of(false, false, false)));
  }

  @Test
  void freshContextAllowsWhenNoDenyApplies() {
    // Sanity: a reused context among owned-only resources must not throw.
    assertDoesNotThrow(() -> authorizeReusingSameContext(List.of(true, true, true)));
  }

  @Test
  void resetOperationsRestoresDrainedList() {
    // The reset must restore the working list to the originally requested operations after a
    // prior evaluation drained it, so a reused context evaluates the full set again.
    OperationContext operationContext =
        new OperationContext(Entity.POLICY, MetadataOperation.VIEW_ALL);
    assertEquals(List.of(MetadataOperation.VIEW_ALL), operationContext.getOperations(null));
    operationContext.getOperations(null).clear(); // simulate the drain from a prior decision
    assertTrue(operationContext.getOperations(null).isEmpty());
    operationContext.resetOperations();
    assertEquals(List.of(MetadataOperation.VIEW_ALL), operationContext.getOperations(null));
  }

  private void authorizeWithFreshContext(boolean owned) {
    User caller = new User().withName("caller");
    SubjectContext subject = new SubjectContext(caller, null);
    try (MockedStatic<SubjectCache> mockedCache = Mockito.mockStatic(SubjectCache.class)) {
      stubPolicies(mockedCache, caller.getName());
      OperationContext operationContext =
          new OperationContext(Entity.POLICY, MetadataOperation.VIEW_ALL);
      PolicyEvaluator.hasPermission(subject, policyResource(owned, caller), operationContext);
    }
  }

  private void authorizeReusingSameContext(List<Boolean> ownedFlags) {
    User caller = new User().withName("caller");
    SubjectContext subject = new SubjectContext(caller, null);
    try (MockedStatic<SubjectCache> mockedCache = Mockito.mockStatic(SubjectCache.class)) {
      stubPolicies(mockedCache, caller.getName());
      OperationContext operationContext =
          new OperationContext(Entity.POLICY, MetadataOperation.VIEW_ALL); // created ONCE
      for (Boolean owned : ownedFlags) {
        PolicyEvaluator.hasPermission(subject, policyResource(owned, caller), operationContext);
      }
    }
  }

  private static void stubPolicies(MockedStatic<SubjectCache> mockedCache, String userName) {
    mockedCache.when(() -> SubjectCache.getPolicies(userName)).thenReturn(policies());
    mockedCache.when(() -> SubjectCache.getVisitedTeams(userName)).thenReturn(new ArrayList<>());
  }

  private static List<PolicyContext> policies() {
    CompiledRule allowRule =
        new CompiledRule(
            new Rule()
                .withName("allow-view-all")
                .withResources(List.of(Entity.POLICY))
                .withOperations(List.of(MetadataOperation.VIEW_ALL))
                .withEffect(Rule.Effect.ALLOW));
    CompiledRule denyRule =
        new CompiledRule(
            new Rule()
                .withName("deny-not-owner")
                .withResources(List.of(Entity.POLICY))
                .withOperations(List.of(MetadataOperation.VIEW_ALL))
                .withEffect(Rule.Effect.DENY)
                .withCondition("!isOwner()"));
    PolicyContext policyContext =
        new PolicyContext(
            Entity.ROLE, "callerRole", "callerRole", "callerPolicy", List.of(allowRule, denyRule));
    return new ArrayList<>(List.of(policyContext));
  }

  private static ResourceContextInterface policyResource(boolean owned, User caller) {
    EntityReference owner = owned ? userRef(caller.getName()) : userRef("someone-else");
    return new ResourceContextInterface() {
      @Override
      public String getResource() {
        return Entity.POLICY;
      }

      @Override
      public List<EntityReference> getOwners() {
        return List.of(owner);
      }

      @Override
      public List<TagLabel> getTags() {
        return null;
      }

      @Override
      public EntityInterface<?> getEntity() {
        return null;
      }

      @Override
      public List<EntityReference> getDomains() {
        return null;
      }

      @Override
      public boolean isEntityTypeLevel() {
        return false;
      }
    };
  }

  private static EntityReference userRef(String name) {
    return new EntityReference().withType(Entity.USER).withName(name).withFullyQualifiedName(name);
  }
}
