/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

class QueryRepositoryParentEntityTest {

  private static final String FIELDS = Entity.FIELD_OWNERS;

  private MockedStatic<Entity> mockedEntity;
  private DatabaseService service;

  @BeforeEach
  void setUp() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.queryDAO()).thenReturn(mock(CollectionDAO.QueryDAO.class));

    service =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("mysql_prod")
            .withFullyQualifiedName("mysql_prod");

    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    // The repository constructor validates its patch and update fields against this set.
    mockedEntity
        .when(() -> Entity.getEntityFields(Query.class))
        .thenReturn(Set.of("users", "query", "queryUsedIn", "processedLineage"));
  }

  @AfterEach
  void tearDown() {
    mockedEntity.close();
  }

  @Test
  void getParentEntity_returnsNull_whenQueryHasNoService() {
    assertNull(new QueryRepository().getParentEntity(new Query(), FIELDS));
  }

  @Test
  void getParentEntity_resolvesServiceWithIncludeAll_whenServicePresent() {
    final EntityReference serviceRef =
        new EntityReference()
            .withId(service.getId())
            .withType(Entity.DATABASE_SERVICE)
            .withName(service.getName())
            .withFullyQualifiedName(service.getFullyQualifiedName());
    mockedEntity.when(() -> Entity.getEntity(serviceRef, FIELDS, Include.ALL)).thenReturn(service);

    assertSame(
        service,
        new QueryRepository().getParentEntity(new Query().withService(serviceRef), FIELDS));
  }
}
