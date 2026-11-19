package org.openmetadata.service.search.opensearch;

import java.util.Optional;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

/** Narrows an OpenSearch query to the documents a caller's search access policies allow. */
final class OpenSearchRbacQueries {

  private OpenSearchRbacQueries() {}

  /**
   * ANDs the caller's policy conditions into {@code query}. Queries built outside the request
   * builder skip its policy injection, so without this a caller can read documents they are denied
   * on the corresponding listing. A {@code null} or exempt subject (admin, or access control
   * disabled) is left unfiltered. Bots are not exempt: they are policy-evaluated like any other
   * caller.
   */
  /** The clause {@link #withAccessPolicies} adds for this caller, as JSON; none when it adds none. */
  static Optional<String> accessFilter(
      SubjectContext subjectContext, RBACConditionEvaluator rbacConditionEvaluator) {
    return Optional.ofNullable(withAccessPolicies(null, subjectContext, rbacConditionEvaluator))
        .map(Query::toJsonString);
  }

  static Query withAccessPolicies(
      Query query, SubjectContext subjectContext, RBACConditionEvaluator rbacConditionEvaluator) {
    if (subjectContext == null
        || !SearchUtils.shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      return query;
    }
    OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
    if (rbacQueryBuilder == null) {
      // Fail closed: policies had to be applied for this caller (access control on, not admin/bot)
      // but produced no query. Returning the unfiltered query would leak; match nothing instead.
      return Query.of(qb -> qb.matchNone(m -> m));
    }
    Query rbacQuery = ((OpenSearchQueryBuilder) rbacQueryBuilder).buildV2();
    if (query == null) {
      return rbacQuery;
    }
    final Query existingQuery = query;
    return Query.of(qb -> qb.bool(b -> b.must(existingQuery).filter(rbacQuery)));
  }
}
