/*
 *  Copyright 2024 Collate
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

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.translator.RdfPropertyMapper;

/**
 * The RDF write paths split URI-valued triple management into two disjoint
 * predicate sets:
 *
 * <ul>
 *   <li>{@link RdfPropertyMapper#TRANSLATOR_MANAGED_DIRECT_PREDICATES} — refreshed
 *       by {@code storeEntity}'s predicate-scoped DELETE on every entity write.
 *   <li>{@link RdfRepository#RELATIONSHIP_HOOK_PREDICATES} — refreshed by
 *       {@code clearOutgoingEntityRelationships} +
 *       {@code bulkStoreRelationships} during reconciliation.
 * </ul>
 *
 * Overlap between the two would mean either set wipes triples managed by the
 * other set, leading to data loss on entity updates or relationship reindex.
 * This test guards the partition.
 */
class RdfPredicatePartitionTest {

  @Test
  @DisplayName(
      "TRANSLATOR_MANAGED_DIRECT_PREDICATES and RELATIONSHIP_HOOK_PREDICATES must not overlap")
  void testPartitionDisjoint() {
    Set<String> intersection =
        new HashSet<>(RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES);
    intersection.retainAll(RdfRepository.RELATIONSHIP_HOOK_PREDICATES);
    assertTrue(
        intersection.isEmpty(),
        "Translator-managed and relationship-hook predicate sets must be disjoint, but overlap on: "
            + intersection);
  }

  @Test
  @DisplayName("Lineage hook predicates must NOT appear in either set")
  void testLineageHookPredicatesExcluded() {
    Set<String> lineagePredicates =
        Set.of(
            "https://open-metadata.org/ontology/UPSTREAM",
            "http://www.w3.org/ns/prov#wasDerivedFrom",
            "https://open-metadata.org/ontology/hasLineageDetails");
    for (String pred : lineagePredicates) {
      assertFalse(
          RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES.contains(pred),
          "Lineage-hook predicate must not be in TRANSLATOR_MANAGED_DIRECT_PREDICATES: " + pred);
      assertFalse(
          RdfRepository.RELATIONSHIP_HOOK_PREDICATES.contains(pred),
          "Lineage-hook predicate must not be in RELATIONSHIP_HOOK_PREDICATES: " + pred);
    }
  }

  @Test
  @DisplayName("RELATIONSHIP_HOOK_PREDICATES must include the common relationship URIs")
  void testHookPredicatesCoreMembership() {
    // Sample of well-known relationship URIs that addRelationship / bulkAddRelationships write.
    Set<String> expected =
        Set.of(
            "https://open-metadata.org/ontology/contains",
            "https://open-metadata.org/ontology/owns",
            "https://open-metadata.org/ontology/parentOf",
            "https://open-metadata.org/ontology/relatedTo",
            "http://www.w3.org/ns/prov#used");
    for (String pred : expected) {
      assertTrue(
          RdfRepository.RELATIONSHIP_HOOK_PREDICATES.contains(pred),
          "RELATIONSHIP_HOOK_PREDICATES must include " + pred);
    }
  }
}
