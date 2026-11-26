package org.openmetadata.service.search.security;

import java.util.List;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Saved packs remain requester-scoped even when optional search policy filtering is disabled. */
public final class AuditReportSearchVisibility {
  private final QueryBuilderFactory queries;

  public AuditReportSearchVisibility(final QueryBuilderFactory queries) {
    this.queries = queries;
  }

  public OMQueryBuilder buildVisibilityFilter(final SubjectContext subject) {
    final OMQueryBuilder report = queries.termQuery("entityType", Entity.AUDIT_REPORT);
    final OMQueryBuilder otherEntities = queries.boolQuery().mustNot(List.of(report));
    OMQueryBuilder visibility = otherEntities;
    if (subject != null && subject.isAdmin()) {
      visibility = queries.matchAllQuery();
    } else if (subject != null && subject.user() != null && subject.user().getId() != null) {
      final OMQueryBuilder requestedBy =
          queries.termQuery("requestedBy.id.keyword", subject.user().getId().toString());
      visibility =
          queries
              .boolQuery()
              .should(
                  List.of(otherEntities, queries.boolQuery().must(List.of(report, requestedBy))));
    }
    return visibility;
  }
}
