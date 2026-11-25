package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.util.Locale;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.search.SearchClient.SearchClientException;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
class MetricExpressionMappingIT {
  private static final String METRIC_EXPRESSION = "metricExpression";
  private static final String LEGACY_EXPRESSION = "expression";
  private static final String CODE = "code";
  private static final String LANGUAGE = "language";
  private static final String PROPERTIES = "properties";
  private static final String MAPPING_PROPERTIES = "/mappings/" + PROPERTIES;
  private static final String METRIC_EXPRESSION_MAPPING =
      MAPPING_PROPERTIES + "/" + METRIC_EXPRESSION;
  private static final String LEGACY_EXPRESSION_MAPPING =
      MAPPING_PROPERTIES + "/" + LEGACY_EXPRESSION;
  private static final String CODE_TYPE_MAPPING =
      METRIC_EXPRESSION_MAPPING + "/" + PROPERTIES + "/" + CODE + "/type";
  private static final String EXPRESSION_CODE = METRIC_EXPRESSION + "." + CODE;
  private static final String EXPRESSION_LANGUAGE = METRIC_EXPRESSION + "." + LANGUAGE;
  private static final String KEYWORD_SUFFIX = ".keyword";
  private static final String HITS_TOTAL = "/hits/total/value";
  private static final String SQL = "SQL";
  private static final String TERM_QUERY = "term";
  private static final String LEGACY_AMOUNT = "legacy_amount";
  private static final String LEGACY_CODE = "SUM(" + LEGACY_AMOUNT + ")";
  private static final String CURRENT_CODE = "SUM(current_amount)";
  private static final String FRESH_CODE = "SUM(fresh_amount)";
  private static final String DATE_SHAPED_CODE = "2026-01-01";

  @BeforeAll
  static void requireEmbeddedSearch() {
    assumeTrue(
        !OssTestServer.defaultHandle().isExternal(),
        "Mapping tests write directly to embedded search");
  }

  @Test
  void explicitMappingAcceptsExistingDynamicAndLegacyExpressionDocuments(
      final TestNamespace namespace) throws Exception {
    final ObjectNode mapping = readMetricMapping();
    final SearchClient search = new SearchClient(OssTestServer.defaultHandle());
    final String index = namespace.prefix("metric_expression").toLowerCase(Locale.ROOT);
    try {
      createLegacyIndex(search, index, mapping, LEGACY_CODE);
      assertDynamicMappingMatchesDeclaredExpression(search, index, mapping);
      addExplicitExpressionMappings(search, index, mapping);
      indexExpressionDocument(search, index, "after", METRIC_EXPRESSION, CURRENT_CODE);
      assertUpdatedMappingPreservesExpressionSearch(search, index);
    } finally {
      search.delete("/" + index);
    }
  }

  @Test
  void freshIndexPreservesDynamicExpressionKeywordSearch(final TestNamespace namespace)
      throws Exception {
    final SearchClient search = new SearchClient(OssTestServer.defaultHandle());
    final String index = namespace.prefix("metric_expression_fresh").toLowerCase(Locale.ROOT);
    try {
      search.put("/" + index, readMetricMapping().toString());
      indexExpressionDocument(search, index, "fresh", METRIC_EXPRESSION, FRESH_CODE);
      assertExactExpressionSearch(search, index, FRESH_CODE);
    } finally {
      search.delete("/" + index);
    }
  }

  @Test
  void legacyDateMappingRequiresARebuiltIndex(final TestNamespace namespace) throws Exception {
    final ObjectNode mapping = readMetricMapping();
    final SearchClient search = new SearchClient(OssTestServer.defaultHandle());
    final String legacy = namespace.prefix("metric_legacy_date").toLowerCase(Locale.ROOT);
    final String rebuilt = namespace.prefix("metric_rebuilt_date").toLowerCase(Locale.ROOT);
    try {
      createLegacyIndex(search, legacy, mapping, DATE_SHAPED_CODE);
      assertThat(search.mapping(legacy).at("/" + legacy + CODE_TYPE_MAPPING).asText())
          .isEqualTo("date");
      assertThatThrownBy(() -> addExplicitExpressionMappings(search, legacy, mapping))
          .isInstanceOf(SearchClientException.class)
          .hasMessageContaining("400")
          .hasMessageContaining(EXPRESSION_CODE);
      search.put("/" + rebuilt, mapping.toString());
      indexExpressionDocument(search, rebuilt, "before", METRIC_EXPRESSION, DATE_SHAPED_CODE);
      indexExpressionDocument(search, rebuilt, "after", METRIC_EXPRESSION, CURRENT_CODE);
      assertExpressionCodeIsText(search, rebuilt);
      assertExactExpressionSearch(search, rebuilt, DATE_SHAPED_CODE);
      assertExactExpressionSearch(search, rebuilt, CURRENT_CODE);
    } finally {
      search.delete("/" + rebuilt);
      search.delete("/" + legacy);
    }
  }

