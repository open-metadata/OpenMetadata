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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.utils.JsonUtils;

class ODCSCustomPropertiesMigrationTest {
  @Test
  void migratesLegacyMapsWithoutChangingTheirValuesOrUnrelatedFields() {
    String stored =
        """
        {"name":"orders", "extension":{"customProperties":{"untouched":true}},
         "odcsQualityRules":[{"rule":"rowCount","customProperties":{
           "engine":"soda","threshold":3000000000,"enabled":true,"unset":null,
           "payload":{"customProperties":{"keep":"map"}},"values":[1,false,"x"]}}]}
        """;
    JsonNode migrated = JsonUtils.readTree(ODCSCustomPropertiesMigration.migrateJson(stored));
    JsonNode properties = migrated.at("/odcsQualityRules/0/customProperties");
    assertTrue(properties.isArray());
    assertEquals(6, properties.size());
    JsonNode original = JsonUtils.readTree(stored);
    for (JsonNode property : properties) {
      assertEquals(
          original
              .at("/odcsQualityRules/0/customProperties")
              .get(property.path("property").asText()),
          property.get("value"));
    }
    assertEquals(original.get("extension"), migrated.get("extension"));
    assertEquals("rowCount", migrated.at("/odcsQualityRules/0/rule").asText());
    assertEquals(
        migrated.toString(), ODCSCustomPropertiesMigration.migrateJson(migrated.toString()));
  }

  @Test
  void migratedContractsDeserializeWithoutACompatibilityModule() throws Exception {
    String stored =
        """
        {"name":"orders", "odcsQualityRules":[{"rule":"rowCount",
        "customProperties":{"threshold":2}}]}
        """;
    DataContract contract =
        JsonUtils.readValue(ODCSCustomPropertiesMigration.migrateJson(stored), DataContract.class);
    var properties = contract.getOdcsQualityRules().getFirst().getCustomProperties();
    assertEquals(1, properties.size());
    assertEquals("threshold", properties.getFirst().getProperty());
    assertEquals(2, properties.getFirst().getValue());
  }

  @Test
  void convertsEmptyMapsIntoEmptyArrays() {
    String migrated =
        ODCSCustomPropertiesMigration.migrateJson(
            "{\"odcsQualityRules\":[{\"customProperties\":{}}]}");
    assertEquals(
        JsonUtils.readTree("[]"),
        JsonUtils.readTree(migrated).at("/odcsQualityRules/0/customProperties"));
  }

  @Test
  void preservesDecimalPrecision() throws Exception {
    String migrated =
        ODCSCustomPropertiesMigration.migrateJson(
            "{\"odcsQualityRules\":[{\"customProperties\":{\"ratio\":0.12345678901234567890123456789}}]}");
    JsonNode contract =
        JsonUtils.getObjectMapper()
            .reader()
            .with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .readTree(migrated);
    assertEquals(
        new BigDecimal("0.12345678901234567890123456789"),
        contract.at("/odcsQualityRules/0/customProperties/0/value").decimalValue());
  }

  @Test
  void invalidStoredJsonFailsTheMigration() {
    assertThrows(
        IllegalArgumentException.class, () -> ODCSCustomPropertiesMigration.migrateJson("{"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"odcsQualityRules\":null}",
        "{\"odcsQualityRules\":[]}",
        "{\"odcsQualityRules\":[null,{}, {\"customProperties\":null}]}",
        "{\"odcsQualityRules\":[{\"customProperties\":[{\"property\":\"x\",\"value\":false}]}]}"
      })
  void leavesCurrentAndAbsentPropertiesUnchanged(String stored) {
    assertEquals(stored, ODCSCustomPropertiesMigration.migrateJson(stored));
  }
}
