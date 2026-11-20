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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;

class SoftDeletedRelationTypesTest {
  private static final String PART_OF = "http://example.org/onto#partOf";
  private static final String HAS_PART = "http://example.org/onto#hasPart";

  @Test
  void aTypeHoldingTheNamedPredicateIsChosenWhateverItsName() {
    final RelationshipType governed = deleted("componentOf", PART_OF, 1L);

    assertEquals(
        List.of(governed),
        SoftDeletedRelationTypes.namedBy(List.of(PART_OF), List.of(governed), predicate -> false));
  }

  @Test
  void onlyTheLatestOfSeveralTypesOnOnePredicateComesBack() {
    final RelationshipType older = deleted("componentOf", PART_OF, 1L);
    final RelationshipType newer = deleted("hasPart", PART_OF, 5L);

    // The import also names a predicate whose local name is the older type's name.
    assertEquals(
        List.of(newer),
        SoftDeletedRelationTypes.namedBy(
            List.of(PART_OF, "http://example.org/other#componentOf"),
            List.of(older, newer),
            predicate -> false));
  }

  @Test
  void aTypeMatchingOnlyByNameIsNeverRestoredAndHoldsItsName() {
    final RelationshipType sameName = deleted("partOf", "http://example.org/other#partOf", 1L);

    assertEquals(
        List.of(),
        SoftDeletedRelationTypes.namedBy(List.of(PART_OF), List.of(sameName), predicate -> false));
    assertEquals(
        Optional.of(sameName),
        SoftDeletedRelationTypes.holdingNameElsewhere(
            "partOf", URI.create(PART_OF), List.of(sameName)));
    assertEquals(
        Optional.empty(),
        SoftDeletedRelationTypes.holdingNameElsewhere(
            "partOf", URI.create("http://example.org/other#partOf"), List.of(sameName)));
  }

  @Test
  void aPredicateALiveTypeHoldsIsNeverRestored() {
    final RelationshipType governed = deleted("componentOf", PART_OF, 1L);
    final Set<URI> live = Set.of(URI.create(PART_OF));

    assertEquals(
        List.of(),
        SoftDeletedRelationTypes.namedBy(
            List.of(PART_OF, HAS_PART), List.of(governed), live::contains));
  }

  private static RelationshipType deleted(
      final String name, final String predicate, final long updatedAt) {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withRdfPredicate(URI.create(predicate))
        .withUpdatedAt(updatedAt)
        .withDeleted(true);
  }
}
