package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.exception.JsonParsingException;
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

  @Test
  void malformedFiltersAreNotSilentlyDiscarded() {
    assertThrows(
        JsonParsingException.class, () -> LineageSceneQuery.parseQueryFilter("{\"query\":"));
  }
}
