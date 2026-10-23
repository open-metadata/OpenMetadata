package org.openmetadata.service.search.vector;

import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.Set;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.SearchAccessFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * What a vector request's subject may see, decided once per request before over-fetching and
 * reused on every page (ADR:2026-10-09-search-admits-memories-of-pinned-anchors, amendment): the
 * pinned anchors whose memories it may read, and its search access policies as a query clause
 * (ADR:2026-10-23-search-access-policies-apply-to-vector-chunks).
 *
 * @param readableAnchorIds anchors the request pins that the subject may read
 * @param accessFilterJson the subject's access clause as engine JSON, or null when no policy applies
 */
public record VectorSearchAccess(Set<String> readableAnchorIds, String accessFilterJson) {

  private static final SearchAccessFilter OPEN_SEARCH_FILTER =
      new SearchAccessFilter(new OpenSearchQueryBuilderFactory());
  private static final SearchAccessFilter ELASTIC_SEARCH_FILTER =
      new SearchAccessFilter(new ElasticQueryBuilderFactory());
  private static final JacksonJsonpMapper ELASTIC_JSONP_MAPPER = new JacksonJsonpMapper();

  public static VectorSearchAccess forOpenSearch(VectorSearchParameters parameters) {
    return new VectorSearchAccess(
        VectorSearchMemoryAccess.readableAnchorIds(parameters),
        openSearchFilterJson(parameters.subjectContext()));
  }

  public static VectorSearchAccess forElasticSearch(VectorSearchParameters parameters) {
    return new VectorSearchAccess(
        VectorSearchMemoryAccess.readableAnchorIds(parameters),
        elasticSearchFilterJson(parameters.subjectContext()));
  }

  /** The subject's access clause for OpenSearch, or null when no policy applies. */
  public static String openSearchFilterJson(SubjectContext subjectContext) {
    OMQueryBuilder filter = OPEN_SEARCH_FILTER.build(subjectContext);
    return filter == null ? null : ((OpenSearchQueryBuilder) filter).build().toJsonString();
  }

  /** The subject's access clause for Elasticsearch, or null when no policy applies. */
  public static String elasticSearchFilterJson(SubjectContext subjectContext) {
    OMQueryBuilder filter = ELASTIC_SEARCH_FILTER.build(subjectContext);
    return filter == null ? null : toJson((ElasticQueryBuilder) filter);
  }

  private static String toJson(ElasticQueryBuilder filter) {
    StringWriter writer = new StringWriter();
    JsonGenerator generator = ELASTIC_JSONP_MAPPER.jsonProvider().createGenerator(writer);
    filter.build().serialize(generator, ELASTIC_JSONP_MAPPER);
    generator.close();
    return writer.toString();
  }
}
