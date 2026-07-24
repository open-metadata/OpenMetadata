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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;

@ExtendWith(MockitoExtension.class)
class LegacyRelationshipTypeSynchronizerTest {
  private static final Instant NOW = Instant.parse("2026-07-18T00:00:00Z");
  private static final String UPDATED_BY = "admin";

  @Mock private RelationshipTypeRepository repository;

  private LegacyRelationshipTypeSynchronizer synchronizer;

  @BeforeEach
  void setUp() {
    LegacyRelationshipTypeMapper mapper =
        new LegacyRelationshipTypeMapper(Clock.fixed(NOW, ZoneOffset.UTC));
    synchronizer = new LegacyRelationshipTypeSynchronizer(repository, mapper);
  }

  @Test
  void deletesNamesPresentInPreviousButAbsentFromUpdatedSettings() {
    UUID removedId = UUID.randomUUID();
    RelationshipType removed = existing(removedId, "governs", false);
    when(repository.findByNameOrNull("keeps", Include.ALL)).thenReturn(null);
    when(repository.findByNameOrNull("governs", Include.ALL)).thenReturn(removed);
    GlossaryTermRelationSettings previous = settings("keeps", "governs");
    GlossaryTermRelationSettings updated = settings("keeps");

    synchronizer.synchronize(previous, updated, null, UPDATED_BY);

    verify(repository).delete(UPDATED_BY, removedId, false, true);
  }

  @Test
  void doesNotDeleteRemovedTypeThatIsSystemDefined() {
    RelationshipType removed = existing(UUID.randomUUID(), "governs", true);
    when(repository.findByNameOrNull("keeps", Include.ALL)).thenReturn(null);
    when(repository.findByNameOrNull("governs", Include.ALL)).thenReturn(removed);
    GlossaryTermRelationSettings previous = settings("keeps", "governs");
    GlossaryTermRelationSettings updated = settings("keeps");

    synchronizer.synchronize(previous, updated, null, UPDATED_BY);

    verify(repository, never()).delete(any(), any(), anyBoolean(), anyBoolean());
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
    when(repository.findByNameOrNull("governs", Include.ALL)).thenReturn(existing);
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
    when(repository.findByNameOrNull("governs", Include.ALL)).thenReturn(null);
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
    when(repository.findByNameOrNull("governs", Include.ALL)).thenReturn(null);
    GlossaryTermRelationSettings updated = settings("governs");

    synchronizer.synchronize(null, updated, null, UPDATED_BY);

    verify(repository, never()).delete(any(), any(), anyBoolean(), anyBoolean());
    verify(repository).createOrUpdate(isNull(), any(RelationshipType.class), eq(UPDATED_BY));
  }

  private RelationshipType capturePersisted() {
    ArgumentCaptor<RelationshipType> captor = ArgumentCaptor.forClass(RelationshipType.class);
    verify(repository).createOrUpdate(isNull(), captor.capture(), eq(UPDATED_BY));
    return captor.getValue();
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
