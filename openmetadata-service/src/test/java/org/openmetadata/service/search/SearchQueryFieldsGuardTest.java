package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchSourceBuilderFactory;
import org.openmetadata.service.search.opensearch.OpenSearchSourceBuilderFactory;
import org.openmetadata.service.util.EntityUtil;

/**
 * Every text query sent to the search engine must name its fields. A query_string,
 * simple_query_string or multi_match without fields searches every field in the mapping, so its
 * clause count grows with the mapping and can exceed the cluster's max_clause_count (#34380).
 */
class SearchQueryFieldsGuardTest {
  private static final List<String> TEXT_QUERIES =
      List.of("query_string", "simple_query_string", "multi_match");
  private static final List<String> INPUTS =
      List.of(
          "customer orders",
          "exactec2274b037459fc6",
          "columnNames:address AND orders",
          "*cust*",
          "\"monthly revenue\"");

  /**
   * Field-less query_string constructions outside the source builders, per class. They take
   * field:value filters built by OpenMetadata, run on report indexes without n-gram fields, or
   * are the match-all {@code *}. A new one fails this test: give it explicit fields instead.
   */
  private static final Map<String, Integer> ALLOWED_FIELDLESS =
      Map.of(
          // "*" match-all, DQ report aggregations and internal field:value aggregation filters
          "OpenSearchAggregationManager", 5,
          "ElasticSearchAggregationManager", 5,
          // Data Insights report indexes: chart query filters and formula filters
          "OpenSearchDataInsightAggregatorManager", 1,
          "ElasticSearchDataInsightAggregatorManager", 1,
          "OpenSearchDynamicChartAggregatorInterface", 2,
          "ElasticSearchDynamicChartAggregatorInterface", 2,
          // the one-argument helper, used by the cost-analysis builder on report indexes
          "OpenSearchQueryBuilder", 1,
          "ElasticQueryBuilder", 1);

  /** Cost-analysis report indexes: no n-gram fields and few fields; see the allow-list above. */
  private static final List<String> EXEMPT_INDEXES =
      List.of("raw_cost_analysis_report_data_index", "aggregated_cost_analysis_report_data_index");

  private static SearchSettings searchSettings;
  private MockedStatic<Entity> entity;

  @BeforeAll
  static void load() throws IOException {
    IndexMappingLoader.init();
    List<String> files =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    searchSettings =
        JsonUtils.readValue(
            CommonUtil.getResourceAsStream(
                EntityRepository.class.getClassLoader(), files.getFirst()),
            SearchSettings.class);
  }

  @BeforeEach
  void mockRepository() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexNameWithoutAlias(anyString())).thenAnswer(i -> i.getArgument(0));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
  }

  @AfterEach
  void closeMocks() {
    entity.close();
  }

  @Test
  void sourceBuildersNameTheirFieldsForEveryIndex() throws Exception {
    OpenSearchSourceBuilderFactory openSearch = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory elastic =
        new ElasticSearchSourceBuilderFactory(searchSettings);
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    List<String> offenders = new ArrayList<>();
    for (String index : indexNames()) {
      for (String input : INPUTS) {
        for (boolean freeText : List.of(false, true)) {
          String where = index + " [" + input + "]" + (freeText ? " freeText" : "");
          collectFieldless(
              "opensearch " + where,
              JsonUtils.readTree(
                  openSearch
                      .getSearchSourceBuilderV2(index, input, 0, 10, false, true, freeText)
                      .query()
                      .toJsonString()),
              offenders);
          StringWriter writer = new StringWriter();
          try (var generator = mapper.jsonProvider().createGenerator(writer)) {
            elastic
                .getSearchSourceBuilderV2(index, input, 0, 10, false, true, freeText)
                .query()
                .serialize(generator, mapper);
          }
          collectFieldless(
              "elasticsearch " + where, JsonUtils.readTree(writer.toString()), offenders);
        }
      }
    }
    assertTrue(offenders.isEmpty(), "text queries without fields: " + offenders);
  }

  @Test
  void fieldlessQueryStringsStayOnTheAllowList() throws IOException {
    Map<String, Integer> found = new TreeMap<>();
    Path root = Path.of("src/main/java/org/openmetadata/service/search");
    try (Stream<Path> files = Files.walk(root)) {
      for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
        int count = countFieldlessQueryStrings(Files.readString(file));
        if (count > 0) {
          found.put(file.getFileName().toString().replace(".java", ""), count);
        }
      }
    }
    assertEquals(new TreeMap<>(ALLOWED_FIELDLESS), found);
  }

  private static List<String> indexNames() {
    TreeSet<String> names = new TreeSet<>(List.of("all", "dataAsset"));
    for (IndexMapping mapping : IndexMappingLoader.getInstance().getIndexMapping().values()) {
      names.add(mapping.getIndexName());
    }
    names.removeAll(EXEMPT_INDEXES);
    return new ArrayList<>(names);
  }

  private static void collectFieldless(String where, JsonNode query, List<String> offenders) {
    for (String type : TEXT_QUERIES) {
      for (JsonNode node : query.findValues(type)) {
        if (!node.path("fields").isArray() || node.path("fields").isEmpty()) {
          offenders.add(where + " " + type);
        }
      }
    }
  }

  /** query_string constructions whose arguments set neither fields nor a default field. */
  private static int countFieldlessQueryStrings(String source) {
    int count = 0;
    int from = source.indexOf(".queryString(");
    while (from >= 0) {
      String arguments = balancedArguments(source, from + ".queryString".length());
      if (!arguments.contains("fields(") && !arguments.contains("defaultField(")) {
        count++;
      }
      from = source.indexOf(".queryString(", from + 1);
    }
    return count;
  }

  private static String balancedArguments(String source, int open) {
    int depth = 0;
    for (int i = open; i < source.length(); i++) {
      char c = source.charAt(i);
      if (c == '(') {
        depth++;
      } else if (c == ')') {
        depth--;
      }
      if (depth == 0) {
        return source.substring(open + 1, i);
      }
    }
    return source.substring(open);
  }
}
