package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.QueryFilterParser;

class LineageSceneQueryTest {
  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"null", "{}", "{\"query\":null}", "{\"query\":{}}"})
  void absentAndEmptyFiltersDoNotAddAQuery(String filter) {
    assertNull(LineageSceneQuery.parseQueryFilter(filter));
  }

  @Test
  void wrappedAndUnwrappedFiltersSerializeIdentically() {
    String filter = "{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}";
    String unwrapped = LineageSceneQuery.queryJson(LineageSceneQuery.parseQueryFilter(filter));
    String wrapped =
        LineageSceneQuery.queryJson(
            LineageSceneQuery.parseQueryFilter("{\"query\":" + filter + "}"));

    assertEquals(JsonUtils.readTree(unwrapped), JsonUtils.readTree(wrapped));
    assertEquals(
        "PII.Sensitive", JsonUtils.readTree(wrapped).at("/query/term/tags.tagFQN/value").asText());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"term\":{\"tags.tagFQN\":\"PII.Sensitive\"}}",
        "{\"term\":{\"tier.tagFQN\":\"Tier.Tier2\"}}",
        "{\"match\":{\"name\":\"sales\"}}"
      })
  void normalizedFiltersPreserveInMemoryLineageMatches(String filter) {
    String normalized = LineageSceneQuery.queryJson(LineageSceneQuery.parseQueryFilter(filter));
    Map<String, Object> matchingEntity =
        Map.of(
            "tags", List.of(Map.of("tagFQN", "PII.Sensitive")),
            "tier", Map.of("tagFQN", "Tier.Tier2"),
            "name", "monthly_sales");
    Map<String, Object> nonMatchingEntity =
        Map.of(
            "tags", List.of(Map.of("tagFQN", "PII.NonSensitive")),
            "tier", Map.of("tagFQN", "Tier.Tier1"),
            "name", "customers");

    assertTrue(QueryFilterParser.matchesFilter(matchingEntity, normalized));
    assertFalse(QueryFilterParser.matchesFilter(nonMatchingEntity, normalized));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"query\":",
        "{\"term\":{}}",
        "[\"not\",\"a\",\"query\"]",
        "[1]",
        "\"tables\"",
        "{\"terms\":{}}",
        "{\"bool\":{\"must\":5}}",
        "{\"range\":{\"x\":{\"boost\":\"high\"}}}"
      })
  void malformedFiltersAreRejectedAsBadRequests(String filter) {
    BadRequestException error =
        assertThrows(BadRequestException.class, () -> LineageSceneQuery.parseQueryFilter(filter));

    assertTrue(error.getMessage().startsWith("Invalid query_filter: "), error.getMessage());
    assertFalse(error.getMessage().contains("co.elastic"), error.getMessage());
    assertFalse(error.getMessage().contains("Exception"), error.getMessage());
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "{\"query\":|it is not valid JSON",
        "[1]|a query must be a JSON object",
        "{\"query\":[1]}|a query must be a JSON object",
        "{\"term\":{}}|unexpected value at 'term'",
        "{\"bool\":{\"must\":5}}|unexpected value at 'bool.must'",
        "{\"terms\":{}}|missing required property 'field' at 'terms'"
      })
  void malformedFiltersSayWhatIsWrongInTheCallersTerms(String filter, String reason) {
    BadRequestException error =
        assertThrows(BadRequestException.class, () -> LineageSceneQuery.parseQueryFilter(filter));

    assertEquals("Invalid query_filter: " + reason, error.getMessage());
  }
}
