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
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.delete.EntityDeleteFixture;
import org.openmetadata.service.entity.delete.EntityDeleteFixture.Deletion;
import org.openmetadata.service.entity.read.EntityLookupTestContext;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityCreationFixture;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;

@ExtendWith(MockitoExtension.class)
class LegacyRelationshipTypeSynchronizerTest {
  @RegisterExtension private final EntityLookupTestContext lookups = new EntityLookupTestContext();
  private static final Instant NOW = Instant.parse("2026-07-18T00:00:00Z");
  private static final String UPDATED_BY = "admin";

  @Mock private RelationshipTypeRepository repository;
  private EntityDAO<RelationshipType> relationshipRows;
  private EntityCreationFixture<RelationshipType> creations;
  private EntityDeleteFixture<RelationshipType> deletions;

  private LegacyRelationshipTypeSynchronizer synchronizer;

  @BeforeEach
  void setUp() {
    deletions = EntityDeleteFixture.attach(repository);
    relationshipRows = lookups.attach(repository, Entity.RELATIONSHIP_TYPE, RelationshipType.class);
    creations =
        EntityCreationFixture.attach(repository)
            .onUpsert(
                request -> {
                  assertNull(request.uri());
                  assertEquals(new EntityCommandActor(UPDATED_BY, null), request.actor());
                  assertEquals(false, request.importMode());
                  return null;
                });

    LegacyRelationshipTypeMapper mapper =
        new LegacyRelationshipTypeMapper(Clock.fixed(NOW, ZoneOffset.UTC));
    synchronizer = new LegacyRelationshipTypeSynchronizer(repository, mapper);
  }

  @Test
  void deletesNamesPresentInPreviousButAbsentFromUpdatedSettings() {
    UUID removedId = UUID.randomUUID();
    RelationshipType removed = existing(removedId, "governs", false);
    when(relationshipRows.findEntityByName("keeps", Include.ALL)).thenReturn(null);
    when(relationshipRows.findEntityByName("governs", Include.ALL)).thenReturn(removed);
    GlossaryTermRelationSettings previous = settings("keeps", "governs");
    GlossaryTermRelationSettings updated = settings("keeps");

    synchronizer.synchronize(previous, updated, null, UPDATED_BY);

    assertEquals(List.of(new Deletion(UPDATED_BY, removedId, false, true)), deletions.deletions());
  }

  @Test
  void doesNotDeleteRemovedTypeThatIsSystemDefined() {
    RelationshipType removed = existing(UUID.randomUUID(), "governs", true);
    when(relationshipRows.findEntityByName("keeps", Include.ALL)).thenReturn(null);
    when(relationshipRows.findEntityByName("governs", Include.ALL)).thenReturn(removed);
    GlossaryTermRelationSettings previous = settings("keeps", "governs");
    GlossaryTermRelationSettings updated = settings("keeps");

    synchronizer.synchronize(previous, updated, null, UPDATED_BY);

    assertTrue(deletions.deletions().isEmpty());
  }

  @Test
  void upsertPreservesIdentityFieldsOfExistingType() {
    UUID existingId = UUID.randomUUID();
    List<EntityReference> owners = List.of(new EntityReference().withId(UUID.randomUUID()));
    List<EntityReference> reviewers = List.of(new EntityReference().withId(UUID.randomUUID()));
    RelationshipType existing =
        existing(existingId, "governs", true)
            .withProvider(ProviderType.SYSTEM)
            .withOwners(owners)
            .withReviewers(reviewers);
    when(relationshipRows.findEntityByName("governs", Include.ALL)).thenReturn(existing);
    GlossaryTermRelationSettings updated = settings("governs");

    synchronizer.synchronize(null, updated, null, UPDATED_BY);

    RelationshipType persisted = capturePersisted();
    assertEquals(existingId, persisted.getId());
    assertEquals(Boolean.TRUE, persisted.getSystemDefined());
    assertEquals(ProviderType.SYSTEM, persisted.getProvider());
    assertSame(owners, persisted.getOwners());
    assertSame(reviewers, persisted.getReviewers());
  }

  @Test
  void upsertOfNewTypeDoesNotCopyIdentityFields() {
    when(relationshipRows.findEntityByName("governs", Include.ALL)).thenReturn(null);
    GlossaryTermRelationSettings updated = settings("governs");

    synchronizer.synchronize(null, updated, null, UPDATED_BY);

    RelationshipType persisted = capturePersisted();
    assertEquals(RelationshipTypeIds.stableId("governs"), persisted.getId());
    assertEquals(Boolean.FALSE, persisted.getSystemDefined());
    assertEquals(ProviderType.USER, persisted.getProvider());
    assertNull(persisted.getOwners());
    assertNull(persisted.getReviewers());
  }

  @Test
  void nullPreviousSettingsProduceNoSpuriousDeletes() {
    when(relationshipRows.findEntityByName("governs", Include.ALL)).thenReturn(null);
    GlossaryTermRelationSettings updated = settings("governs");

    synchronizer.synchronize(null, updated, null, UPDATED_BY);

    assertTrue(deletions.deletions().isEmpty());
    assertEquals(1, creations.upserts().size());
  }

  private RelationshipType capturePersisted() {
    assertEquals(1, creations.upserts().size());
    return creations.upserts().getFirst().entity();
  }

  private static RelationshipType existing(UUID id, String name, boolean systemDefined) {
    return new RelationshipType().withId(id).withName(name).withSystemDefined(systemDefined);
  }

  private static GlossaryTermRelationSettings settings(String... names) {
    List<GlossaryTermRelationType> types =
        List.of(names).stream().map(LegacyRelationshipTypeSynchronizerTest::relationType).toList();
    return new GlossaryTermRelationSettings().withRelationTypes(types);
  }

  private static GlossaryTermRelationType relationType(String name) {
    return new GlossaryTermRelationType()
        .withName(name)
        .withDisplayName(name)
        .withDescription(name)
        .withCategory(RelationCategory.ASSOCIATIVE)
        .withIsCrossGlossaryAllowed(true)
        .withIsSystemDefined(false);
  }
}
