/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.MetricDimension;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.data.MetricMeasure;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchClient;

class MetricIndexTest {

  @ParameterizedTest
  @ValueSource(strings = {"en", "jp", "ko", "ru", "zh"})
  void metricExpressionInSearchDocumentHasAnExplicitCompatibleMapping(final String language)
      throws Exception {
    final ObjectMapper mapper = new ObjectMapper();
    final Metric metric =
        new Metric()
            .withName("revenue")
            .withFullyQualifiedName("revenue")
            .withMetricExpression(new MetricExpression().withCode("SUM(amount)"));
    final JsonNode document =
        mapper.valueToTree(
            new MetricIndex(metric).buildSearchIndexDocInternal(JsonUtils.getMap(metric)));
    assertEquals("SUM(amount)", document.at("/metricExpression/code").asText());
    assertFalse(document.has("expression"));

    try (final InputStream input =
        getClass()
            .getResourceAsStream("/elasticsearch/" + language + "/metric_index_mapping.json")) {
      assertNotNull(input);
      final JsonNode properties = mapper.readTree(input).at("/mappings/properties");
      assertEquals("text", properties.at("/metricExpression/properties/code/type").asText());
      assertEquals("text", properties.at("/metricExpression/properties/language/type").asText());
      for (final String field : List.of("code", "language")) {
        final JsonNode keyword =
            properties.at("/metricExpression/properties/" + field + "/fields/keyword");
        assertEquals("keyword", keyword.path("type").asText());
        assertEquals(256, keyword.path("ignore_above").asInt());
        assertEquals("text", properties.at("/expression/properties/" + field + "/type").asText());
      }
    }
  }

  @Test
  void buildDocumentAddsHierarchyCountsAndMetricChildFqnParts() {
    Metric metric =
        new Metric()
            .withName("revenue")
            .withChildrenCount(3)
            .withDimensions(
                List.of(
                    new MetricDimension()
                        .withName("region")
                        .withFullyQualifiedName("revenue.dimension.region")))
            .withMeasures(
                List.of(
                    new MetricMeasure()
                        .withName("amount")
                        .withFullyQualifiedName("revenue.measure.amount")));

    Map<String, Object> result =
        new MetricIndex(metric).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(3, result.get("childrenCount"));
    assertTrue(result.get("fqnParts").toString().contains("region"));
    assertTrue(result.get("fqnParts").toString().contains("amount"));
  }

  @Test
  void buildDocumentDefaultsMissingChildrenCountToZero() {
    Map<String, Object> result =
        new MetricIndex(new Metric()).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(0, result.get("childrenCount"));
  }

  @Test
  void missingMetricGroupIsExplicitlyMarkedForSearchFieldRemoval() {
    Map<String, Object> result =
        new MetricIndex(new Metric()).buildSearchIndexDocInternal(new HashMap<>());

    assertTrue(result.containsKey("metricGroup"));
    assertNull(result.get("metricGroup"));
    assertTrue(SearchClient.FIELDS_TO_REMOVE_WHEN_NULL.contains("metricGroup"));
  }

  @Test
  void reindexFieldsIncludeRelationshipDerivedHierarchyFields() {
    MetricIndex index = new MetricIndex(new Metric());

    assertTrue(index.getRequiredReindexFields().contains("parent"));
    assertTrue(index.getRequiredReindexFields().contains("childrenCount"));
    assertTrue(index.getRequiredReindexFields().contains("metricGroup"));
    assertTrue(index.getExcludedFields().contains("children"));
    assertFalse(index.getExcludedFields().contains("metricGroup"));
  }
}
