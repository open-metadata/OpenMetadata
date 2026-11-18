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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeRepairPlanner.Plan;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeRepairPlanner.StoredRelationType;
import org.openmetadata.service.ontology.RelationshipTypeIds;

class RelationshipTypeRepairPlannerTest {
  private static final Instant NOW = Instant.parse("2026-11-18T00:00:00Z");
  private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

  @Test
  void aSoftDeletedInverseIsUndeletedWithItsDefinition() {
    final RelationshipType deleted = type("partOf").withDeleted(true).withDescription("original");
    final RelationshipType owner = type("hasPart").withInverse(reference(deleted));

    final Plan plan = plan(List.of(owner, deleted), List.of());

    assertEquals(1, plan.restored().size());
    final RelationshipType restored = plan.restored().getFirst();
    assertEquals(deleted.getId(), restored.getId());
    assertFalse(restored.getDeleted());
    assertEquals("original", restored.getDescription());
    assertEquals(NOW.toEpochMilli(), restored.getUpdatedAt());
    assertTrue(plan.recreated().isEmpty());
  }

  @Test
  void aSoftDeletedTypeStoredRelationsNameIsUndeletedOnce() {
    final RelationshipType deleted = type("mentions").withDeleted(true);
    final RelationshipType owner = type("mentionedBy").withInverse(reference(deleted));

    final Plan plan =
        plan(
            List.of(owner, deleted),
            List.of(
                new StoredRelationType(deleted.getId(), "mentions"),
                new StoredRelationType(null, "mentions")));

    assertEquals(
        List.of(deleted.getId()), plan.restored().stream().map(RelationshipType::getId).toList());
  }

  @Test
  void aHardDeletedInverseIsRecreatedPointingBackAtItsPartner() {
    final UUID missingId = UUID.randomUUID();
    final RelationshipType owner =
        type("hasPart")
            .withInverse(
                new EntityReference()
                    .withId(missingId)
                    .withType(Entity.RELATIONSHIP_TYPE)
                    .withName("partOf")
                    .withFullyQualifiedName("partOf"));

    final Plan plan = plan(List.of(owner), List.of(new StoredRelationType(missingId, "partOf")));

    assertEquals(1, plan.recreated().size());
    final RelationshipType placeholder = plan.recreated().getFirst();
    assertEquals(missingId, placeholder.getId());
    assertEquals("partOf", placeholder.getName());
    assertEquals("partOf", placeholder.getFullyQualifiedName());
    assertEquals(EntityStatus.DEPRECATED, placeholder.getEntityStatus());
    assertEquals(RelationshipTypeCategory.CUSTOM, placeholder.getCategory());
    assertFalse(placeholder.getSystemDefined());
    assertFalse(placeholder.getDeleted());
    assertEquals(
        URI.create("https://open-metadata.org/ontology/partOf"), placeholder.getRdfPredicate());
    assertEquals(owner.getId(), placeholder.getInverse().getId());
    assertEquals("hasPart", placeholder.getInverse().getName());
    assertTrue(
        placeholder
            .getDescription()
            .contains("relationship type 'hasPart' (inverse), glossary terms"),
        placeholder.getDescription());
  }

  @Test
  void aHardDeletedTypeOnlyRelationsNameIsRecreatedWithoutAnInverse() {
    final UUID missingId = UUID.randomUUID();

    final Plan plan = plan(List.of(), List.of(new StoredRelationType(missingId, "cites")));

    final RelationshipType placeholder = plan.recreated().getFirst();
    assertEquals(missingId, placeholder.getId());
    assertNull(placeholder.getInverse());
  }

  @Test
  void aRelationRowWithoutATypeIdRecreatesTheTypeUnderItsStableId() {
    final Plan plan = plan(List.of(), List.of(new StoredRelationType(null, "cites")));

    assertEquals(RelationshipTypeIds.stableId("cites"), plan.recreated().getFirst().getId());
  }

  @Test
  void aTakenPredicateFallsBackToOneMintedFromTheId() {
    final UUID missingId = UUID.randomUUID();
    final RelationshipType holder =
        type("other").withRdfPredicate(URI.create("https://open-metadata.org/ontology/cites"));

    final Plan plan = plan(List.of(holder), List.of(new StoredRelationType(missingId, "cites")));

    assertEquals(
        URI.create("https://open-metadata.org/ontology/relationshipType/" + missingId),
        plan.recreated().getFirst().getRdfPredicate());
  }

