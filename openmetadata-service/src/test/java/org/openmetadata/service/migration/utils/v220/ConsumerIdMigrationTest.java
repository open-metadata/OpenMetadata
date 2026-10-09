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

package org.openmetadata.service.migration.utils.v220;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class ConsumerIdMigrationTest {

  @Test
  void onlyTheConsumersNameChanges() {
    String stored =
        """
        {"id": "11111111-1111-1111-1111-111111111111", "name": "orders",
         "className": "org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher",
         "pollInterval": 60, "config": {"rules": [1, 2]}, "somethingNewer": true}
        """;

    String migrated = ConsumerIdMigration.withConsumerId(stored, "alert");

    ObjectNode expected = (ObjectNode) JsonUtils.readTree(stored);
    expected.put("className", "alert");
    assertEquals(expected, JsonUtils.readTree(migrated));
  }
}
