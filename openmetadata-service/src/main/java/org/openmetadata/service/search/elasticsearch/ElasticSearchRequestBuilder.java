package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.FieldSort;
import es.co.elastic.clients.elasticsearch._types.NestedSortValue;
import es.co.elastic.clients.elasticsearch._types.SortMode;
import es.co.elastic.clients.elasticsearch._types.SortOptions;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.mapping.FieldType;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.search.Highlight;
import es.co.elastic.clients.elasticsearch.core.search.SourceConfig;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ElasticSearchRequestBuilder {
  private Query query;
  private Query postFilterQuery;
  private final List<SortOptions> sortOptions = new ArrayList<>();
  private final Map<String, Aggregation> aggregations = new ConcurrentHashMap<>();
  private Highlight highlight;
  private SourceConfig sourceConfig;
  private Integer from;
  private Integer size;
  private Boolean trackTotalHits;
  private Integer trackTotalHitsUpTo;
  private String timeout;
  private Boolean explain;
  private List<String> searchAfter;

  public ElasticSearchRequestBuilder() {}

  public ElasticSearchRequestBuilder query(Query query) {
    this.query = query;
    return this;
  }

  public Query query() {
    return this.query;
  }

  public ElasticSearchRequestBuilder postFilter(Query postFilterQuery) {
    this.postFilterQuery = postFilterQuery;
    return this;
  }

  public Query postFilter() {
    return this.postFilterQuery;
  }

  public ElasticSearchRequestBuilder from(int from) {
    this.from = from;
    return this;
  }

  public Integer from() {
    return this.from;
  }

  public ElasticSearchRequestBuilder size(int size) {
    this.size = size;
    return this;
  }

  public Integer size() {
    return this.size;
  }

  public ElasticSearchRequestBuilder sort(SortOptions sortOptions) {
    this.sortOptions.add(sortOptions);
    return this;
  }

  public ElasticSearchRequestBuilder sort(String field, SortOrder order) {
    this.sortOptions.add(
        SortOptions.of(s -> s.field(FieldSort.of(f -> f.field(field).order(order)))));
    return this;
  }

  public ElasticSearchRequestBuilder sort(String field, SortOrder order, String unmappedType) {
    this.sortOptions.add(
        SortOptions.of(
            s ->
                s.field(
                    FieldSort.of(
                        f -> {
                          f.field(field).order(order);
                          if (unmappedType != null) {
                            f.unmappedType(FieldType._DESERIALIZER.parse(unmappedType));
                          }
                          return f;
                        }))));
    return this;
  }

  public ElasticSearchRequestBuilder sortWithNested(
      String field, SortOrder order, String unmappedType, String nestedPath, SortMode sortMode) {
    this.sortOptions.add(
        SortOptions.of(
            s ->
                s.field(
                    FieldSort.of(
                        f -> {
                          f.field(field)
                              .order(order)
                              .nested(NestedSortValue.of(n -> n.path(nestedPath)))
                              .mode(sortMode);
                          if (unmappedType != null) {
                            f.unmappedType(FieldType._DESERIALIZER.parse(unmappedType));
                          }
                          return f;
                        }))));
    return this;
  }

  public List<SortOptions> sorts() {
    return this.sortOptions;
  }

  public ElasticSearchRequestBuilder aggregation(String name, Aggregation aggregation) {
    this.aggregations.put(name, aggregation);
    return this;
  }

  public Map<String, Aggregation> aggregations() {
    return this.aggregations;
  }

  public ElasticSearchRequestBuilder highlighter(Highlight highlight) {
    this.highlight = highlight;
    return this;
  }

  public Highlight highlighter() {
    return this.highlight;
  }

  public ElasticSearchRequestBuilder fetchSource(boolean fetch) {
    this.sourceConfig = SourceConfig.of(s -> s.fetch(fetch));
    return this;
  }

  public ElasticSearchRequestBuilder fetchSource(String[] includes, String[] excludes) {
    List<String> includeList = includes != null ? Arrays.asList(includes) : new ArrayList<>();
    List<String> excludeList = excludes != null ? Arrays.asList(excludes) : new ArrayList<>();
    this.sourceConfig =
        SourceConfig.of(s -> s.filter(f -> f.includes(includeList).excludes(excludeList)));
    return this;
  }

  public SourceConfig fetchSource() {
    return this.sourceConfig;
  }

  public ElasticSearchRequestBuilder trackTotalHits(boolean trackTotalHits) {
    this.trackTotalHits = trackTotalHits;
    return this;
  }

  public ElasticSearchRequestBuilder trackTotalHitsUpTo(int trackTotalHitsUpTo) {
    this.trackTotalHitsUpTo = trackTotalHitsUpTo;
    return this;
  }

  public Boolean trackTotalHits() {
    return this.trackTotalHits;
  }

  public Integer trackTotalHitsUpTo() {
    return this.trackTotalHitsUpTo;
  }

  public ElasticSearchRequestBuilder timeout(String timeout) {
    this.timeout = timeout;
    return this;
  }

  public String timeout() {
    return this.timeout;
  }

  public ElasticSearchRequestBuilder explain(boolean explain) {
    this.explain = explain;
    return this;
  }

  public Boolean explain() {
    return this.explain;
  }

  public ElasticSearchRequestBuilder searchAfter(List<String> searchAfter) {
    this.searchAfter = searchAfter;
    return this;
  }

  public List<String> searchAfter() {
    return this.searchAfter;
  }

  public SearchRequest build(String... indices) {
    return SearchRequest.of(
        s -> {
          s.index(Arrays.asList(indices));

          if (query != null) {
            s.query(query);
          }

          if (postFilterQuery != null) {
            s.postFilter(postFilterQuery);
          }

          if (!sortOptions.isEmpty()) {
            s.sort(sortOptions);
          }

          if (!aggregations.isEmpty()) {
            s.aggregations(aggregations);
          }

          if (highlight != null) {
            s.highlight(highlight);
          }

          if (sourceConfig != null) {
            s.source(sourceConfig);
          }

          if (from != null) {
            s.from(from);
          }

          if (size != null) {
            s.size(size);
          }

          if (trackTotalHits != null && trackTotalHits) {
            s.trackTotalHits(th -> th.enabled(true));
          } else if (trackTotalHitsUpTo != null) {
            s.trackTotalHits(th -> th.count(trackTotalHitsUpTo));
          }

          if (timeout != null) {
            s.timeout(timeout);
          }

          if (explain != null) {
            s.explain(explain);
          }

          if (searchAfter != null && !searchAfter.isEmpty()) {
            List<es.co.elastic.clients.elasticsearch._types.FieldValue> fieldValues =
                new ArrayList<>();
            for (String value : searchAfter) {
              fieldValues.add(es.co.elastic.clients.elasticsearch._types.FieldValue.of(value));
            }
            s.searchAfter(fieldValues);
          }

          return s;
        });
  }

  public SearchRequest build(List<String> indices) {
    return build(indices.toArray(new String[0]));
  }
}
