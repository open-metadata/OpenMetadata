package org.openmetadata.service.search.security;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.security.RBACConditionEvaluator.CompiledSearchFilter;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * The caller's search access policies as one clause that holds for entity documents and vector
 * chunk documents alike, for any search whose hits can be either: hybrid, NLQ and vector search
 * (ADR:2026-10-23-search-access-policies-apply-to-vector-chunks).
 *
 * <p>Entity documents get exactly the clause normal search applies. Chunk documents get the same
 * rules compiled for their own fields; a chunk written before chunks carried those fields cannot be
 * evaluated, so it is withheld from a caller whose policies restrict anything until Search Reindex
 * restamps it. The policies apply under the same condition as normal search: access control on,
 * caller identified and not an admin, bots included.
 */
public class SearchAccessFilter {

  /** Present on every entity document, absent from every vector chunk document. */
  public static final String FIELD_ID = "id";

  private final QueryBuilderFactory queryBuilderFactory;
  private final RBACConditionEvaluator evaluator;

  public SearchAccessFilter(QueryBuilderFactory queryBuilderFactory) {
    this.queryBuilderFactory = queryBuilderFactory;
    this.evaluator = new RBACConditionEvaluator(queryBuilderFactory);
  }

  /** The clause to AND into a search, or null when the caller's policies do not apply. */
  public OMQueryBuilder build(SubjectContext subjectContext) {
    OMQueryBuilder filter = null;
    if (SearchUtils.shouldApplyRbacConditions(subjectContext, evaluator)) {
      filter =
          queryBuilderFactory
              .boolQuery()
              .should(List.of(entityBranch(subjectContext), chunkBranch(subjectContext)));
    }
    return filter;
  }

  private OMQueryBuilder entityBranch(SubjectContext subjectContext) {
    OMQueryBuilder policy =
        evaluator.compile(subjectContext, SearchDocumentFields.ENTITY_DOCUMENTS).query();
    return queryBuilderFactory
        .boolQuery()
        .filter(List.of(queryBuilderFactory.existsQuery(FIELD_ID), policy));
  }

  private OMQueryBuilder chunkBranch(SubjectContext subjectContext) {
    CompiledSearchFilter policy =
        evaluator.compile(subjectContext, SearchDocumentFields.CHUNK_DOCUMENTS);
    List<OMQueryBuilder> required = new ArrayList<>(List.of(policy.query()));
    if (!policy.grantsEverything()) {
      required.add(queryBuilderFactory.existsQuery(VectorDocBuilder.FIELD_ACCESS_STAMP));
    }
    return queryBuilderFactory
        .boolQuery()
        .filter(required)
        .mustNot(List.of(queryBuilderFactory.existsQuery(FIELD_ID)));
  }
}
