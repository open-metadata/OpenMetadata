/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.SearchIndexingLimits;
import org.openmetadata.schema.utils.JsonUtils;

class SearchIndexSettingsTest {

  private SearchFieldLimits limitsWith(int depth, int nestedObjects, int totalFields) {
    SearchIndexingLimits limits =
        new SearchIndexingLimits()
            .withMappingDepthLimit(depth)
            .withNestedObjectsLimit(nestedObjects)
            .withTotalFieldsLimit(totalFields);
    return SearchFieldLimits.from(
        new ElasticSearchConfiguration().withSearchIndexingLimits(limits));
  }

  private JsonNode mappingLimits(String content) {
    return JsonUtils.readTree(content).get("settings").get("index").get("mapping");
  }

  private JsonNode properties(String content) {
    return JsonUtils.readTree(content).get("mappings").get("properties");
  }

  @Test
  void injects_limits_and_preserves_existing_settings() {
    String content = "{\"settings\":{\"index\":{\"max_ngram_diff\":17}},\"mappings\":{}}";

    String result = SearchIndexSettings.harden(content, limitsWith(15, 5000, 2000));

    JsonNode root = JsonUtils.readTree(result);
    assertEquals(17, root.get("settings").get("index").get("max_ngram_diff").asInt());
    JsonNode mapping = mappingLimits(result);
    assertEquals(15, mapping.get("depth").get("limit").asInt());
    assertEquals(5000, mapping.get("nested_objects").get("limit").asInt());
    assertEquals(2000, mapping.get("total_fields").get("limit").asInt());
  }

  @Test
  void does_not_override_existing_limit() {
    String content =
        "{\"settings\":{\"index\":{\"mapping\":{\"depth\":{\"limit\":7}}}},\"mappings\":{}}";

    String result = SearchIndexSettings.harden(content, limitsWith(15, 5000, 2000));

    assertEquals(7, mappingLimits(result).get("depth").get("limit").asInt());
  }

  @Test
  void adds_ignore_above_to_keyword_fields_and_multifields() {
    String content =
        "{\"mappings\":{\"properties\":{"
            + "\"fullyQualifiedName\":{\"type\":\"keyword\"},"
            + "\"name\":{\"type\":\"text\",\"fields\":{\"keyword\":{\"type\":\"keyword\"}}}"
            + "}}}";

    String result = SearchIndexSettings.harden(content, SearchFieldLimits.defaults());

    JsonNode props = properties(result);
    int expected = SearchFieldLimits.defaults().getSafeCharThreshold();
    assertEquals(expected, props.get("fullyQualifiedName").get("ignore_above").asInt());
    assertEquals(
        expected, props.get("name").get("fields").get("keyword").get("ignore_above").asInt());
  }

  @Test
  void does_not_override_existing_ignore_above() {
    String content =
        "{\"mappings\":{\"properties\":{\"tagFQN\":{\"type\":\"keyword\",\"ignore_above\":256}}}}";

    String result = SearchIndexSettings.harden(content, SearchFieldLimits.defaults());

    assertEquals(256, properties(result).get("tagFQN").get("ignore_above").asInt());
  }

  @Test
  void adds_ignore_malformed_to_numeric_and_date_fields() {
    String content =
        "{\"mappings\":{\"properties\":{"
            + "\"count\":{\"type\":\"integer\"},"
            + "\"created\":{\"type\":\"date\"},"
            + "\"description\":{\"type\":\"text\"}"
            + "}}}";

    String result = SearchIndexSettings.harden(content, SearchFieldLimits.defaults());

    JsonNode props = properties(result);
    assertTrue(props.get("count").get("ignore_malformed").asBoolean());
    assertTrue(props.get("created").get("ignore_malformed").asBoolean());
    assertFalse(
        props.get("description").has("ignore_malformed"), "text fields must not be guarded");
  }

  @Test
  void hardens_nested_object_properties() {
    String content =
        "{\"mappings\":{\"properties\":{\"tags\":{\"type\":\"nested\",\"properties\":{"
            + "\"tagFQN\":{\"type\":\"keyword\"}}}}}}";

    String result = SearchIndexSettings.harden(content, SearchFieldLimits.defaults());

    JsonNode tagFqn = properties(result).get("tags").get("properties").get("tagFQN");
    assertEquals(
        SearchFieldLimits.defaults().getSafeCharThreshold(), tagFqn.get("ignore_above").asInt());
  }

  @Test
  void guards_flattened_fields_with_ignore_above_and_depth_limit() {
    String content = "{\"mappings\":{\"properties\":{\"extension\":{\"type\":\"flattened\"}}}}";
    SearchFieldLimits limits = SearchFieldLimits.defaults();

    JsonNode extension = properties(SearchIndexSettings.harden(content, limits)).get("extension");

    assertEquals(limits.getSafeCharThreshold(), extension.get("ignore_above").asInt());
    assertEquals(limits.getDepthLimit(), extension.get("depth_limit").asInt());
  }

  @Test
  void guards_column_level_extension() {
    String content =
        "{\"mappings\":{\"properties\":{\"columns\":{\"properties\":{"
            + "\"extension\":{\"type\":\"flattened\"}}}}}}";

    String result = SearchIndexSettings.harden(content, SearchFieldLimits.defaults());

    JsonNode columnExtension = properties(result).get("columns").get("properties").get("extension");
    assertTrue(columnExtension.has("ignore_above"), "nested column extension must be guarded");
  }

  @Test
  void ignore_above_is_never_zero_for_tiny_keyword_max_bytes() {
    SearchFieldLimits limits =
        SearchFieldLimits.from(
            new ElasticSearchConfiguration()
                .withSearchIndexingLimits(new SearchIndexingLimits().withKeywordMaxBytes(1)));
    String content = "{\"mappings\":{\"properties\":{\"fqn\":{\"type\":\"keyword\"}}}}";

    int ignoreAbove =
        properties(SearchIndexSettings.harden(content, limits))
            .get("fqn")
            .get("ignore_above")
            .asInt();

    assertTrue(ignoreAbove >= 1, "ignore_above must be at least 1");
  }

  @Test
  void returns_null_content_unchanged() {
    assertNull(SearchIndexSettings.harden(null, SearchFieldLimits.defaults()));
  }

  /**
   * Covers every Elasticsearch/OpenSearch field type used across the index mappings: keyword and
   * flattened get ignore_above; numeric/date/boolean types get ignore_malformed; container and
   * special types (text, nested, object, completion) get neither directly.
   */
  @ParameterizedTest(name = "{0}")
  @CsvSource({
    "keyword, true, false",
    "text, false, false",
    "long, false, true",
    "integer, false, true",
    "short, false, true",
    "byte, false, true",
    "double, false, true",
    "float, false, true",
    "half_float, false, true",
    "scaled_float, false, true",
    "date, false, true",
    "boolean, false, true",
    "nested, false, false",
    "object, false, false",
    "flattened, true, false",
    "completion, false, false"
  })
  void hardens_each_field_type_correctly(
      String type, boolean expectIgnoreAbove, boolean expectIgnoreMalformed) {
    String content = "{\"mappings\":{\"properties\":{\"f\":{\"type\":\"" + type + "\"}}}}";

    String result = SearchIndexSettings.harden(content, SearchFieldLimits.defaults());

    JsonNode field = properties(result).get("f");
    assertEquals(expectIgnoreAbove, field.has("ignore_above"), "ignore_above for type " + type);
    assertEquals(
        expectIgnoreMalformed, field.has("ignore_malformed"), "ignore_malformed for type " + type);
  }
}
