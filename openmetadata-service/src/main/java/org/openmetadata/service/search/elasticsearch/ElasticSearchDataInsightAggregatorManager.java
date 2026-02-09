package org.openmetadata.service.search.elasticsearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;
import es.co.elastic.clients.elasticsearch._types.mapping.Property;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.indices.GetMappingResponse;
import es.co.elastic.clients.json.JsonData;
import io.micrometer.core.instrument.Timer;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.text.WordUtils;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.search.DataInsightAggregatorClient;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUnusedAssetsCountAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUsedvsUnusedAssetsCountAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUsedvsUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDailyActiveUsersAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDynamicChartAggregatorFactory;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDynamicChartAggregatorInterface;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchLineChartAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchMostActiveUsersAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchMostViewedEntitiesAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchPageViewsByEntitiesAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchUnusedAssetsAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.QueryCostRecordsAggregator;

@Slf4j
public class ElasticSearchDataInsightAggregatorManager implements DataInsightAggregatorClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;

  public ElasticSearchDataInsightAggregatorManager(ElasticsearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public DataInsightCustomChartResultList buildDIChart(
      @NotNull DataInsightCustomChart diChart, long start, long end, boolean live)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot build DI chart.");
      return null;
    }

    ElasticSearchDynamicChartAggregatorInterface aggregator =
        ElasticSearchDynamicChartAggregatorFactory.getAggregator(diChart);
    if (aggregator != null) {
      List<FormulaHolder> formulas = new ArrayList<>();
      Map<String, ElasticSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolder =
          new HashMap<>();
      SearchRequest searchRequest =
          aggregator.prepareSearchRequest(diChart, start, end, formulas, metricFormulaHolder, live);
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = client.search(searchRequest, JsonData.class);
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }
      return aggregator.processSearchResponse(
          diChart, searchResponse, formulas, metricFormulaHolder);
    }
    return null;
  }

  @Override
  public List<Map<String, String>> fetchDIChartFields() {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot fetch DI chart fields.");
      return new ArrayList<>();
    }

    List<Map<String, String>> fields = new ArrayList<>();
    for (String type : DataInsightSystemChartRepository.dataAssetTypes) {
      try {
        String indexName =
            DataInsightSystemChartRepository.getDataInsightsIndexPrefix()
                + "-"
                + type.toLowerCase();

        GetMappingResponse response = client.indices().getMapping(m -> m.index(indexName));

        var indexMappingRecord = response.get(indexName);
        if (indexMappingRecord != null && indexMappingRecord.mappings().properties() != null) {
          getFieldNames(indexMappingRecord.mappings().properties(), "", fields, type);
        }
      } catch (Exception e) {
        LOG.error("Failed to get mappings for type: {}", type, e);
      }
    }
    return fields;
  }

  @Override
  public Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot list DI chart result.");
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("ElasticSearch client is not available")
          .build();
    }

    SearchRequest searchRequest =
        buildSearchRequest(
            startTs,
            endTs,
            tier,
            team,
            dataInsightChartName,
            size,
            from,
            queryFilter,
            dataReportIndex);
    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
    return Response.status(OK)
        .entity(processDataInsightChartResult(searchResponse, dataInsightChartName))
        .build();
  }

  @Override
  public QueryCostSearchResult getQueryCostRecords(String serviceName) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot get query cost records.");
      return null;
    }

    SearchRequest searchRequest = QueryCostRecordsAggregator.getQueryCostRecords(serviceName);
    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
    return QueryCostRecordsAggregator.parseQueryCostResponse(searchResponse);
  }

  private void getFieldNames(
      Map<String, Property> properties,
      String prefix,
      List<Map<String, String>> fieldList,
      String entityType) {

    if (properties == null) {
      return;
    }

    for (Map.Entry<String, Property> entry : properties.entrySet()) {
      String fieldKey = entry.getKey();
      Property property = entry.getValue();

      if (property._kind() == null) {
        continue;
      }

      String type = property._kind().name().toLowerCase();
      String baseFieldName = prefix.isEmpty() ? fieldKey : prefix + "." + fieldKey;
      String adjustedFieldName = baseFieldName;

      if ("text".equals(type)) {
        if (property.isText()
            && property.text().fields() != null
            && property.text().fields().containsKey("keyword")) {
          adjustedFieldName = baseFieldName + ".keyword";
        }
      }

      String displayName = WordUtils.capitalize(baseFieldName.replace(".", " "));

      final String finalFieldName = adjustedFieldName;

      // Only add non-object/nested leaf fields
      if (!"object".equals(type) && !"nested".equals(type)) {
        if (fieldList.stream().noneMatch(e -> e.get("name").equals(finalFieldName))) {
          Map<String, String> fieldMap = new HashMap<>();
          fieldMap.put("name", finalFieldName);
          fieldMap.put("displayName", displayName);
          fieldMap.put("type", type);
          fieldMap.put("entityType", entityType);
          fieldList.add(fieldMap);
        }
      }

      // Recursively process nested or object fields
      if (property.isObject() && property.object().properties() != null) {
        getFieldNames(property.object().properties(), baseFieldName, fieldList, entityType);
      } else if (property.isNested() && property.nested().properties() != null) {
        getFieldNames(property.nested().properties(), baseFieldName, fieldList, entityType);
      }
    }
  }

  private DataInsightChartResult processDataInsightChartResult(
      SearchResponse<JsonData> searchResponse,
      DataInsightChartResult.DataInsightChartType dataInsightChartType) {
    DataInsightAggregatorInterface processor =
        createDataAggregator(searchResponse, dataInsightChartType);
    return processor.process(dataInsightChartType);
  }

  private DataInsightAggregatorInterface createDataAggregator(
      SearchResponse<JsonData> response,
      DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws IllegalArgumentException {
    return switch (dataInsightChartType) {
      case DAILY_ACTIVE_USERS -> new ElasticSearchDailyActiveUsersAggregator(
          response.aggregations());
      case PAGE_VIEWS_BY_ENTITIES -> new ElasticSearchPageViewsByEntitiesAggregator(
          response.aggregations());
      case MOST_ACTIVE_USERS -> new ElasticSearchMostActiveUsersAggregator(response.aggregations());
      case MOST_VIEWED_ENTITIES -> new ElasticSearchMostViewedEntitiesAggregator(
          response.aggregations());
      case UNUSED_ASSETS -> new ElasticSearchUnusedAssetsAggregator(response.hits());
      case AGGREGATED_UNUSED_ASSETS_SIZE -> new ElasticSearchAggregatedUnusedAssetsSizeAggregator(
          response.aggregations());
      case AGGREGATED_UNUSED_ASSETS_COUNT -> new ElasticSearchAggregatedUnusedAssetsCountAggregator(
          response.aggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT -> new ElasticSearchAggregatedUsedvsUnusedAssetsCountAggregator(
          response.aggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE -> new ElasticSearchAggregatedUsedvsUnusedAssetsSizeAggregator(
          response.aggregations());
    };
  }

  private SearchRequest buildSearchRequest(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex) {

    SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder();

    String indexName = Entity.getSearchRepository().getIndexOrAliasName(dataReportIndex);
    searchRequestBuilder.index(indexName);

    BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();

    if (team != null
        && DataInsightChartRepository.SUPPORTS_TEAM_FILTER.contains(dataInsightChartName.value())) {
      List<String> teamArray = Arrays.asList(team.split("\\s*,\\s*"));
      List<FieldValue> teamValues =
          teamArray.stream().map(FieldValue::of).collect(Collectors.toList());

      Query teamQuery =
          Query.of(
              q ->
                  q.terms(
                      t ->
                          t.field(DataInsightChartRepository.DATA_TEAM)
                              .terms(tv -> tv.value(teamValues))));
      boolQueryBuilder.must(teamQuery);
    }

    if (tier != null
        && DataInsightChartRepository.SUPPORTS_TIER_FILTER.contains(dataInsightChartName.value())) {
      List<String> tierArray = Arrays.asList(tier.split("\\s*,\\s*"));
      List<FieldValue> tierValues =
          tierArray.stream().map(FieldValue::of).collect(Collectors.toList());

      Query tierQuery =
          Query.of(
              q ->
                  q.terms(
                      t ->
                          t.field(DataInsightChartRepository.DATA_ENTITY_TIER)
                              .terms(tv -> tv.value(tierValues))));
      boolQueryBuilder.must(tierQuery);
    }

    if (!DataInsightChartRepository.SUPPORTS_NULL_DATE_RANGE.contains(
        dataInsightChartName.value())) {
      if (startTs == null || endTs == null) {
        throw new IllegalArgumentException(
            String.format(
                "Start and End date are required for chart type %s", dataInsightChartName));
      }

      Query rangeQuery =
          Query.of(
              q ->
                  q.range(
                      r ->
                          r.untyped(
                              u ->
                                  u.field(DataInsightChartRepository.TIMESTAMP)
                                      .gte(
                                          es.co.elastic.clients.json.JsonData.of(
                                              String.valueOf(startTs)))
                                      .lte(
                                          es.co.elastic.clients.json.JsonData.of(
                                              String.valueOf(endTs))))));
      boolQueryBuilder.must(rangeQuery);
    }

    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        Query customFilter;
        if (queryFilter.trim().startsWith("{")) {
          String queryToProcess = EsUtils.parseJsonQuery(queryFilter);
          customFilter = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
        } else {
          customFilter = Query.of(q -> q.queryString(qs -> qs.query(queryFilter)));
        }
        boolQueryBuilder.filter(customFilter);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    searchRequestBuilder.query(Query.of(q -> q.bool(boolQueryBuilder.build())));

    if (!dataInsightChartName
        .toString()
        .equalsIgnoreCase(DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS.toString())) {
      Map<String, Aggregation> aggregations = buildQueryAggregation(dataInsightChartName);
      searchRequestBuilder.aggregations(aggregations);
      searchRequestBuilder.size(0);
      searchRequestBuilder.source(s -> s.fetch(false));
      searchRequestBuilder.timeout("30s");
    } else {
      searchRequestBuilder.source(s -> s.fetch(true));
      searchRequestBuilder.from(from);
      searchRequestBuilder.size(size);
      searchRequestBuilder.sort(
          so ->
              so.field(
                  f ->
                      f.field("data.lifeCycle.accessed.timestamp")
                          .order(es.co.elastic.clients.elasticsearch._types.SortOrder.Desc)));
    }

    return searchRequestBuilder.build();
  }

  private Map<String, Aggregation> buildQueryAggregation(
      DataInsightChartResult.DataInsightChartType dataInsightChartName) {
    Map<String, Aggregation> aggregations = new HashMap<>();

    switch (dataInsightChartName) {
      case DAILY_ACTIVE_USERS:
        aggregations.put(
            DataInsightChartRepository.TIMESTAMP,
            Aggregation.of(
                a ->
                    a.dateHistogram(
                        dh ->
                            dh.field(DataInsightChartRepository.TIMESTAMP)
                                .calendarInterval(CalendarInterval.Day))));
        break;

      case PAGE_VIEWS_BY_ENTITIES:
        Map<String, Aggregation> subAggs = new HashMap<>();
        subAggs.put(
            DataInsightChartRepository.ENTITY_TYPE,
            Aggregation.of(
                a ->
                    a.terms(t -> t.field(DataInsightChartRepository.DATA_ENTITY_TYPE).size(1000))
                        .aggregations(
                            Map.of(
                                DataInsightChartRepository.PAGE_VIEWS,
                                Aggregation.of(
                                    sa ->
                                        sa.sum(
                                            s ->
                                                s.field(
                                                    DataInsightChartRepository.DATA_VIEWS)))))));

        aggregations.put(
            DataInsightChartRepository.TIMESTAMP,
            Aggregation.of(
                a ->
                    a.dateHistogram(
                            dh ->
                                dh.field(DataInsightChartRepository.TIMESTAMP)
                                    .calendarInterval(CalendarInterval.Day))
                        .aggregations(subAggs)));
        break;

      case MOST_VIEWED_ENTITIES:
        Map<String, Aggregation> mostViewedSubAggs = new HashMap<>();
        mostViewedSubAggs.put(
            DataInsightChartRepository.PAGE_VIEWS,
            Aggregation.of(a -> a.sum(s -> s.field(DataInsightChartRepository.DATA_VIEWS))));
        mostViewedSubAggs.put(
            DataInsightChartRepository.OWNER,
            Aggregation.of(a -> a.terms(t -> t.field(DataInsightChartRepository.DATA_OWNER))));
        mostViewedSubAggs.put(
            DataInsightChartRepository.ENTITY_TYPE,
            Aggregation.of(
                a -> a.terms(t -> t.field(DataInsightChartRepository.DATA_ENTITY_TYPE))));
        mostViewedSubAggs.put(
            DataInsightChartRepository.ENTITY_HREF,
            Aggregation.of(
                a -> a.terms(t -> t.field(DataInsightChartRepository.DATA_ENTITY_HREF))));

        aggregations.put(
            DataInsightChartRepository.ENTITY_FQN,
            Aggregation.of(
                a ->
                    a.terms(t -> t.field(DataInsightChartRepository.DATA_ENTITY_FQN).size(10))
                        .aggregations(mostViewedSubAggs)));
        break;

      case MOST_ACTIVE_USERS:
        Map<String, Aggregation> mostActiveSubAggs = new HashMap<>();
        mostActiveSubAggs.put(
            DataInsightChartRepository.SESSIONS,
            Aggregation.of(a -> a.sum(s -> s.field(DataInsightChartRepository.DATA_SESSIONS))));
        mostActiveSubAggs.put(
            DataInsightChartRepository.PAGE_VIEWS,
            Aggregation.of(a -> a.sum(s -> s.field(DataInsightChartRepository.DATA_PAGE_VIEWS))));
        mostActiveSubAggs.put(
            DataInsightChartRepository.LAST_SESSION,
            Aggregation.of(a -> a.max(m -> m.field(DataInsightChartRepository.DATA_LAST_SESSION))));
        mostActiveSubAggs.put(
            DataInsightChartRepository.SESSION_DURATION,
            Aggregation.of(
                a -> a.sum(s -> s.field(DataInsightChartRepository.DATA_TOTAL_SESSION_DURATION))));
        mostActiveSubAggs.put(
            DataInsightChartRepository.TEAM,
            Aggregation.of(a -> a.terms(t -> t.field(DataInsightChartRepository.DATA_TEAM))));

        aggregations.put(
            DataInsightChartRepository.USER_NAME,
            Aggregation.of(
                a ->
                    a.terms(t -> t.field(DataInsightChartRepository.DATA_USER_NAME).size(10))
                        .aggregations(mostActiveSubAggs)));
        break;

      case AGGREGATED_UNUSED_ASSETS_COUNT:
      case AGGREGATED_UNUSED_ASSETS_SIZE:
        boolean isSize =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_UNUSED_ASSETS_SIZE);
        String[] types = new String[] {"frequentlyUsedDataAssets", "unusedDataAssets"};
        String fieldType = isSize ? "size" : "count";

        Map<String, Aggregation> assetAggs = new HashMap<>();
        for (String type : types) {
          assetAggs.put(
              String.format("%sThreeDays", type),
              Aggregation.of(
                  a ->
                      a.sum(s -> s.field(String.format("data.%s.%s.threeDays", type, fieldType)))));
          assetAggs.put(
              String.format("%sSevenDays", type),
              Aggregation.of(
                  a ->
                      a.sum(s -> s.field(String.format("data.%s.%s.sevenDays", type, fieldType)))));
          assetAggs.put(
              String.format("%sFourteenDays", type),
              Aggregation.of(
                  a ->
                      a.sum(
                          s ->
                              s.field(String.format("data.%s.%s.fourteenDays", type, fieldType)))));
          assetAggs.put(
              String.format("%sThirtyDays", type),
              Aggregation.of(
                  a ->
                      a.sum(
                          s -> s.field(String.format("data.%s.%s.thirtyDays", type, fieldType)))));
          assetAggs.put(
              String.format("%sSixtyDays", type),
              Aggregation.of(
                  a ->
                      a.sum(s -> s.field(String.format("data.%s.%s.sixtyDays", type, fieldType)))));
        }

        aggregations.put(
            DataInsightChartRepository.TIMESTAMP,
            Aggregation.of(
                a ->
                    a.dateHistogram(
                            dh ->
                                dh.field(DataInsightChartRepository.TIMESTAMP)
                                    .calendarInterval(CalendarInterval.Day))
                        .aggregations(assetAggs)));
        break;

      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE:
      case AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT:
        boolean isSizeReport =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE);
        String totalFieldString = isSizeReport ? "totalSize" : "totalCount";

        Map<String, Aggregation> usedVsUnusedAggs = new HashMap<>();
        usedVsUnusedAggs.put(
            "totalUnused",
            Aggregation.of(
                a ->
                    a.sum(
                        s ->
                            s.field(String.format("data.unusedDataAssets.%s", totalFieldString)))));
        usedVsUnusedAggs.put(
            "totalUsed",
            Aggregation.of(
                a ->
                    a.sum(
                        s ->
                            s.field(
                                String.format(
                                    "data.frequentlyUsedDataAssets.%s", totalFieldString)))));

        aggregations.put(
            DataInsightChartRepository.TIMESTAMP,
            Aggregation.of(
                a ->
                    a.dateHistogram(
                            dh ->
                                dh.field(DataInsightChartRepository.TIMESTAMP)
                                    .calendarInterval(CalendarInterval.Day))
                        .aggregations(usedVsUnusedAggs)));
        break;

      default:
        throw new IllegalArgumentException(
            String.format("Invalid dataInsightChartType name %s", dataInsightChartName));
    }

    return aggregations;
  }
}
