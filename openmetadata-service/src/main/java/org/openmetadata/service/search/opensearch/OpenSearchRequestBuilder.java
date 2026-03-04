package org.openmetadata.service.search.opensearch;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import os.org.opensearch.client.opensearch._types.FieldSort;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.NestedSortValue;
import os.org.opensearch.client.opensearch._types.SearchType;
import os.org.opensearch.client.opensearch._types.SortMode;
import os.org.opensearch.client.opensearch._types.SortOptions;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.search.Highlight;
import os.org.opensearch.client.opensearch.core.search.SourceConfig;

public class OpenSearchRequestBuilder {
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
  private List<FieldValue> searchAfter;
  private SearchType searchType;

  public OpenSearchRequestBuilder() {}

  public OpenSearchRequestBuilder query(Query query) {
    this.query = query;
    return this;
  }

  public Query query() {
    return this.query;
  }

  public OpenSearchRequestBuilder postFilter(Query postFilterQuery) {
    this.postFilterQuery = postFilterQuery;
    return this;
  }

  public Query postFilter() {
    return this.postFilterQuery;
  }

  public OpenSearchRequestBuilder from(int from) {
    this.from = from;
    return this;
  }

  public Integer from() {
    return this.from;
  }

  public OpenSearchRequestBuilder size(int size) {
    this.size = size;
    return this;
  }

  public Integer size() {
    return this.size;
  }

  public OpenSearchRequestBuilder sort(SortOptions sortOptions) {
    this.sortOptions.add(sortOptions);
    return this;
  }

  public OpenSearchRequestBuilder sort(String field, SortOrder order) {
    this.sortOptions.add(
        SortOptions.of(s -> s.field(FieldSort.of(f -> f.field(field).order(order)))));
    return this;
  }

  public OpenSearchRequestBuilder sort(String field, SortOrder order, String unmappedType) {
    this.sortOptions.add(
        SortOptions.of(
            s ->
                s.field(
                    FieldSort.of(
                        f -> {
                          f.field(field).order(order);
                          if (unmappedType != null) {
                            f.unmappedType(
                                os.org.opensearch.client.opensearch._types.mapping.FieldType
                                    ._DESERIALIZER
                                    .parse(unmappedType));
                          }
                          return f;
                        }))));
    return this;
  }

  public OpenSearchRequestBuilder sortWithNested(
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
                            f.unmappedType(
                                os.org.opensearch.client.opensearch._types.mapping.FieldType
                                    ._DESERIALIZER
                                    .parse(unmappedType));
                          }
                          return f;
                        }))));
    return this;
  }

  public List<SortOptions> sorts() {
    return this.sortOptions;
  }

  public OpenSearchRequestBuilder aggregation(String name, Aggregation aggregation) {
    this.aggregations.put(name, aggregation);
    return this;
  }

  public Map<String, Aggregation> aggregations() {
    return this.aggregations;
  }

  public OpenSearchRequestBuilder highlighter(Highlight highlight) {
    this.highlight = highlight;
    return this;
  }

  public Highlight highlighter() {
    return this.highlight;
  }

  public OpenSearchRequestBuilder fetchSource(boolean fetch) {
    this.sourceConfig = SourceConfig.of(s -> s.fetch(fetch));
    return this;
  }

  public OpenSearchRequestBuilder fetchSource(String[] includes, String[] excludes) {
    List<String> includeList = includes != null ? Arrays.asList(includes) : new ArrayList<>();
    List<String> excludeList = excludes != null ? Arrays.asList(excludes) : new ArrayList<>();
    this.sourceConfig =
        SourceConfig.of(s -> s.filter(f -> f.includes(includeList).excludes(excludeList)));
    return this;
  }

  public SourceConfig fetchSource() {
    return this.sourceConfig;
  }

  public OpenSearchRequestBuilder trackTotalHits(boolean trackTotalHits) {
    this.trackTotalHits = trackTotalHits;
    return this;
  }

  public OpenSearchRequestBuilder trackTotalHitsUpTo(int trackTotalHitsUpTo) {
    this.trackTotalHitsUpTo = trackTotalHitsUpTo;
    return this;
  }

  public Boolean trackTotalHits() {
    return this.trackTotalHits;
  }

  public Integer trackTotalHitsUpTo() {
    return this.trackTotalHitsUpTo;
  }

  public OpenSearchRequestBuilder timeout(String timeout) {
    this.timeout = timeout;
    return this;
  }

  public String timeout() {
    return this.timeout;
  }

  public OpenSearchRequestBuilder explain(boolean explain) {
    this.explain = explain;
    return this;
  }

  public Boolean explain() {
    return this.explain;
  }

  public OpenSearchRequestBuilder searchAfter(List<FieldValue> searchAfter) {
    this.searchAfter = searchAfter;
    return this;
  }

  public List<FieldValue> searchAfter() {
    return this.searchAfter;
  }

  public OpenSearchRequestBuilder searchType(SearchType searchType) {
    this.searchType = searchType;
    return this;
  }

  public SearchType searchType() {
    return this.searchType;
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
            s.searchAfter(searchAfter);
          }

          if (searchType != null) {
            s.searchType(searchType);
          }

          return s;
        });
  }

  public SearchRequest build(List<String> indices) {
    return build(indices.toArray(new String[0]));
  }
}
