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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;

class RelationshipTypeReferenceNamesTest {
  @Test
  void namesEveryReferenceStoredWithOnlyItsFqn() {
    final RelationshipType type =
        new RelationshipType()
            .withName("forward")
            .withInverse(fqnOnly("inverse"))
            .withReplacedBy(fqnOnly("successor"))
            .withPropertyChain(List.of(fqnOnly("first"), fqnOnly("second")))
            .withDisjointWith(Set.of(fqnOnly("left"), fqnOnly("right")));

    RelationshipTypeReferenceNames.withNamedReferences(type);

    assertEquals("inverse", type.getInverse().getName());
    assertEquals("successor", type.getReplacedBy().getName());
    assertEquals(
        List.of("first", "second"),
        type.getPropertyChain().stream().map(EntityReference::getName).toList());
    assertEquals(
        Set.of("left", "right"),
        type.getDisjointWith().stream().map(EntityReference::getName).collect(Collectors.toSet()));
    assertTrue(type.getDisjointWith().stream().allMatch(type.getDisjointWith()::contains));
  }

  @Test
  void keepsTheIdAndLeavesTheStoredReferenceUnchanged() {
    final UUID id = UUID.randomUUID();
    final EntityReference stored = fqnOnly("inverse").withId(id);

    final EntityReference named = RelationshipTypeReferenceNames.named(stored);

    assertEquals("inverse", named.getName());
    assertEquals(id, named.getId());
    assertNull(stored.getName());
  }

  @Test
  void unquotesTheFqnOfADottedName() {
    assertEquals(
        "has.part", RelationshipTypeReferenceNames.named(fqnOnly("\"has.part\"")).getName());
  }

  @Test
  void givesAReferenceStoredWithOnlyANameItsQuotedFqn() {
    final EntityReference nameOnly =
        new EntityReference().withType("relationshipType").withName("has.part");

    assertEquals(
        "\"has.part\"", RelationshipTypeReferenceNames.named(nameOnly).getFullyQualifiedName());
  }

  @Test
  void leavesNamedAndAbsentReferencesAlone() {
    final EntityReference named = fqnOnly("inverse").withName("inverse");
    final RelationshipType type = new RelationshipType().withName("forward").withInverse(named);

    RelationshipTypeReferenceNames.withNamedReferences(type);

    assertSame(named, type.getInverse());
    assertNull(type.getReplacedBy());
    assertNull(RelationshipTypeReferenceNames.named(new EntityReference()).getName());
  }

  private static EntityReference fqnOnly(final String fqn) {
    return new EntityReference().withType("relationshipType").withFullyQualifiedName(fqn);
  }
}
