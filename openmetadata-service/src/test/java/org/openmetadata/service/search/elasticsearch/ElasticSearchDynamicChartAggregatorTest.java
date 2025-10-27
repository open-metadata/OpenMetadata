package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonParser;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDynamicChartAggregatorFactory;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDynamicChartAggregatorInterface;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchLineChartAggregator;

public class ElasticSearchDynamicChartAggregatorTest extends OpenMetadataApplicationTest {

  static final long START = 1721082271000L;
  static final long END = 1721592271000L;
  private final ObjectMapper objectMapper = new ObjectMapper();

  private boolean compareRequest(String expectedJsonReq, Map<String, Object> chartDetails)
      throws IOException {
    DataInsightCustomChart chart =
        new DataInsightCustomChart().withName("random_chart_name").withChartDetails(chartDetails);
    ElasticSearchDynamicChartAggregatorInterface aggregator =
        ElasticSearchDynamicChartAggregatorFactory.getAggregator(chart);
    List<FormulaHolder> formulas = new ArrayList<>();

    Map<String, ElasticSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolder =
        new HashMap<>();
    SearchRequest searchRequest =
        aggregator.prepareSearchRequest(chart, START, END, formulas, metricFormulaHolder, false);

    String actualJsonStr = searchRequestToJson(searchRequest);
    JsonNode expectedJson = objectMapper.readTree(expectedJsonReq);
    JsonNode actualJson = objectMapper.readTree(actualJsonStr);

    return expectedJson.equals(actualJson);
  }

