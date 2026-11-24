package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Whether the rows of a listing can be decided differently from the listing itself. A listing is
 * authorized once, for its type; a row can still be refused by a deny rule that reads the row (its
 * tags, owners, domains) or by an allow rule whose condition the listing satisfied without a row.
 * When neither can happen, every row gets the listing's decision and no row is checked
 * (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read).
 */
@Slf4j
public final class RowDecisionGate {
  private static final int POLICY_PAGE_SIZE = 100;
  private static final int MAX_ENTRIES = 1000;

  // Keyed by policy generation, so a policy or team change on this server starts a fresh answer.
  // The generation is per server, so the answer also expires like the compiled policies it is read
  // beside, and a change made on another server is seen here within the same bound.
  private static final Cache<String, Boolean> TEAM_DENY_RULE =
      teamDenyRuleCache(Ticker.systemTicker());

  private RowDecisionGate() {}

  static Cache<String, Boolean> teamDenyRuleCache(Ticker ticker) {
    return Caffeine.newBuilder()
        .maximumSize(MAX_ENTRIES)
        .expireAfterWrite(SubjectCache.POLICIES_TTL)
        .ticker(ticker)
        .build();
  }

  public static boolean mayDiffer(
      SubjectContext subject, String resource, List<MetadataOperation> operations) {
    if (subject == null || subject.isAdmin()) {
      return false;
    }
    List<SubjectContext.PolicyContext> own = SubjectCache.getPolicies(subject.user().getName());
    return ownDenyRule(own, resource, operations)
        || teamDenyRule(resource, operations)
        || !unconditionallyAllowed(own, resource, operations);
  }

  private static boolean ownDenyRule(
      List<SubjectContext.PolicyContext> own, String resource, List<MetadataOperation> operations) {
    return own.stream()
        .flatMap(policy -> listOrEmpty(policy.getRules()).stream())
        .anyMatch(
            rule -> rule.getEffect() == Rule.Effect.DENY && applies(rule, resource, operations));
  }

  /**
   * A deny rule of a policy attached to a team. A team that owns a row brings its policies' deny
   * rules to callers outside it, so any team's policy can reach a row; a policy attached to no
   * team, like the seeded TeamOnlyPolicy, reaches a caller only through their own roles.
   */
  private static boolean teamDenyRule(String resource, List<MetadataOperation> operations) {
    String key = SubjectCache.policyGeneration() + "|" + resource + "|" + operations;
    return TEAM_DENY_RULE.get(key, ignored -> scanTeamPolicies(resource, operations));
  }

  private static boolean scanTeamPolicies(String resource, List<MetadataOperation> operations) {
    @SuppressWarnings("unchecked")
    EntityRepository<Policy> policies =
        (EntityRepository<Policy>) Entity.getEntityRepository(Entity.POLICY);
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    Fields teams = policies.getFields("teams");
    String after = null;
    do {
      ResultList<Policy> page = policies.listAfter(null, teams, filter, POLICY_PAGE_SIZE, after);
      for (Policy policy : page.getData()) {
        if (nullOrEmpty(policy.getTeams())) {
          continue;
        }
        for (CompiledRule rule : CompiledRule.enforcedRules(policy)) {
          if (rule.getEffect() == Rule.Effect.DENY && applies(rule, resource, operations)) {
            return true;
          }
        }
      }
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);
    return false;
  }

  /** Whether the caller's own policies grant every operation without a condition. */
  private static boolean unconditionallyAllowed(
      List<SubjectContext.PolicyContext> own, String resource, List<MetadataOperation> operations) {
    for (MetadataOperation operation : operations) {
      boolean granted =
          own.stream()
              .flatMap(policy -> listOrEmpty(policy.getRules()).stream())
              .anyMatch(
                  rule ->
                      rule.getEffect() == Rule.Effect.ALLOW
                          && nullOrEmpty(rule.getCondition())
                          && applies(rule, resource, List.of(operation)));
      if (!granted) {
        return false;
      }
    }
    return true;
  }

  private static boolean applies(
      CompiledRule rule, String resource, List<MetadataOperation> operations) {
    return rule.matchResource(resource)
        && operations.stream()
            .anyMatch(
                operation ->
                    CompiledRule.operationMatches(
                        rule.getOperations(), rule.getEffect(), operation));
  }
}
