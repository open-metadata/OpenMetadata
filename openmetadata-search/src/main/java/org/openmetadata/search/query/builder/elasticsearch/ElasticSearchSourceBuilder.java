package org.openmetadata.search.query.builder.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.search.Highlight;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.search.query.builder.OMAggregationBuilder;
import org.openmetadata.search.query.builder.OMHighlightBuilder;
import org.openmetadata.search.query.builder.OMQueryBuilder;
import org.openmetadata.search.query.builder.OMSearchSourceBuilder;

public class ElasticSearchSourceBuilder implements OMSearchSourceBuilder {
  private final SearchRequest.Builder searchBuilder;
  private final Map<String, Aggregation> aggregations = new HashMap<>();

  public ElasticSearchSourceBuilder() {
    this.searchBuilder = new SearchRequest.Builder();
  }

  @Override
  public OMSearchSourceBuilder query(OMQueryBuilder query) {
    ElasticQueryBuilder elasticQuery = (ElasticQueryBuilder) query;
    searchBuilder.query(elasticQuery.build(Query.class));
    return this;
  }

  @Override
  public OMSearchSourceBuilder aggregation(String name, OMAggregationBuilder aggregation) {
    ElasticAggregationBuilder elasticAgg = (ElasticAggregationBuilder) aggregation;
    aggregations.put(name, elasticAgg.build(Aggregation.class));
    return this;
  }

  @Override
  public OMSearchSourceBuilder highlight(OMHighlightBuilder highlight) {
    ElasticHighlightBuilder elasticHighlight = (ElasticHighlightBuilder) highlight;
    searchBuilder.highlight(elasticHighlight.build(Highlight.class));
    return this;
  }

  @Override
  public OMSearchSourceBuilder sort(String field, String order) {
    // Implementation would add sort to searchBuilder
    return this;
  }

  @Override
  public OMSearchSourceBuilder sort(String field) {
    return sort(field, "asc");
  }

  @Override
  public OMSearchSourceBuilder from(int from) {
    searchBuilder.from(from);
    return this;
  }

  @Override
  public OMSearchSourceBuilder size(int size) {
    searchBuilder.size(size);
    return this;
  }

  @Override
  public OMSearchSourceBuilder timeout(String timeout) {
    searchBuilder.timeout(timeout);
    return this;
  }

  @Override
  public OMSearchSourceBuilder minScore(float minScore) {
    searchBuilder.minScore((double) minScore);
    return this;
  }

  @Override
  public OMSearchSourceBuilder trackScores(boolean trackScores) {
    searchBuilder.trackScores(trackScores);
    return this;
  }

  @Override
  public OMSearchSourceBuilder trackTotalHits(boolean trackTotalHits) {
    // Implementation would set track_total_hits
    return this;
  }

  @Override
  public OMSearchSourceBuilder source(boolean fetch) {
    searchBuilder.source(s -> s.fetch(fetch));
    return this;
  }

  @Override
  public OMSearchSourceBuilder source(String... includes) {
    searchBuilder.source(s -> s.filter(f -> f.includes(List.of(includes))));
    return this;
  }

  @Override
  public OMSearchSourceBuilder source(String[] includes, String[] excludes) {
    searchBuilder.source(
        s -> s.filter(f -> f.includes(List.of(includes)).excludes(List.of(excludes))));
    return this;
  }

  @Override
  public OMSearchSourceBuilder storedField(String field) {
    searchBuilder.storedFields(field);
    return this;
  }

  @Override
  public OMSearchSourceBuilder storedFields(List<String> fields) {
    searchBuilder.storedFields(fields);
    return this;
  }

  @Override
  public OMSearchSourceBuilder docValueField(String field) {
    // Implementation would add docvalue field
    return this;
  }

  @Override
  public OMSearchSourceBuilder docValueFields(List<String> fields) {
    // Implementation would add docvalue fields
    return this;
  }

  @Override
  public OMSearchSourceBuilder scriptField(String name, String script) {
    // Implementation would add script field
    return this;
  }

  @Override
  public OMSearchSourceBuilder scriptField(String name, String script, Map<String, Object> params) {
    // Implementation would add script field with params
    return this;
  }

  @Override
  public OMSearchSourceBuilder explain(boolean explain) {
    searchBuilder.explain(explain);
    return this;
  }

  @Override
  public OMSearchSourceBuilder version(boolean version) {
    searchBuilder.version(version);
    return this;
  }

  @Override
  public OMSearchSourceBuilder seqNoAndPrimaryTerm(boolean seqNoAndPrimaryTerm) {
    searchBuilder.seqNoPrimaryTerm(seqNoAndPrimaryTerm);
    return this;
  }

  @Override
  @SuppressWarnings("unchecked")
  public <T> T build(Class<T> targetType) {
    if (targetType.isAssignableFrom(SearchRequest.class)) {
      if (!aggregations.isEmpty()) {
        searchBuilder.aggregations(aggregations);
      }
      return (T) searchBuilder.build();
    }
    throw new IllegalArgumentException("Unsupported target type: " + targetType);
  }
}
