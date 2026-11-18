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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.RelationshipTypeReferences.Reference;

class RelationshipTypeReferencesTest {
  private final RelationshipType target = type("target");

  @Test
  void everyReferenceFieldNamesItsTarget() {
    final RelationshipType inverse = type("inverseOwner").withInverse(byId(target));
    final RelationshipType replaced = type("replacedOwner").withReplacedBy(byId(target));
    final RelationshipType chain =
        type("chainOwner").withPropertyChain(List.of(byId(type("other")), byId(target)));
    final RelationshipType disjoint = type("disjointOwner").withDisjointWith(Set.of(byId(target)));

    final List<Reference> references =
        RelationshipTypeReferences.referencesTo(
            target, List.of(target, inverse, replaced, chain, disjoint, type("unrelated")));

    assertEquals(
        List.of(
            "inverseOwner:INVERSE",
            "replacedOwner:REPLACED_BY",
            "chainOwner:PROPERTY_CHAIN",
            "disjointOwner:DISJOINT_WITH"),
        references.stream().map(r -> r.owner().getName() + ":" + r.field()).toList());
  }

  @Test
  void aReferenceWrittenBeforeItsTargetExistedMatchesByFqn() {
    final EntityReference forward =
        new EntityReference()
            .withType(Entity.RELATIONSHIP_TYPE)
            .withFullyQualifiedName(target.getFullyQualifiedName());
    final RelationshipType owner = type("forwardOwner").withInverse(forward);

    assertEquals(1, RelationshipTypeReferences.referencesTo(target, List.of(owner)).size());
  }

  @Test
  void aReferenceBuiltFromANameAloneMatchesByName() {
    final EntityReference byName =
        new EntityReference().withType(Entity.RELATIONSHIP_TYPE).withName(target.getName());
    final RelationshipType owner = type("namedOwner").withReplacedBy(byName);

    assertEquals(1, RelationshipTypeReferences.referencesTo(target, List.of(owner)).size());
  }

  @Test
  void aTypesReferencesToItselfDoNotCount() {
    final RelationshipType symmetric = type("symmetric");
    symmetric
        .withInverse(byId(symmetric))
        .withPropertyChain(List.of(byId(symmetric), byId(symmetric)));

    assertTrue(RelationshipTypeReferences.heldBy(symmetric).isEmpty());
    assertTrue(RelationshipTypeReferences.referencesTo(symmetric, List.of(symmetric)).isEmpty());
  }

  @Test
  void aSoftDeletedOwnerStillCountsAndIsLabelledSo() {
    final RelationshipType deletedOwner =
        type("deletedOwner").withInverse(byId(target)).withDeleted(true);

    final List<Reference> references =
        RelationshipTypeReferences.referencesTo(target, List.of(deletedOwner));

    assertEquals(
        "Relationship type 'target' is in use and cannot be deleted: referenced by relationship"
            + " type 'deletedOwner' (inverse, soft-deleted). Remove these references first.",
        RelationshipTypeReferences.inUseMessage(target, references, 0));
  }

  @Test
  void theMessageNamesReferrersAndCountsRelations() {
    final RelationshipType owner = type("owner").withInverse(byId(target));

    final String message =
        RelationshipTypeReferences.inUseMessage(
            target, RelationshipTypeReferences.referencesTo(target, List.of(owner)), 3);

    assertEquals(
        "Relationship type 'target' is in use and cannot be deleted: referenced by relationship"
            + " type 'owner' (inverse); used by 3 glossary term relations. Remove these references"
            + " first.",
        message);
    assertEquals(
        "Relationship type 'target' is in use and cannot be deleted: used by 1 glossary term"
            + " relation. Remove these references first.",
        RelationshipTypeReferences.inUseMessage(target, List.of(), 1));
  }

  @Test
  void theMessageListsAtMostTenReferrers() {
    final List<RelationshipType> owners =
        IntStream.range(0, 12)
            .mapToObj(index -> type("owner" + (char) ('a' + index)).withInverse(byId(target)))
            .toList();

    final String message =
        RelationshipTypeReferences.inUseMessage(
            target, RelationshipTypeReferences.referencesTo(target, owners), 0);

    assertTrue(message.contains("'ownerj' (inverse) and 2 more"), message);
    assertFalse(message.contains("'ownerk'"), message);
  }

  private static RelationshipType type(final String name) {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private static EntityReference byId(final RelationshipType type) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }
}
