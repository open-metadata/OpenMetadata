/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Stored parent references are re-read on access, per
 * ADR:2026-11-27-stored-parent-references-are-resolved-on-read. The database store is the boundary
 * here: it serves the parent's current reference, or reports it gone.
 */
class EntityRepositoryCurrentReferenceTest {

  private EntityRepository<Database> databases;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void registerDatabaseStore() {
    databases = mock(EntityRepository.class);
    Entity.registerEntity(Database.class, Entity.DATABASE, databases);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void storedReferenceTakesTheParentsCurrentDisplayName() {
    EntityReference stored = databaseReference("db");
    EntityReference current = databaseReference("Renamed").withId(stored.getId());
    when(databases.getReference(stored.getId(), ALL)).thenReturn(current);

    assertEquals("Renamed", EntityRepository.currentReference(stored).getDisplayName());
  }

  @Test
  void storedReferenceIsKeptWhenTheParentIsGone() {
    EntityReference stored = databaseReference("db");
    when(databases.getReference(stored.getId(), ALL))
        .thenThrow(EntityNotFoundException.byId(stored.getId().toString()));

    assertSame(stored, EntityRepository.currentReference(stored));
  }

  @Test
  void bulkRefreshUpdatesFoundParentsAndKeepsMissingOnes() {
    EntityReference renamedParent = databaseReference("db1");
    EntityReference missingParent = databaseReference("db2");
    Table childOfRenamed = new Table().withDatabase(renamedParent);
    Table childOfMissing = new Table().withDatabase(missingParent);
    when(databases.getReferences(anyList(), eq(ALL)))
        .thenReturn(List.of(databaseReference("Renamed").withId(renamedParent.getId())));

    EntityRepository.refreshStoredReferences(
        List.of(childOfRenamed, childOfMissing),
        Entity.DATABASE,
        Table::getDatabase,
        Table::setDatabase);

    assertEquals("Renamed", childOfRenamed.getDatabase().getDisplayName());
    assertSame(missingParent, childOfMissing.getDatabase());
  }

  private static EntityReference databaseReference(String displayName) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.DATABASE)
        .withDisplayName(displayName);
  }
}
