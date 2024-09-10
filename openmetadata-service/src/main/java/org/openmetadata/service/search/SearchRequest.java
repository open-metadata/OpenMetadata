package org.openmetadata.service.search;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.type.EntityReference;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

@Getter
@Setter
public class SearchRequest {
  private final String query;
  private int from;
  private final int size;
  private final String queryFilter;
  private final String postFilter;
  private final boolean fetchSource;
  private final boolean trackTotalHits;
  private final String sortFieldParam;
  private final boolean deleted;
  private final String index;
  private final String fieldName;
  private final String sortOrder;
  private final List<String> includeSourceFields;
  private final boolean applyDomainFilter;
  private final List<String> domains;
  private final boolean getHierarchy;
  private final Object[] searchAfter;

  public SearchRequest(ElasticSearchRequestBuilder builder) {
    this.query = builder.query;
    this.from = builder.from;
    this.size = builder.size;
    this.queryFilter = builder.queryFilter;
    this.postFilter = builder.postFilter;
    this.fetchSource = builder.fetchSource;
    this.trackTotalHits = builder.trackTotalHits;
    this.sortFieldParam = builder.sortFieldParam;
    this.deleted = builder.deleted;
    this.index = builder.index;
    this.sortOrder = builder.sortOrder;
    this.includeSourceFields = builder.includeSourceFields;
    this.fieldName = builder.fieldName;
    this.getHierarchy = builder.getHierarchy;
    this.domains = builder.domains;
    this.applyDomainFilter = builder.applyDomainFilter;
    this.searchAfter = builder.searchAfter;
  }

  // Builder class for ElasticSearchRequest

  public static class ElasticSearchRequestBuilder {
    private final String index;
    private final String query;
    private final int size;
    private int from;
    private String fieldName;
    private String queryFilter;
    private String postFilter;
    private boolean fetchSource;
    private boolean trackTotalHits;
    private String sortFieldParam;
    private boolean deleted;
    private String sortOrder;
    private List<String> includeSourceFields;
    private boolean getHierarchy;
    private boolean applyDomainFilter;
    private List<String> domains;
    private Object[] searchAfter;

    public ElasticSearchRequestBuilder(String query, int size, String index) {
      this.query = query;
      this.size = size;
      this.index = index;
    }

    public ElasticSearchRequestBuilder from(int from) {
      this.from = from;
      return this;
    }

    public ElasticSearchRequestBuilder queryFilter(String queryFilter) {
      this.queryFilter = queryFilter;
      return this;
    }

    public ElasticSearchRequestBuilder postFilter(String postFilter) {
      this.postFilter = postFilter;
      return this;
    }

    public ElasticSearchRequestBuilder fetchSource(boolean fetchSource) {
      this.fetchSource = fetchSource;
      return this;
    }

    public ElasticSearchRequestBuilder trackTotalHits(boolean trackTotalHits) {
      this.trackTotalHits = trackTotalHits;
      return this;
    }

    public ElasticSearchRequestBuilder sortFieldParam(String sortFieldParam) {
      this.sortFieldParam = sortFieldParam;
      return this;
    }

    public ElasticSearchRequestBuilder deleted(boolean deleted) {
      this.deleted = deleted;
      return this;
    }

    public ElasticSearchRequestBuilder applyDomainFilter(boolean applyDomainFilter) {
      this.applyDomainFilter = applyDomainFilter;
      return this;
    }

    public ElasticSearchRequestBuilder sortOrder(String sortOrder) {
      this.sortOrder = sortOrder;
      return this;
    }

    public ElasticSearchRequestBuilder includeSourceFields(List<String> includeSourceFields) {
      this.includeSourceFields = includeSourceFields;
      return this;
    }

    public ElasticSearchRequestBuilder fieldName(String fieldName) {
      this.fieldName = fieldName;
      return this;
    }

    public ElasticSearchRequestBuilder getHierarchy(boolean getHierarchy) {
      this.getHierarchy = getHierarchy;
      return this;
    }

    public ElasticSearchRequestBuilder domains(List<EntityReference> references) {
      this.domains =
          references.stream()
              .map(EntityReference::getFullyQualifiedName)
              .collect(Collectors.toList());
      return this;
    }

    public ElasticSearchRequestBuilder searchAfter(String searchAfter) {
      this.searchAfter = null;
      if (!nullOrEmpty(searchAfter)) {
        this.searchAfter = Stream.of(searchAfter.split(","))
            .toArray(Object[]::new);
      }
      return this;
    }

    public SearchRequest build() {
      return new SearchRequest(this);
    }
  }
}
