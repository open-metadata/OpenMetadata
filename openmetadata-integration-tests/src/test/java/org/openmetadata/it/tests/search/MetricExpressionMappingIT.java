package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
class MetricExpressionMappingIT {

  @Test
  void explicitMappingAcceptsExistingDynamicAndLegacyExpressionDocuments(TestNamespace namespace)
      throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode mapping;
    try (InputStream input =
        getClass().getResourceAsStream("/elasticsearch/en/metric_index_mapping.json")) {
      assertNotNull(input);
      mapping = (ObjectNode) mapper.readTree(input);
    }
    ObjectNode previousMapping = mapping.deepCopy();
    ((ObjectNode) previousMapping.at("/mappings/properties")).remove("metricExpression");
    SearchClient search = new SearchClient(OssTestServer.defaultHandle());
    String index = namespace.prefix("metric_expression").toLowerCase(Locale.ROOT);
    try {
      search.put("/" + index, previousMapping.toString());
      search.put(
          "/" + index + "/_doc/before?refresh=wait_for",
          """
          {"metricExpression":{"language":"SQL","code":"SUM(legacy_amount)"}}
          """);
      search.put(
          "/" + index + "/_doc/legacy?refresh=wait_for",
          """
          {"expression":{"language":"SQL","code":"SUM(legacy_amount)"}}
          """);
      JsonNode previousExpression =
          search.mapping(index).at("/" + index + "/mappings/properties/metricExpression");
      assertThat(mapping.at("/mappings/properties/metricExpression")).isEqualTo(previousExpression);
      ObjectNode properties = mapper.createObjectNode();
      properties.set("metricExpression", mapping.at("/mappings/properties/metricExpression"));
      properties.set("expression", mapping.at("/mappings/properties/expression"));
      search.put(
          "/" + index + "/_mapping",
          mapper.createObjectNode().set("properties", properties).toString());
      search.put(
          "/" + index + "/_doc/after?refresh=wait_for",
          """
          {"metricExpression":{"language":"SQL","code":"SUM(current_amount)"}}
          """);

      assertThat(
              search
                  .mapping(index)
                  .at("/" + index + "/mappings/properties/metricExpression/properties/code/type")
                  .asText())
          .isEqualTo("text");
      assertThat(
              search
                  .search(
                      index,
                      """
                  {"query":{"match":{"metricExpression.code":"legacy_amount"}}}
                  """)
                  .at("/hits/total/value")
                  .asInt())
          .isEqualTo(1);
      assertExactExpressionSearch(search, index, "SUM(legacy_amount)");
      assertExactExpressionSearch(search, index, "SUM(current_amount)");
      assertThat(
              search
                  .search(
                      index,
                      """
                  {"query":{"match":{"expression.code":"legacy_amount"}}}
                  """)
                  .at("/hits/total/value")
                  .asInt())
          .isEqualTo(1);
      assertThat(
              search
                  .search(
                      index,
                      """
                  {"query":{"match":{"metricExpression.code":"current_amount"}}}
                  """)
                  .at("/hits/total/value")
                  .asInt())
          .isEqualTo(1);
    } finally {
      search.delete("/" + index);
    }
  }

  @Test
  void freshIndexPreservesDynamicExpressionKeywordSearch(TestNamespace namespace) throws Exception {
    SearchClient search = new SearchClient(OssTestServer.defaultHandle());
    String index = namespace.prefix("metric_expression_fresh").toLowerCase(Locale.ROOT);
    try (InputStream input =
        getClass().getResourceAsStream("/elasticsearch/en/metric_index_mapping.json")) {
      assertNotNull(input);
      search.put("/" + index, new String(input.readAllBytes(), StandardCharsets.UTF_8));
      search.put(
          "/" + index + "/_doc/fresh?refresh=wait_for",
          """
          {"metricExpression":{"language":"SQL","code":"SUM(fresh_amount)"}}
          """);
      assertExactExpressionSearch(search, index, "SUM(fresh_amount)");
    } finally {
      search.delete("/" + index);
    }
  }

  private static void assertExactExpressionSearch(SearchClient search, String index, String code) {
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode terms = mapper.createObjectNode();
    terms.put("metricExpression.code.keyword", code);
    ObjectNode codeQuery = mapper.createObjectNode();
    codeQuery.set("query", mapper.createObjectNode().set("term", terms));
    assertThat(search.search(index, codeQuery.toString()).at("/hits/total/value").asInt())
        .isEqualTo(1);
    assertThat(
            search
                .search(
                    index,
                    """
                {"query":{"term":{"metricExpression.language.keyword":"SQL"}}}
                """)
                .at("/hits/total/value")
                .asInt())
        .isGreaterThanOrEqualTo(1);
  }
}
