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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.NotFoundException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPatternType;

class OntologyPatternCatalogTest {
  @Test
  void exposesAllGovernedPatternShapes() {
    final OntologyPatternCatalog catalog = new OntologyPatternCatalog();

    assertEquals(3, catalog.list().getData().size());
    assertEquals(
        List.of("control", "requirement", "evidence"),
        catalog.require(OntologyPatternType.REGULATORY_CONTROL).nodes().stream()
            .map(node -> node.role().key())
            .toList());
    assertEquals(
        List.of("calculatedFrom", "calculatedFrom"),
        catalog.require(OntologyPatternType.MEASURED_KPI).edges().stream()
            .map(OntologyPatternCatalog.PatternEdge::relationshipType)
            .toList());
    assertEquals(
        List.of("partOf", "partOf"),
        catalog.require(OntologyPatternType.PRODUCT_HIERARCHY).edges().stream()
            .map(OntologyPatternCatalog.PatternEdge::relationshipType)
            .toList());
  }

  @Test
  void rejectsUnknownPatternKeys() {
    final OntologyPatternCatalog catalog = new OntologyPatternCatalog();

    assertThrows(NotFoundException.class, () -> catalog.require(null));
  }
}
