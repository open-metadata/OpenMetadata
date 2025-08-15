package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchUtils.DOWNSTREAM_ENTITY_RELATIONSHIP_KEY;
import static org.openmetadata.service.search.SearchUtils.getLineageDirectionAggregationField;

import com.nimbusds.jose.util.Pair;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchUtils;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.common.settings.Settings;
import os.org.opensearch.common.xcontent.LoggingDeprecationHandler;
import os.org.opensearch.common.xcontent.NamedXContentRegistry;
import os.org.opensearch.common.xcontent.XContentParser;
import os.org.opensearch.common.xcontent.XContentType;
import os.org.opensearch.index.query.BoolQueryBuilder;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.search.SearchHit;
import os.org.opensearch.search.SearchModule;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.builder.SearchSourceBuilder;
import os.org.opensearch.search.sort.FieldSortBuilder;
import os.org.opensearch.search.sort.SortOrder;

@Slf4j
public class OsUtils {
  public static final NamedXContentRegistry osXContentRegistry;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, List.of());
    osXContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  public static Map<String, Object> searchEREntityByKey(
      EntityRelationshipDirection direction,
      String indexAlias,
      String keyName,
      Pair<String, String> hasToFqnPair,
      List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result =
        searchEREntitiesByKey(
            direction, indexAlias, keyName, Set.of(hasToFqnPair.getLeft()), 0, 1, fieldsToRemove);
    if (result.size() == 1) {
      return (Map<String, Object>) result.get(hasToFqnPair.getRight());
    } else {
      throw new SearchException(
          String.format(
              "Issue in Search Entity By Key: %s, Value Fqn: %s , Number of Hits: %s",
              keyName, hasToFqnPair.getRight(), result.size()));
    }
  }

  public static Map<String, Object> searchEREntitiesByKey(
      EntityRelationshipDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToRemove)
      throws IOException {
    RestHighLevelClient client =
        (RestHighLevelClient) Entity.getSearchRepository().getSearchClient().getClient();
    Map<String, Object> result = new HashMap<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            direction,
            indexAlias,
            null,
            null,
            Map.of(keyName, keyValues),
            from,
            size,
            null,
            null,
            fieldsToRemove);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
      result.put(esDoc.get(FQN_FIELD).toString(), hit.getSourceAsMap());
    }
    return result;
  }

  public static os.org.opensearch.action.search.SearchRequest getSearchRequest(
      EntityRelationshipDirection direction,
      String indexAlias,
      String queryFilter,
      String aggName,
      Map<String, Set<String>> keysAndValues,
      int from,
      int size,
      Boolean deleted,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove) {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(indexAlias));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.fetchSource(
        listOrEmpty(fieldsToInclude).toArray(String[]::new),
        listOrEmpty(fieldsToRemove).toArray(String[]::new));

    searchSourceBuilder.query(getBoolQueriesWithShould(keysAndValues));
    if (!CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(getBoolQueriesWithShould(keysAndValues))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    searchSourceBuilder.from(from);
    searchSourceBuilder.size(size);

    if (!nullOrEmpty(aggName)) {
      searchSourceBuilder.aggregation(
          AggregationBuilders.terms(aggName)
              .field(getEntityRelationshipAggregationField(direction)));
    }

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  public static String getEntityRelationshipAggregationField(
      EntityRelationshipDirection direction) {
    return direction == EntityRelationshipDirection.UPSTREAM
        ? FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD
        : DOWNSTREAM_ENTITY_RELATIONSHIP_KEY;
  }

  public static Map<String, Object> searchEntityByKey(
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Pair<String, String> hasToFqnPair,
      List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result =
        searchEntitiesByKey(
            direction, indexAlias, keyName, Set.of(hasToFqnPair.getLeft()), 0, 1, fieldsToRemove);
    if (result.size() == 1) {
      return (Map<String, Object>) result.get(hasToFqnPair.getRight());
    } else {
      throw new SearchException(
          String.format(
              "Issue in Search Entity By Key: %s, Value Fqn: %s , Number of Hits: %s",
              keyName, hasToFqnPair.getRight(), result.size()));
    }
  }

  public static Map<String, Object> searchEntitiesByKey(
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToRemove)
      throws IOException {
    RestHighLevelClient client =
        (RestHighLevelClient) Entity.getSearchRepository().getSearchClient().getClient();
    Map<String, Object> result = new HashMap<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            direction,
            indexAlias,
            null,
            null,
            Map.of(keyName, keyValues),
            from,
            size,
            null,
            null,
            fieldsToRemove);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
      result.put(esDoc.get(FQN_FIELD).toString(), hit.getSourceAsMap());
    }
    return result;
  }

  public static os.org.opensearch.action.search.SearchRequest getSearchRequest(
      LineageDirection direction,
      String indexAlias,
      String queryFilter,
      String aggName,
      Map<String, Set<String>> keysAndValues,
      int from,
      int size,
      Boolean deleted,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove) {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(indexAlias));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.fetchSource(
        listOrEmpty(fieldsToInclude).toArray(String[]::new),
        listOrEmpty(fieldsToRemove).toArray(String[]::new));

    searchSourceBuilder.query(getBoolQueriesWithShould(keysAndValues));
    if (!CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(getBoolQueriesWithShould(keysAndValues))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    searchSourceBuilder.from(from);
    searchSourceBuilder.size(size);

    // This assumes here that the key has a keyword field
    if (!nullOrEmpty(aggName)) {
      searchSourceBuilder.aggregation(
          AggregationBuilders.terms(aggName).field(getLineageDirectionAggregationField(direction)));
    }

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private static BoolQueryBuilder getBoolQueriesWithShould(Map<String, Set<String>> keysAndValues) {
    BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
    keysAndValues.forEach((key, values) -> boolQuery.should(QueryBuilders.termsQuery(key, values)));
    boolQuery.minimumShouldMatch(1);
    return boolQuery;
  }

  public static SearchResponse searchEntities(String index, String queryFilter, Boolean deleted)
      throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery("deleted", !nullOrEmpty(deleted) && deleted)));

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder.size(10000));

    RestHighLevelClient client =
        (RestHighLevelClient) Entity.getSearchRepository().getSearchClient().getClient();
    return client.search(searchRequest, RequestOptions.DEFAULT);
  }

  /**
   * Builds and applies search source filters for OpenSearch queries with SQL injection protection.
   *
   * <p><strong>Security Enhancement:</strong> This method was modified to include SQL injection sanitization
   * as part of the security remediation for 42 vulnerable instances across search endpoints.
   *
   * <p>The method now sanitizes the queryFilter parameter before parsing to prevent malicious input
   * from being processed by the vulnerable SearchSourceBuilder.fromXContent() method.
   *
   * @param queryFilter Raw query filter string from HTTP request parameters (potentially malicious)
   * @param searchSourceBuilder OpenSearch search source builder to apply filters to
   *
   * @see SearchUtils#sanitizeQueryParameter(String)
   */
  public static void buildSearchSourceFilter(
      String queryFilter, SearchSourceBuilder searchSourceBuilder) {
    // SECURITY: Sanitize input to prevent SQL injection attacks before parsing JSON
    // This addresses vulnerability instances where user input was directly parsed without
    // validation
    String sanitizedFilter = SearchUtils.sanitizeQueryParameter(queryFilter);

    if (!nullOrEmpty(sanitizedFilter) && !sanitizedFilter.equals("{}")) {
      try {
        // Parse the sanitized filter string into OpenSearch QueryBuilder
        // Note: SearchSourceBuilder.fromXContent() was the vulnerable method in the original code
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(
                    osXContentRegistry, LoggingDeprecationHandler.INSTANCE, sanitizedFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();

        // Combine the parsed filter with the existing query using boolean logic
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        // Log parsing errors but continue execution - this handles malformed legitimate queries
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
  }

  public static SearchResponse searchEntitiesWithLimitOffset(
      String index, String queryFilter, int offset, int limit, boolean deleted) throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(index);
    os.org.opensearch.search.builder.SearchSourceBuilder searchSourceBuilder =
        new os.org.opensearch.search.builder.SearchSourceBuilder();
    searchSourceBuilder.from(offset).size(limit);
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery("deleted", !nullOrEmpty(deleted) && deleted)));
    FieldSortBuilder nameSort =
        new FieldSortBuilder("name.keyword").order(SortOrder.ASC).unmappedType("keyword");
    searchSourceBuilder.sort(nameSort);
    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder);

    // Execute the search
    RestHighLevelClient client =
        (RestHighLevelClient) Entity.getSearchRepository().getSearchClient().getClient();
    return client.search(searchRequest, RequestOptions.DEFAULT);
  }
}
