package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Narrows an Elasticsearch query to the documents a caller's search access policies allow. */
final class ElasticRbacQueries {

  private ElasticRbacQueries() {}

  /**
   * ANDs the caller's policy conditions into {@code query}. Queries built outside the request
   * builder skip its policy injection, so without this a caller can read documents they are denied
   * on the corresponding listing. A {@code null} or exempt subject (admin, or access control
   * disabled) is left unfiltered. Bots are not exempt: they are policy-evaluated like any other
   * caller.
   */
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
    Query rbacQuery = ((ElasticQueryBuilder) rbacQueryBuilder).buildV2();
    if (query == null) {
      return rbacQuery;
    }
    final Query existingQuery = query;
    return Query.of(qb -> qb.bool(b -> b.must(existingQuery).filter(rbacQuery)));
  }
}
