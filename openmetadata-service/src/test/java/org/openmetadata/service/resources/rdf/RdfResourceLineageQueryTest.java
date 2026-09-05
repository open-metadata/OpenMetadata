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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.Test;

class RdfResourceLineageQueryTest {

  @Test
  void lineageQueriesUseStoredPredicatesWithoutTruncation() {
    UUID entityId = UUID.randomUUID();

    String upstream =
        RdfGraphService.buildLineageQuery(
            entityId,
            "table",
            RdfGraphService.LineageDirection.UPSTREAM,
            "https://open-metadata.org/");
    String downstream =
        RdfGraphService.buildLineageQuery(
            entityId,
            "table",
            RdfGraphService.LineageDirection.DOWNSTREAM,
            "https://open-metadata.org/");
    String both =
        RdfGraphService.buildLineageQuery(
            entityId, "table", RdfGraphService.LineageDirection.BOTH, "https://open-metadata.org/");

    assertTrue(upstream.contains("(prov:wasDerivedFrom|^om:UPSTREAM)+"));
    assertTrue(downstream.contains("(om:UPSTREAM|^prov:wasDerivedFrom)+"));
    assertFalse(upstream.contains("LIMIT"));
    assertFalse(downstream.contains("LIMIT"));
    assertFalse(both.contains("LIMIT"));
    assertFalse(both.contains("om:upstream"));
    QueryFactory.create(upstream);
    QueryFactory.create(downstream);
    QueryFactory.create(both);
  }
}
