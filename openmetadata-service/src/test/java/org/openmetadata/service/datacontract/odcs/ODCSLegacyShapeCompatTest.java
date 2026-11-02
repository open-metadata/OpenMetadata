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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Contracts stored with the shapes an older OpenMetadata accepted keep reading after the model
 * adopted the ODCS forms, without a migration of the stored rows.
 */
class ODCSLegacyShapeCompatTest {

  @Test
  void storedMapFormCustomPropertiesAreReadAsTheOdcSArrayForm() throws Exception {
    String stored =
        """
        {
          "id": "%s",
          "name": "orders_contract",
          "fullyQualifiedName": "service.db.schema.orders.orders_contract",
          "odcsQualityRules": [
            {
              "id": "row_count",
              "type": "library",
              "rule": "rowCount",
              "column": "id",
              "customProperties": {"engine": "soda", "threshold": 2}
            }
          ]
        }
        """
            .formatted(UUID.randomUUID());

    DataContract contract = JsonUtils.readValue(stored, DataContract.class);

    var customProperties = contract.getOdcsQualityRules().getFirst().getCustomProperties();
    assertEquals(2, customProperties.size());
    assertTrue(
        customProperties.stream()
            .anyMatch(
                property ->
                    "engine".equals(property.getProperty()) && "soda".equals(property.getValue())));
    assertTrue(
        customProperties.stream()
            .anyMatch(
                property ->
                    "threshold".equals(property.getProperty())
                        && Integer.valueOf(2).equals(property.getValue())));
  }

  @Test
  void arrayFormCustomPropertiesStillReadThroughTheCompatModule() throws Exception {
    String stored =
        """
        {
          "id": "%s",
          "name": "orders_contract",
          "odcsQualityRules": [
            {
              "id": "row_count",
              "customProperties": [{"property": "engine", "value": "soda"}]
            }
          ]
        }
        """
            .formatted(UUID.randomUUID());

    DataContract contract = JsonUtils.readValue(stored, DataContract.class);

    assertEquals(1, contract.getOdcsQualityRules().getFirst().getCustomProperties().size());
    assertEquals(
        "soda",
        contract.getOdcsQualityRules().getFirst().getCustomProperties().getFirst().getValue());
  }
}