  @Test
  void chainDisjointAndReplacementReferencesAreRepairedToo() {
    final RelationshipType deletedChainMember = type("step").withDeleted(true);
    final RelationshipType deletedDisjoint = type("excludes").withDeleted(true);
    final RelationshipType deletedReplacement = type("successor").withDeleted(true);
    final RelationshipType owner =
        type("owner")
            .withPropertyChain(
                List.of(reference(deletedChainMember), reference(deletedChainMember)))
            .withDisjointWith(Set.of(reference(deletedDisjoint)))
            .withReplacedBy(reference(deletedReplacement));

    final Plan plan =
        plan(List.of(owner, deletedChainMember, deletedDisjoint, deletedReplacement), List.of());

    assertEquals(
        Set.of("step", "excludes", "successor"),
        Set.copyOf(plan.restored().stream().map(RelationshipType::getName).toList()));
  }

  @Test
  void aForwardReferenceWithoutAnIdIsLeftAlone() {
    final RelationshipType owner =
        type("owner")
            .withInverse(
                new EntityReference()
                    .withType(Entity.RELATIONSHIP_TYPE)
                    .withFullyQualifiedName("notYetCreated"));

    assertTrue(plan(List.of(owner), List.of()).isEmpty());
  }

  @Test
  void aRelationRowNamingNoTypeIsReportedNotGuessed() {
    final UUID missingId = UUID.randomUUID();

    final Plan plan = plan(List.of(), List.of(new StoredRelationType(missingId, null)));

    assertTrue(plan.isEmpty());
    assertEquals(1, plan.unresolved().size());
    assertTrue(plan.unresolved().getFirst().contains(missingId.toString()));
  }

  @Test
  void liveReferencesNeedNothing() {
    final RelationshipType partner = type("partOf");
    final RelationshipType owner = type("hasPart").withInverse(reference(partner));

    final Plan plan =
        plan(List.of(owner, partner), List.of(new StoredRelationType(partner.getId(), "partOf")));

    assertTrue(plan.isEmpty());
    assertTrue(plan.unresolved().isEmpty());
  }

  @Test
  void aSoftDeletedPairNothingLiveUsesStaysDeleted() {
    final RelationshipType first = type("precedes").withDeleted(true);
    final RelationshipType second = type("follows").withDeleted(true);
    first.setInverse(reference(second));
    second.setInverse(reference(first));

    assertTrue(plan(List.of(first, second), List.of()).isEmpty());
  }

  @Test
  void anUndeletedTypeBringsBackTheDeletedTypesItReferences() {
    final RelationshipType deepest = type("ancestorOf").withDeleted(true);
    final RelationshipType middle =
        type("parentOf").withDeleted(true).withReplacedBy(reference(deepest));
    final RelationshipType owner = type("childOf").withInverse(reference(middle));

    final Plan plan = plan(List.of(owner, middle, deepest), List.of());

    assertEquals(
        List.of("parentOf", "ancestorOf"),
        plan.restored().stream().map(RelationshipType::getName).toList());
  }

  @Test
  void aBackLinkKeepsThePartnersNamelessReferenceShape() {
    final UUID missingId = UUID.randomUUID();
    final RelationshipType owner =
        type("hasPart")
            .withInverse(
                new EntityReference()
                    .withId(missingId)
                    .withType(Entity.RELATIONSHIP_TYPE)
                    .withFullyQualifiedName("partOf"));

    final Plan plan = plan(List.of(owner), List.of());

    final EntityReference backLink = plan.recreated().getFirst().getInverse();
    assertEquals(owner.getId(), backLink.getId());
    assertEquals("hasPart", backLink.getFullyQualifiedName());
    assertNull(backLink.getName(), "a nameless partner reference never inverted relations");
  }

  @Test
  void aTypeRecreatedForOneDemandIsNotRecreatedAgainForAnother() {
    final UUID missingId = UUID.randomUUID();
    final RelationshipType deleted =
        type("cites")
            .withDeleted(true)
            .withInverse(
                new EntityReference()
                    .withId(missingId)
                    .withType(Entity.RELATIONSHIP_TYPE)
                    .withName("citedBy")
                    .withFullyQualifiedName("citedBy"));

    final Plan plan =
        plan(
            List.of(deleted),
            List.of(
                new StoredRelationType(deleted.getId(), "cites"),
                new StoredRelationType(missingId, "citedBy")));

    assertEquals(
        List.of("cites"), plan.restored().stream().map(RelationshipType::getName).toList());
    assertEquals(
        List.of("citedBy"), plan.recreated().stream().map(RelationshipType::getName).toList());
  }

  private static Plan plan(
      final List<RelationshipType> types, final List<StoredRelationType> stored) {
    return new RelationshipTypeRepairPlanner(types, CLOCK).plan(stored);
  }

  private static RelationshipType type(final String name) {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withRdfPredicate(URI.create("https://example.org/" + name))
        .withDeleted(false);
  }

  private static EntityReference reference(final RelationshipType type) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withName(type.getName())
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }
}
