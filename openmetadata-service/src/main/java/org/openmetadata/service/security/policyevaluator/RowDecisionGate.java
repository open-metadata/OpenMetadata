package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
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

  // Keyed by policy generation, so a policy change starts a fresh answer.
  private static final Cache<String, Boolean> ANY_DENY_RULE =
      Caffeine.newBuilder().maximumSize(MAX_ENTRIES).build();

  private RowDecisionGate() {}

  public static boolean mayDiffer(
      SubjectContext subject, String resource, List<MetadataOperation> operations) {
    if (subject == null || subject.isAdmin()) {
      return false;
    }
    return anyDenyRule(resource, operations)
        || !unconditionallyAllowed(subject, resource, operations);
  }

  /**
   * Any enabled policy, whoever it applies to, with a deny rule for these operations on this
   * resource. Owner teams bring their deny rules to callers outside them, so the caller's own
   * policies are not enough to rule a deny out.
   */
  private static boolean anyDenyRule(String resource, List<MetadataOperation> operations) {
    String key = SubjectCache.policyGeneration() + "|" + resource + "|" + operations;
    return ANY_DENY_RULE.get(key, ignored -> scanForDenyRule(resource, operations));
  }

  private static boolean scanForDenyRule(String resource, List<MetadataOperation> operations) {
    @SuppressWarnings("unchecked")
    EntityRepository<Policy> policies =
        (EntityRepository<Policy>) Entity.getEntityRepository(Entity.POLICY);
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    String after = null;
    do {
      ResultList<Policy> page =
          policies.listAfter(null, Fields.EMPTY_FIELDS, filter, POLICY_PAGE_SIZE, after);
      for (Policy policy : page.getData()) {
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
      SubjectContext subject, String resource, List<MetadataOperation> operations) {
    List<SubjectContext.PolicyContext> policies =
        SubjectCache.getPolicies(subject.user().getName());
    for (MetadataOperation operation : operations) {
      boolean granted =
          policies.stream()
              .flatMap(policy -> policy.getRules().stream())
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
