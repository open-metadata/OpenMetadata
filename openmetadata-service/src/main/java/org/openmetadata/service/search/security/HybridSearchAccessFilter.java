package org.openmetadata.service.search.security;

import java.util.List;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.queries.SearchQueryDsl;
import org.openmetadata.service.search.vector.ChunkSecurityMetadata;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Search policy scope for entity documents and versioned, self-contained vector chunks. */
public final class HybridSearchAccessFilter {
  private HybridSearchAccessFilter() {}

  /** Null means search policy enforcement is disabled or the caller is an administrator. */
  public static String query(SearchQueryDsl dsl, SubjectContext subject) {
    String result = null;
    if (SearchUtils.isAccessControlEnabled() && (subject == null || !subject.isAdmin())) {
      QueryBuilderFactory factory = dsl.queryBuilderFactory();
      OMQueryBuilder policies =
          subject == null
              ? factory.matchNoneQuery()
              : new RBACConditionEvaluator(factory, true).evaluateConditions(subject);
      OMQueryBuilder query =
          policies == null
              ? factory.matchNoneQuery()
              : factory.boolQuery().must(List.of(policies, eligibleDocuments(factory)));
      result = dsl.toJson(query);
    }
    return result;
  }

  private static OMQueryBuilder eligibleDocuments(QueryBuilderFactory factory) {
    OMQueryBuilder chunks =
        factory
            .boolQuery()
            .must(
                List.of(
                    factory.existsQuery("parentId"),
                    factory.existsQuery(ChunkSecurityMetadata.FINGERPRINT_FIELD),
                    factory.termQuery(
                        ChunkSecurityMetadata.VERSION_FIELD,
                        Integer.toString(ChunkSecurityMetadata.VERSION))));
    return factory.boolQuery().should(List.of(factory.existsQuery("id"), chunks));
  }
}