  private String searchRequestToJson(SearchRequest request) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    java.io.StringWriter sw = new java.io.StringWriter();
    jakarta.json.stream.JsonGenerator generator = mapper.jsonProvider().createGenerator(sw);
    request.serialize(generator, mapper);
    generator.close();
    return sw.toString();
  }

  @Test
  public void testFieldChartRequestCount() throws IOException {
    String cardString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}}";
    Map<String, Object> summaryCard1 = new LinkedHashMap<>();
    Map<String, Object> metricMapSummary = new LinkedHashMap<>();
    summaryCard1.put("type", "SummaryCard");
    metricMapSummary.put("field", "id.keyword");
    metricMapSummary.put("function", "count");
    summaryCard1.put("metrics", List.of(metricMapSummary));
    assertTrue(compareRequest(cardString1, summaryCard1));

    String lineString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}";
    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");

    Map<String, Object> metricMap = new LinkedHashMap<>();
    metricMap.put("field", "id.keyword");
    metricMap.put("function", "count");

    lineChart.put("metrics", List.of(metricMap));
    assertTrue(compareRequest(lineString, lineChart));

    String lineString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"term_1\":{\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}}}";
    Map<String, Object> lineChart1 = new LinkedHashMap<>();
    lineChart1.put("type", "LineChart");

    Map<String, Object> metricMap1 = new LinkedHashMap<>();
    metricMap1.put("field", "id.keyword");
    metricMap1.put("function", "count");
    lineChart1.put("metrics", List.of(metricMap1));

    lineChart1.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString1, lineChart1));

    String lineString2 =
        "{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter\":{\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}},\"filter\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart2 = new LinkedHashMap<>();
    lineChart2.put("type", "LineChart");
    Map<String, Object> metricMap2 = new LinkedHashMap<>();
    metricMap2.put("field", "id.keyword");
    metricMap2.put("function", "count");
    metricMap2.put(
        "filter",
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":\"admin\"}}]}}]}}}");
    lineChart2.put("metrics", List.of(metricMap2));
    assertTrue(compareRequest(lineString2, lineChart2));
  }

  @Test
  public void testFormulaChartRequest() throws IOException {
    String cardString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}";
    Map<String, Object> summaryCard = new LinkedHashMap<>();
    summaryCard.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary = new LinkedHashMap<>();
    metricMapSummary.put("formula", "count(k='id.keyword')");
    summaryCard.put("metrics", List.of(metricMapSummary));
    assertTrue(compareRequest(cardString, summaryCard));

    Map<String, Object> summaryCard1 = new LinkedHashMap<>();
    summaryCard1.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary1 = new LinkedHashMap<>();
    metricMapSummary1.put("formula", "count()");
    summaryCard1.put("metrics", List.of(metricMapSummary1));
    assertTrue(compareRequest(cardString, summaryCard1));

    String lineString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}";
    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");
    Map<String, Object> metricMap = new LinkedHashMap<>();
    metricMap.put("formula", "count(k='id.keyword')");
    lineChart.put("metrics", List.of(metricMap));
    assertTrue(compareRequest(lineString, lineChart));

    String lineString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}},\"version1\":{\"sum\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> lineChart1 = new LinkedHashMap<>();
    lineChart1.put("type", "LineChart");
    Map<String, Object> metricMap1 = new LinkedHashMap<>();
    metricMap1.put("formula", "count(k='id.keyword')+sum(k='version')");
    lineChart1.put("metrics", List.of(metricMap1));
    assertTrue(compareRequest(lineString1, lineChart1));

    String lineString2 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}},\"id.keyword1\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}";
    Map<String, Object> lineChart2 = new LinkedHashMap<>();
    lineChart2.put("type", "LineChart");
    Map<String, Object> metricMap2 = new LinkedHashMap<>();
    metricMap2.put("formula", "count(k='id.keyword')+count(k='id.keyword')");
    lineChart2.put("metrics", List.of(metricMap2));
    assertTrue(compareRequest(lineString2, lineChart2));

    String lineString3 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"term_1\":{\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}},\"id.keyword1\":{\"value_count\":{\"field\":\"id.keyword\"}}}}}}}}";
    Map<String, Object> lineChart3 = new LinkedHashMap<>();
    lineChart3.put("type", "LineChart");
    Map<String, Object> metricMap3 = new LinkedHashMap<>();
    metricMap3.put("formula", "count(k='id.keyword')+count(k='id.keyword')");
    lineChart3.put("metrics", List.of(metricMap3));
    lineChart3.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString3, lineChart3));

    String lineString4 =
        "{\"aggregations\":{\"term_1\":{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter0\":{\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}},\"filter\":{\"query_string\":{\"lenient\":true,\"query\":\"hasDescription: 1\"}}},\"filter1\":{\"aggregations\":{\"id.keyword1\":{\"value_count\":{\"field\":\"id.keyword\"}}},\"filter\":{\"query_string\":{\"lenient\":true,\"query\":\"owner.name.keyword: *\"}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart4 = new LinkedHashMap<>();
    lineChart4.put("type", "LineChart");
    Map<String, Object> metricMap4 = new LinkedHashMap<>();
    metricMap4.put(
        "formula",
        "count(k='id.keyword',q='hasDescription: 1')+count(k='id.keyword',q='owner.name.keyword: *')");
    lineChart4.put("metrics", List.of(metricMap4));
    lineChart4.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString4, lineChart4));

    Map<String, Object> lineChart41 = new LinkedHashMap<>();
    lineChart41.put("type", "LineChart");
    Map<String, Object> metricMap41 = new LinkedHashMap<>();
    metricMap41.put("formula", "count(q='hasDescription: 1')+count(q='owner.name.keyword: *')");
    lineChart41.put("metrics", List.of(metricMap41));
    lineChart41.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString4, lineChart41));

    String lineString5 =
        "{\"aggregations\":{\"term_1\":{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter0\":{\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}}},\"filter\":{\"bool\":{\"must\":[{\"query_string\":{\"lenient\":true,\"query\":\"hasDescription: 1\"}},{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"owners.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}]}}},\"filter1\":{\"aggregations\":{\"id.keyword1\":{\"value_count\":{\"field\":\"id.keyword\"}}},\"filter\":{\"bool\":{\"must\":[{\"query_string\":{\"lenient\":true,\"query\":\"owner.name.keyword: *\"}},{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"owners.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}]}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart5 = new LinkedHashMap<>();
    lineChart5.put("type", "LineChart");
    Map<String, Object> metricMap5 = new LinkedHashMap<>();
    metricMap5.put("formula", "count(q='hasDescription: 1')+count(q='owner.name.keyword: *')");
    metricMap5.put(
        "formula",
        "count(k='id.keyword',q='hasDescription: 1')+count(k='id.keyword',q='owner.name.keyword: *')");
    metricMap5.put(
        "filter",
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"owners.displayName.keyword\":\"admin\"}}]}}]}}}");
    lineChart5.put("metrics", List.of(metricMap5));
    lineChart5.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString5, lineChart5));

    String lineString6 =
        "{\"aggregations\":{\"term_1\":{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"id.keyword0\":{\"value_count\":{\"field\":\"id.keyword\"}},\"id.keyword1\":{\"value_count\":{\"field\":\"id.keyword\"}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"terms\":{\"exclude\":[\"tag\",\"glossaryTerm\"],\"field\":\"entityType.keyword\",\"size\":1000}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart6 = new LinkedHashMap<>();
    lineChart6.put("type", "LineChart");
    Map<String, Object> metricMap6 = new LinkedHashMap<>();
    metricMap6.put("formula", "count(k='id.keyword')+count(k='id.keyword')");
    lineChart6.put("metrics", List.of(metricMap6));
    lineChart6.put("groupBy", "entityType.keyword");
    lineChart6.put("excludeGroups", List.of("tag", "glossaryTerm"));
    assertTrue(compareRequest(lineString6, lineChart6));
  }

  @Test
  public void testFieldChartRequestSum() throws IOException {
    String cardString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"sum\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> summaryCard = new LinkedHashMap<>();
    summaryCard.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary1 = new LinkedHashMap<>();
    metricMapSummary1.put("field", "version");
    metricMapSummary1.put("function", "sum");
    summaryCard.put("metrics", List.of(metricMapSummary1));
    assertTrue(compareRequest(cardString, summaryCard));

    String lineString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"sum\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");
    Map<String, Object> metricMap = new LinkedHashMap<>();
    metricMap.put("field", "version");
    metricMap.put("function", "sum");
    lineChart.put("metrics", List.of(metricMap));

    assertTrue(compareRequest(lineString, lineChart));

    String lineString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"term_1\":{\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"sum\":{\"field\":\"version\"}}}}}}}}";
    Map<String, Object> lineChart1 = new LinkedHashMap<>();
    lineChart1.put("type", "LineChart");
    Map<String, Object> metricMap1 = new LinkedHashMap<>();
    metricMap1.put("field", "version");
    metricMap1.put("function", "sum");
    lineChart1.put("metrics", List.of(metricMap1));
    lineChart1.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString1, lineChart1));

    String lineString2 =
        "{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter\":{\"aggregations\":{\"version0\":{\"sum\":{\"field\":\"version\"}}},\"filter\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart2 = new LinkedHashMap<>();
    lineChart2.put("type", "LineChart");
    Map<String, Object> metricMap2 = new LinkedHashMap<>();
    metricMap2.put("field", "version");
    metricMap2.put("function", "sum");
    metricMap2.put(
        "filter",
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":\"admin\"}}]}}]}}}");
    lineChart2.put("metrics", List.of(metricMap2));
    assertTrue(compareRequest(lineString2, lineChart2));
  }

  @Test
  public void testFieldChartRequestAvg() throws IOException {
    String cardString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"avg\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> summaryCard = new LinkedHashMap<>();
    summaryCard.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary1 = new LinkedHashMap<>();
    metricMapSummary1.put("field", "version");
    metricMapSummary1.put("function", "avg");
    summaryCard.put("metrics", List.of(metricMapSummary1));
    assertTrue(compareRequest(cardString, summaryCard));

    String lineString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"avg\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");
    Map<String, Object> metricMap = new LinkedHashMap<>();
    metricMap.put("field", "version");
    metricMap.put("function", "avg");
    lineChart.put("metrics", List.of(metricMap));
    assertTrue(compareRequest(lineString, lineChart));

    String lineString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"term_1\":{\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"avg\":{\"field\":\"version\"}}}}}}}}";
    Map<String, Object> lineChart1 = new LinkedHashMap<>();
    lineChart1.put("type", "LineChart");
    Map<String, Object> metricMap1 = new LinkedHashMap<>();
    metricMap1.put("field", "version");
    metricMap1.put("function", "avg");
    lineChart1.put("metrics", List.of(metricMap1));
    lineChart1.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString1, lineChart1));

    String lineString2 =
        "{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter\":{\"aggregations\":{\"version0\":{\"avg\":{\"field\":\"version\"}}},\"filter\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart2 = new LinkedHashMap<>();
    lineChart2.put("type", "LineChart");
    Map<String, Object> metricMap2 = new LinkedHashMap<>();
    metricMap2.put("field", "version");
    metricMap2.put("function", "avg");
    metricMap2.put(
        "filter",
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":\"admin\"}}]}}]}}}");
    lineChart2.put("metrics", List.of(metricMap2));
    assertTrue(compareRequest(lineString2, lineChart2));
  }

  @Test
  public void testFieldChartRequestMin() throws IOException {
    String cardString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"min\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> summaryCard = new LinkedHashMap<>();
    summaryCard.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary1 = new LinkedHashMap<>();
    metricMapSummary1.put("field", "version");
    metricMapSummary1.put("function", "min");
    summaryCard.put("metrics", List.of(metricMapSummary1));
    assertTrue(compareRequest(cardString, summaryCard));

    String lineString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"min\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");
    Map<String, Object> metricMap = new LinkedHashMap<>();
    metricMap.put("field", "version");
    metricMap.put("function", "min");
    lineChart.put("metrics", List.of(metricMap));
    assertTrue(compareRequest(lineString, lineChart));

    String lineString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"term_1\":{\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"min\":{\"field\":\"version\"}}}}}}}}";
    Map<String, Object> lineChart1 = new LinkedHashMap<>();
    lineChart1.put("type", "LineChart");
    Map<String, Object> metricMap1 = new LinkedHashMap<>();
    metricMap1.put("field", "version");
    metricMap1.put("function", "min");
    lineChart1.put("metrics", List.of(metricMap1));
    lineChart1.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString1, lineChart1));

    String lineString2 =
        "{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter\":{\"aggregations\":{\"version0\":{\"min\":{\"field\":\"version\"}}},\"filter\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart2 = new LinkedHashMap<>();
    lineChart2.put("type", "LineChart");
    Map<String, Object> metricMap2 = new LinkedHashMap<>();
    metricMap2.put("field", "version");
    metricMap2.put("function", "min");
    metricMap2.put(
        "filter",
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":\"admin\"}}]}}]}}}");
    lineChart2.put("metrics", List.of(metricMap2));
    assertTrue(compareRequest(lineString2, lineChart2));
  }

  @Test
  public void testFieldChartRequestMax() throws IOException {
    String cardString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"max\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> summaryCard = new LinkedHashMap<>();
    summaryCard.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary1 = new LinkedHashMap<>();
    metricMapSummary1.put("field", "version");
    metricMapSummary1.put("function", "max");
    summaryCard.put("metrics", List.of(metricMapSummary1));
    assertTrue(compareRequest(cardString, summaryCard));

    String lineString =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"max\":{\"field\":\"version\"}}}}}}";
    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");
    Map<String, Object> metricMap = new LinkedHashMap<>();
    metricMap.put("field", "version");
    metricMap.put("function", "max");
    lineChart.put("metrics", List.of(metricMap));
    assertTrue(compareRequest(lineString, lineChart));

    String lineString1 =
        "{\"size\":0,\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"aggregations\":{\"term_1\":{\"terms\":{\"field\":\"entityType.keyword\",\"size\":1000},\"aggregations\":{\"metric_1\":{\"date_histogram\":{\"field\":\"@timestamp\",\"calendar_interval\":\"day\"},\"aggregations\":{\"version0\":{\"max\":{\"field\":\"version\"}}}}}}}}";
    Map<String, Object> lineChart1 = new LinkedHashMap<>();
    lineChart1.put("type", "LineChart");
    Map<String, Object> metricMap1 = new LinkedHashMap<>();
    metricMap1.put("field", "version");
    metricMap1.put("function", "max");
    lineChart1.put("metrics", List.of(metricMap1));
    lineChart1.put("groupBy", "entityType.keyword");
    assertTrue(compareRequest(lineString1, lineChart1));

    String lineString2 =
        "{\"aggregations\":{\"metric_1\":{\"aggregations\":{\"filter\":{\"aggregations\":{\"version0\":{\"max\":{\"field\":\"version\"}}},\"filter\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":{\"value\":\"admin\"}}}]}}]}}}},\"date_histogram\":{\"calendar_interval\":\"day\",\"field\":\"@timestamp\"}}},\"query\":{\"range\":{\"@timestamp\":{\"gte\":1721082271000,\"lte\":1721592271000}}},\"size\":0}";
    Map<String, Object> lineChart2 = new LinkedHashMap<>();
    lineChart2.put("type", "LineChart");
    Map<String, Object> metricMap2 = new LinkedHashMap<>();
    metricMap2.put("field", "version");
    metricMap2.put("function", "max");
    metricMap2.put(
        "filter",
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must\":[{\"term\":{\"owner.displayName.keyword\":\"admin\"}}]}}]}}}");
    lineChart2.put("metrics", List.of(metricMap2));
    assertTrue(compareRequest(lineString2, lineChart2));
  }

  public static SearchResponse<JsonData> getSearchResponseFromJson(String jsonResponse) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    JsonParser parser = mapper.jsonProvider().createParser(new StringReader(jsonResponse));
    return SearchResponse.createSearchResponseDeserializer(JsonData._DESERIALIZER)
        .deserialize(parser, mapper);
  }

  private boolean compareResponse(
      String expectedJsonRes,
      Map<String, Object> chartDetails,
      String formula,
      List<DataInsightCustomChartResult> expectedResultList) {
    SearchResponse<JsonData> response = getSearchResponseFromJson(expectedJsonRes);
    DataInsightCustomChart chart =
        new DataInsightCustomChart().withName("random_chart_name").withChartDetails(chartDetails);
    ElasticSearchDynamicChartAggregatorInterface aggregator =
        ElasticSearchDynamicChartAggregatorFactory.getAggregator(chart);
    List<FormulaHolder> formulas = new ArrayList<>();
    Map<String, ElasticSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolder =
        new HashMap<>();
    if (formula != null) {
      metricFormulaHolder.put(
          "metric_1",
          new ElasticSearchLineChartAggregator.MetricFormulaHolder(
              formula, ElasticSearchDynamicChartAggregatorInterface.getFormulaList(formula)));
    }
    DataInsightCustomChartResultList resultList =
        aggregator.processSearchResponse(chart, response, formulas, metricFormulaHolder);
    DataInsightCustomChartResultList expectedResult =
        new DataInsightCustomChartResultList().withResults(expectedResultList);
    return resultList.equals(expectedResult);
  }

  @Test
  public void testSearchResponseProcessor() {
    String sampleResponse1 =
        "{\"took\":26,\"timed_out\":false,\"_shards\":{\"total\":1,\"successful\":1,\"skipped\":0,\"failed\":0},\"hits\":{\"total\":{\"value\":132,\"relation\":\"eq\"},\"max_score\":null,\"hits\":[]},\"aggregations\":{\"date_histogram#1\":{\"buckets\":[{\"key_as_string\":\"2024-07-21T00:00:00.000Z\",\"key\":1721520000000,\"doc_count\":54,\"value_count#id.keyword0\":{\"value\":54}},{\"key_as_string\":\"2024-07-22T00:00:00.000Z\",\"key\":1721606400000,\"doc_count\":78,\"value_count#id.keyword0\":{\"value\":78}},{\"key_as_string\":\"2024-07-23T00:00:00.000Z\",\"key\":1721607000000,\"doc_count\":78}]}}}";
    Map<String, Object> summaryCard = new LinkedHashMap<>();
    summaryCard.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary1 = new LinkedHashMap<>();
    metricMapSummary1.put("formula", "count(k='id.keyword')");
    summaryCard.put("metrics", List.of(metricMapSummary1));
    List<DataInsightCustomChartResult> resultList = new ArrayList<>();
    resultList.add(new DataInsightCustomChartResult().withCount(78d).withDay(1721606400000d));
    assertTrue(compareResponse(sampleResponse1, summaryCard, "count(k='id.keyword')", resultList));

    Map<String, Object> summaryCardFunc = new LinkedHashMap<>();
    summaryCardFunc.put("type", "SummaryCard");
    Map<String, Object> metricMapSummary2 = new LinkedHashMap<>();
    metricMapSummary2.put("function", "count");
    metricMapSummary2.put("field", "id.keyword");
    summaryCardFunc.put("metrics", List.of(metricMapSummary2));
    assertTrue(compareResponse(sampleResponse1, summaryCardFunc, null, resultList));

    Map<String, Object> lineChart = new LinkedHashMap<>();
    lineChart.put("type", "LineChart");
    Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("formula", "count(k='id.keyword')");
    lineChart.put("metrics", List.of(metrics));
    List<DataInsightCustomChartResult> resultListLine = new ArrayList<>();
    resultListLine.add(new DataInsightCustomChartResult().withCount(54d).withDay(1.72152E12));
    resultListLine.add(new DataInsightCustomChartResult().withCount(78d).withDay(1.7216064E12));
    assertTrue(
        compareResponse(sampleResponse1, lineChart, "count(k='id.keyword')", resultListLine));

    Map<String, Object> lineChartFunc = new LinkedHashMap<>();
    lineChartFunc.put("type", "LineChart");
    Map<String, Object> metricsFunc = new LinkedHashMap<>();
    metricsFunc.put("function", "count");
    metricsFunc.put("field", "id.keyword");
    lineChartFunc.put("metrics", List.of(metricsFunc));
    assertTrue(compareResponse(sampleResponse1, lineChartFunc, null, resultListLine));

    String sampleResponse2 =
        "{\"took\":100,\"timed_out\":false,\"_shards\":{\"total\":1,\"successful\":1,\"skipped\":0,\"failed\":0},\"hits\":{\"total\":{\"value\":192,\"relation\":\"eq\"},\"max_score\":null,\"hits\":[]},\"aggregations\":{\"sterms#0\":{\"doc_count_error_upper_bound\":0,\"sum_other_doc_count\":0,\"buckets\":[{\"key\":\"Table\",\"doc_count\":85,\"date_histogram#metric_1\":{\"buckets\":[{\"key_as_string\":\"2024-07-18T00:00:00.000Z\",\"key\":1721260800000,\"doc_count\":5,\"filter#filter0\":{\"doc_count\":0,\"value_count#id.keyword0\":{\"value\":0}},\"value_count#id.keyword1\":{\"value\":5}}]}},{\"key\":\"Tag\",\"doc_count\":74,\"date_histogram#metric_1\":{\"buckets\":[{\"key_as_string\":\"2024-07-18T00:00:00.000Z\",\"key\":1721260800000,\"doc_count\":10,\"filter#filter0\":{\"doc_count\":10,\"value_count#id.keyword0\":{\"value\":10}},\"value_count#id.keyword1\":{\"value\":10}}]}},{\"key\":\"StoredProcedure\",\"doc_count\":15,\"date_histogram#metric_1\":{\"buckets\":[{\"key_as_string\":\"2024-07-18T00:00:00.000Z\",\"key\":1721260800000,\"doc_count\":3,\"filter#filter0\":{\"doc_count\":0,\"value_count#id.keyword0\":{\"value\":0}},\"value_count#id.keyword1\":{\"value\":3}}]}},{\"key\":\"Database\",\"doc_count\":9,\"date_histogram#metric_1\":{\"buckets\":[{\"key_as_string\":\"2024-07-18T00:00:00.000Z\",\"key\":1721260800000,\"doc_count\":1,\"filter#filter0\":{\"doc_count\":0,\"value_count#id.keyword0\":{\"value\":0}},\"value_count#id.keyword1\":{\"value\":1}}]}},{\"key\":\"DatabaseSchema\",\"doc_count\":9,\"date_histogram#metric_1\":{\"buckets\":[{\"key_as_string\":\"2024-07-18T00:00:00.000Z\",\"key\":1721260800000,\"doc_count\":1,\"filter#filter0\":{\"doc_count\":0,\"value_count#id.keyword0\":{\"value\":0}},\"value_count#id.keyword1\":{\"value\":1}},{\"key_as_string\":\"2024-07-22T00:00:00.000Z\",\"key\":1721606400000,\"doc_count\":1,\"filter#filter0\":{\"doc_count\":0,\"value_count#id.keyword0\":{\"value\":0}},\"value_count#id.keyword1\":{\"value\":0}}]}}]}}}";
    Map<String, Object> lineChartFormula = new LinkedHashMap<>();
    lineChartFormula.put("type", "LineChart");
    Map<String, Object> metricsFormula = new LinkedHashMap<>();
    metricsFormula.put(
        "formula", "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100");
    lineChartFormula.put("metrics", List.of(metricsFormula));
    lineChartFormula.put("groupBy", "entityType.keyword");
    List<DataInsightCustomChartResult> resultListLineFormula = new ArrayList<>();
    resultListLineFormula.add(
        new DataInsightCustomChartResult().withCount(0d).withDay(1.7212608E12).withGroup("Table"));
    resultListLineFormula.add(
        new DataInsightCustomChartResult().withCount(100d).withDay(1.7212608E12).withGroup("Tag"));
    resultListLineFormula.add(
        new DataInsightCustomChartResult()
            .withCount(0d)
            .withDay(1.7212608E12)
            .withGroup("StoredProcedure"));
    resultListLineFormula.add(
        new DataInsightCustomChartResult()
            .withCount(0d)
            .withDay(1.7212608E12)
            .withGroup("Database"));
    resultListLineFormula.add(
        new DataInsightCustomChartResult()
            .withCount(0d)
            .withDay(1.7212608E12)
            .withGroup("DatabaseSchema"));
    resultListLineFormula.add(
        new DataInsightCustomChartResult()
            .withCount(0d)
            .withDay(1.7216064E12)
            .withGroup("DatabaseSchema"));
    assertTrue(
        compareResponse(
            sampleResponse2,
            lineChartFormula,
            "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100",
            resultListLineFormula));
  }
}