  private ObjectNode readMetricMapping() throws Exception {
    try (final InputStream input =
        getClass().getResourceAsStream("/elasticsearch/en/metric_index_mapping.json")) {
      assertNotNull(input);
      return (ObjectNode) new ObjectMapper().readTree(input);
    }
  }

  private static void createLegacyIndex(
      final SearchClient search,
      final String index,
      final ObjectNode mapping,
      final String firstCode) {
    final ObjectNode previousMapping = mapping.deepCopy();
    ((ObjectNode) previousMapping.at(MAPPING_PROPERTIES)).remove(METRIC_EXPRESSION);
    search.put("/" + index, previousMapping.toString());
    indexExpressionDocument(search, index, "before", METRIC_EXPRESSION, firstCode);
    indexExpressionDocument(search, index, "legacy", LEGACY_EXPRESSION, LEGACY_CODE);
  }

  private static void assertDynamicMappingMatchesDeclaredExpression(
      final SearchClient search, final String index, final ObjectNode mapping) {
    final JsonNode previousExpression =
        search.mapping(index).at("/" + index + METRIC_EXPRESSION_MAPPING);
    assertThat(mapping.at(METRIC_EXPRESSION_MAPPING)).isEqualTo(previousExpression);
  }

  private static void addExplicitExpressionMappings(
      final SearchClient search, final String index, final ObjectNode mapping) {
    final ObjectMapper mapper = new ObjectMapper();
    final ObjectNode properties = mapper.createObjectNode();
    properties.set(METRIC_EXPRESSION, mapping.at(METRIC_EXPRESSION_MAPPING));
    properties.set(LEGACY_EXPRESSION, mapping.at(LEGACY_EXPRESSION_MAPPING));
    search.put(
        "/" + index + "/_mapping",
        mapper.createObjectNode().set(PROPERTIES, properties).toString());
  }

  private static void indexExpressionDocument(
      final SearchClient search,
      final String index,
      final String documentId,
      final String expressionField,
      final String code) {
    final ObjectMapper mapper = new ObjectMapper();
    final ObjectNode expression = mapper.createObjectNode().put(LANGUAGE, SQL).put(CODE, code);
    search.put(
        "/" + index + "/_doc/" + documentId + "?refresh=wait_for",
        mapper.createObjectNode().set(expressionField, expression).toString());
  }

  private static void assertUpdatedMappingPreservesExpressionSearch(
      final SearchClient search, final String index) {
    assertExpressionCodeIsText(search, index);
    assertExpressionMatch(search, index, METRIC_EXPRESSION, LEGACY_AMOUNT);
    assertExactExpressionSearch(search, index, LEGACY_CODE);
    assertExactExpressionSearch(search, index, CURRENT_CODE);
    assertExpressionMatch(search, index, LEGACY_EXPRESSION, LEGACY_AMOUNT);
    assertExpressionMatch(search, index, METRIC_EXPRESSION, "current_amount");
  }

  private static void assertExpressionCodeIsText(final SearchClient search, final String index) {
    assertThat(search.mapping(index).at("/" + index + CODE_TYPE_MAPPING).asText())
        .isEqualTo("text");
  }

  private static void assertExpressionMatch(
      final SearchClient search,
      final String index,
      final String expressionField,
      final String amount) {
    assertThat(
            search
                .search(index, expressionQuery("match", expressionField + "." + CODE, amount))
                .at(HITS_TOTAL)
                .asInt())
        .isEqualTo(1);
  }

  private static void assertExactExpressionSearch(
      final SearchClient search, final String index, final String code) {
    final String codeQuery = expressionQuery(TERM_QUERY, EXPRESSION_CODE + KEYWORD_SUFFIX, code);
    assertThat(search.search(index, codeQuery).at(HITS_TOTAL).asInt()).isEqualTo(1);
    final String languageQuery =
        expressionQuery(TERM_QUERY, EXPRESSION_LANGUAGE + KEYWORD_SUFFIX, SQL);
    assertThat(search.search(index, languageQuery).at(HITS_TOTAL).asInt())
        .isGreaterThanOrEqualTo(1);
  }

  private static String expressionQuery(
      final String queryType, final String field, final String value) {
    final ObjectMapper mapper = new ObjectMapper();
    final ObjectNode clause = mapper.createObjectNode();
    clause.set(queryType, mapper.createObjectNode().put(field, value));
    return mapper.createObjectNode().set("query", clause).toString();
  }
}
