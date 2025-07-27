package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchUtils.getLineageDirectionAggregationField;

import com.nimbusds.jose.util.Pair;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
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

@Slf4j
public class OsUtils {
  public static final NamedXContentRegistry osXContentRegistry;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, List.of());
    osXContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
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

  public static os.org.opensearch.action.search.SearchResponse searchEntities(
      String index, String queryFilter, Boolean deleted) throws IOException {
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

  public static void buildSearchSourceFilter(
      String queryFilter, SearchSourceBuilder searchSourceBuilder) {
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(osXContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
  }
}
