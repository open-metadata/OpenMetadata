package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;

import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.common.settings.Settings;
import es.org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.search.SearchHit;
import es.org.elasticsearch.search.SearchModule;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.xcontent.NamedXContentRegistry;
import es.org.elasticsearch.xcontent.XContentParser;
import es.org.elasticsearch.xcontent.XContentType;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;

@Slf4j
public class EsUtils {
  public static final NamedXContentRegistry esXContentRegistry;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, false, List.of());
    esXContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  public static Map<String, Object> searchEntityByKey(
      String indexAlias, String keyName, String keyValue, List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result =
        searchEntitiesByKey(indexAlias, keyName, Set.of(keyValue), 0, 1, fieldsToRemove);
    if (result.size() == 1) {
      return (Map<String, Object>) result.get(keyValue);
    } else {
      throw new SearchException(
          String.format(
              "Issue in Search Entity By Key: %s, Value: %s , Number of Hits: %s",
              keyName, keyValue, result.size()));
    }
  }

  public static Map<String, Object> searchEntitiesByKey(
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            indexAlias, null, null, keyName, keyValues, from, size, null, null, fieldsToRemove);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
      result.put(esDoc.get(FQN_FIELD).toString(), hit.getSourceAsMap());
    }
    return result;
  }

  public static es.org.elasticsearch.action.search.SearchRequest getSearchRequest(
      String indexAlias,
      String queryFilter,
      String aggName,
      String key,
      Set<String> value,
      int from,
      int size,
      Boolean deleted,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove) {
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(indexAlias));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.fetchSource(
        listOrEmpty(fieldsToInclude).toArray(String[]::new),
        listOrEmpty(fieldsToRemove).toArray(String[]::new));
    searchSourceBuilder.query(QueryBuilders.boolQuery().must(QueryBuilders.termsQuery(key, value)));
    if (!CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termsQuery(key, value))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    searchSourceBuilder.from(from);
    searchSourceBuilder.size(size);

    // This assumes here that the key has a keyword field
    if (!nullOrEmpty(aggName)) {
      searchSourceBuilder.aggregation(AggregationBuilders.terms(aggName).field(key + ".keyword"));
    }

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  public static void buildSearchSourceFilter(
      String queryFilter, SearchSourceBuilder searchSourceBuilder) {
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(esXContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
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
