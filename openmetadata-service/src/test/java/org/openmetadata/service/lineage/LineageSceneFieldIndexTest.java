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
package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.LineageSceneField;

class LineageSceneFieldIndexTest {
  @Test
  void exactIdentifiersTakePrecedenceOverAmbiguousShortNames() {
    LineageSceneFieldIndex index =
        new LineageSceneFieldIndex(
            List.of(
                field("nested.id", "id", "catalog.table.nested.id"),
                field("id", "primary_key", "catalog.table.id")),
            true);

    assertEquals("id", index.endpoint("id"));
    assertEquals("id", index.endpoint("catalog.table.id"));
    assertEquals("nested.id", index.endpoint("nested.id"));
    assertEquals("nested.id", index.endpoint("catalog.table.nested.id"));
    assertEquals("nested.id", index.endpoint("legacy.table.id"));
  }

  @Test
  void duplicateShortNamesKeepTheirFirstFieldAndUnknownEndpointsRemainVisible() {
    LineageSceneFieldIndex index =
        new LineageSceneFieldIndex(
            List.of(field("first", "id", null), field("second", "id", null)), true);

    assertEquals("first", index.endpoint("id"));
    assertEquals("first", index.endpoint("catalog.table.id"));
    assertEquals("catalog.table.removed", index.endpoint("catalog.table.removed"));
  }

  @Test
  void nonFieldScenesRetainFieldsForCountsWithoutIndexingEndpoints() {
    List<LineageSceneField> fields = List.of(field("catalog.table.id", "id", "catalog.table.id"));
    LineageSceneFieldIndex index = new LineageSceneFieldIndex(fields, false);

    assertEquals(fields, index.fields());
    assertEquals("id", index.endpoint("id"));
  }

  private LineageSceneField field(String id, String name, String fqn) {
    return new LineageSceneField().withId(id).withName(name).withFullyQualifiedName(fqn);
  }
}
