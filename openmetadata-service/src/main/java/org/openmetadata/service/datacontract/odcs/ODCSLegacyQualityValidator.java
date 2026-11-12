/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.util.List;
import java.util.Set;

/** Validates historical quality fields before compatibility transformations consume them. */
final class ODCSLegacyQualityValidator {
  private static final String COLUMN = "column";
  private static final String SCHEMA_LOCATION =
      "classpath:json/schema/entity/datacontract/odcs/odcsDataContract.json#/definitions/odcsQualityRule";
  private static final SchemaRegistry SCHEMAS =
      SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
  private static final Schema QUALITY_SCHEMA =
      SCHEMAS.getSchema(SchemaLocation.of(SCHEMA_LOCATION));
  private static final Schema COLUMN_SCHEMA =
      SCHEMAS.getSchema(SchemaLocation.of(SCHEMA_LOCATION + "/properties/column"));
  private static final Set<String> QUALITY_FIELDS =
      ODCSExportModelWriter.fields(
          ODCSExportModelWriter.requiredSchema(
                  "/json/schema/entity/datacontract/odcs/odcsDataContract.json")
              .at("/definitions/odcsQualityRule"));
  private static final Set<String> LEGACY_METRICS =
      Set.of(
          "freshness",
          "completeness",
          "textLength",
          "valuesBetween",
          "validValues",
          "regex",
          "pattern",
          "notNull",
          "nullCount",
          "duplicateCount",
          "missingCount",
          "invalidCount");

  private ODCSLegacyQualityValidator() {}

  static boolean isLegacyMetric(String metric) {
    return LEGACY_METRICS.contains(metric);
  }

  static ObjectNode requireRootRule(JsonNode source) {
    if (!(source instanceof ObjectNode rule)
        || rule.has(COLUMN) && !COLUMN_SCHEMA.validate(rule.get(COLUMN)).isEmpty()) {
      throw new IllegalArgumentException(
          "Legacy root quality rules must be objects with textual column references.");
    }
    return rule;
  }

  static void requireValid(ObjectNode source) {
    if (!isValid(source)) {
      throw new IllegalArgumentException(
          "Legacy root quality rule `" + source.path("name").asText() + "` is malformed.");
    }
  }

  static boolean isValid(ObjectNode source) {
    for (var fields = source.fieldNames(); fields.hasNext(); ) {
      if (!QUALITY_FIELDS.contains(fields.next())) {
        return false;
      }
    }
    ObjectNode projection = source.deepCopy();
    if (isLegacyMetric(projection.path("metric").asText())) {
      projection.set("rule", projection.remove("metric"));
    }
    // Published assertions accept arbitrary JSON; the native reader's numeric projection does not.
    for (String scalar : List.of("mustBe", "mustNotBe")) {
      if (projection.has(scalar)) {
        projection.put(scalar, 0);
      }
    }
    return QUALITY_SCHEMA.validate(projection).isEmpty();
  }
}
