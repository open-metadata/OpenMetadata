package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

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

  @Test
  void malformedFiltersAreNotSilentlyDiscarded() {
    assertThrows(
        JsonParsingException.class, () -> LineageSceneQuery.parseQueryFilter("{\"query\":"));
  }
}
