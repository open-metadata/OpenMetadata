package org.openmetadata.service.search.opensearch;

import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.AuditReportSearchVisibility;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

/** Narrows an OpenSearch query to the documents a caller's search access policies allow. */
final class OpenSearchRbacQueries {
  private static final AuditReportSearchVisibility REPORT_VISIBILITY =
      new AuditReportSearchVisibility(new OpenSearchQueryBuilderFactory());

  private OpenSearchRbacQueries() {}

  /**
   * ANDs the caller's policy conditions into {@code query}. Queries built outside the request
   * builder skip its policy injection, so without this a caller can read documents they are denied
   * on the corresponding listing. Audit report visibility is mandatory even with access control
   * disabled; an unresolved subject cannot read reports. Bots are policy-evaluated like any other caller.
   */
  static Query withAccessPolicies(
      Query query, SubjectContext subjectContext, RBACConditionEvaluator rbacConditionEvaluator) {
    final Query reportFilter =
        ((OpenSearchQueryBuilder) REPORT_VISIBILITY.buildVisibilityFilter(subjectContext))
            .buildV2();
    final Query scoped =
        query == null
            ? reportFilter
            : Query.of(q -> q.bool(b -> b.must(query).filter(reportFilter)));
    if (subjectContext == null
        || !SearchUtils.shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      return scoped;
    }
    OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
    if (rbacQueryBuilder == null) {
      // Fail closed: policies had to be applied for this caller (access control on, not admin/bot)
      // but produced no query. Returning the unfiltered query would leak; match nothing instead.
      return Query.of(qb -> qb.matchNone(m -> m));
    }
    Query rbacQuery = ((OpenSearchQueryBuilder) rbacQueryBuilder).buildV2();
    final Query existingQuery = scoped;
    return Query.of(qb -> qb.bool(b -> b.must(existingQuery).filter(rbacQuery)));
  }
}
