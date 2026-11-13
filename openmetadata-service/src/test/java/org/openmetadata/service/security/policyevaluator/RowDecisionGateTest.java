package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Cache;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * A listing checks rows one by one only when a rule could decide a row differently from the
 * listing: a deny rule the caller holds, a deny rule of a policy attached to a team, or an allow
 * the caller holds only under a condition. Each test uses its own resource, since the team answer
 * is cached per policy generation.
 */
class RowDecisionGateTest {
  private static final List<MetadataOperation> VIEW = List.of(MetadataOperation.VIEW_BASIC);

  @Test
  void aDenyPolicyAttachedToNoTeamDoesNotForceRowChecks() {
    Policy unattached = denyPolicy("SeededDeny");

    assertFalse(mayDiffer(List.of(allowAll()), List.of(unattached), "rowGateUnattached"));
  }

  @Test
  void aDenyPolicyAttachedToATeamForcesRowChecks() {
    Policy attached =
        denyPolicy("TeamDeny")
            .withTeams(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEAM)));

    assertTrue(mayDiffer(List.of(allowAll()), List.of(attached), "rowGateTeam"));
  }

  @Test
  void aDenyRuleTheCallerHoldsForcesRowChecks() {
    SubjectContext.PolicyContext ownDeny =
        new SubjectContext.PolicyContext(
            Entity.USER, "caller", null, "OwnDeny", CompiledRule.enforcedRules(denyPolicy("Own")));

    assertTrue(mayDiffer(List.of(allowAll(), ownDeny), List.of(), "rowGateOwn"));
  }

  @Test
  void anAllowHeldOnlyUnderAConditionForcesRowChecks() {
    Rule conditional =
        new Rule()
            .withName("ownerOnly")
            .withResources(List.of("all"))
            .withOperations(List.of(MetadataOperation.ALL))
            .withEffect(Rule.Effect.ALLOW)
            .withCondition("isOwner()");
    SubjectContext.PolicyContext conditionalAllow =
        new SubjectContext.PolicyContext(
            Entity.USER,
            "caller",
            null,
            "OwnerOnly",
            CompiledRule.enforcedRules(policy("OwnerOnly", conditional)));

    assertTrue(mayDiffer(List.of(conditionalAllow), List.of(), "rowGateConditional"));
  }

  @Test
  void theTeamDenyAnswerExpiresLikeTheCompiledPolicies() {
    AtomicLong nanos = new AtomicLong();
    Cache<String, Boolean> answers = RowDecisionGate.teamDenyRuleCache(nanos::get);
    answers.put("0|table|[ViewBasic]", false);

    nanos.addAndGet(SubjectCache.POLICIES_TTL.minusSeconds(1).toNanos());
    assertEquals(false, answers.getIfPresent("0|table|[ViewBasic]"));

    nanos.addAndGet(Duration.ofSeconds(2).toNanos());
    assertNull(answers.getIfPresent("0|table|[ViewBasic]"));
  }

  private static boolean mayDiffer(
      List<SubjectContext.PolicyContext> own, List<Policy> stored, String resource) {
    SubjectContext subject = mock(SubjectContext.class);
    User user = new User().withName("caller");
    when(subject.isAdmin()).thenReturn(false);
    when(subject.user()).thenReturn(user);
    @SuppressWarnings("unchecked")
    EntityRepository<Policy> policies = mock(EntityRepository.class);
    when(policies.getFields("teams")).thenReturn(Fields.EMPTY_FIELDS);
    when(policies.listAfter(isNull(), any(), any(), anyInt(), isNull()))
        .thenReturn(new ResultList<>(stored, null, null, stored.size()));
    try (MockedStatic<SubjectCache> cache =
            mockStatic(SubjectCache.class, Mockito.CALLS_REAL_METHODS);
        MockedStatic<Entity> entity = mockStatic(Entity.class, Mockito.CALLS_REAL_METHODS)) {
      cache.when(() -> SubjectCache.getPolicies("caller")).thenReturn(own);
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(policies);
      return RowDecisionGate.mayDiffer(subject, resource, VIEW);
    }
  }

  private static SubjectContext.PolicyContext allowAll() {
    Rule allow =
        new Rule()
            .withName("allowAll")
            .withResources(List.of("all"))
            .withOperations(List.of(MetadataOperation.ALL))
            .withEffect(Rule.Effect.ALLOW);
    return new SubjectContext.PolicyContext(
        Entity.USER, "caller", null, "AllowAll", CompiledRule.enforcedRules(policy("All", allow)));
  }

  private static Policy denyPolicy(String name) {
    Rule deny =
        new Rule()
            .withName("deny")
            .withResources(List.of("all"))
            .withOperations(List.of(MetadataOperation.ALL))
            .withEffect(Rule.Effect.DENY)
            .withCondition("!matchTeam()");
    return policy(name, deny);
  }

  private static Policy policy(String name, Rule rule) {
    return new Policy()
        .withId(UUID.randomUUID())
        .withName(name)
        .withEnabled(true)
        .withRules(List.of(rule));
  }
}
