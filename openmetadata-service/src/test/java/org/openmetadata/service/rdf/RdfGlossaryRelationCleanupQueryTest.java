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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateRequest;
import org.junit.jupiter.api.Test;

class RdfGlossaryRelationCleanupQueryTest {
  private static final String CUSTOM_PREDICATE =
      "https://example.com/ontology/customGlossaryRelation";
  private static final String SKOS_BROADER = "http://www.w3.org/2004/02/skos/core#broader";

  @Test
  void cleanupUpdateIsParsableAndIncludesConfiguredPredicates() {
    final String update =
        RdfRepository.buildGlossaryTermRelationDeleteUpdate(Set.of(SKOS_BROADER, CUSTOM_PREDICATE));

    final UpdateRequest request = assertDoesNotThrow(() -> UpdateFactory.create(update));

    assertEquals(1, request.getOperations().size());
    assertTrue(update.contains(CUSTOM_PREDICATE));
    assertTrue(update.contains(SKOS_BROADER));
  }
}
