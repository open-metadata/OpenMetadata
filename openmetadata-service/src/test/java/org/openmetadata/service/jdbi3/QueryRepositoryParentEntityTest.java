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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * Regression coverage for {@link QueryRepository#getParentEntity(Query, String)}.
 *
 * <p>A Query's ownership-policy evaluation uses its parent (the DatabaseService it belongs to) to
 * resolve inherited owners. The override must (1) return {@code null} when the Query carries no
 * service reference, so policy evaluation degrades gracefully instead of throwing an NPE, and (2)
 * resolve the referenced service — with {@link Include#ALL} — when the reference is present.
 */
class QueryRepositoryParentEntityTest {

  private static final String FIELDS = "owners";

  private MockedStatic<Entity> mockedEntity;
  private CollectionDAO collectionDAO;
  private DatabaseService service;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.queryDAO()).thenReturn(mock(CollectionDAO.QueryDAO.class));

    service =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("mysql_prod")
            .withFullyQualifiedName("mysql_prod");

    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    mockedEntity
        .when(() -> Entity.getEntity(any(EntityReference.class), eq(FIELDS), eq(Include.ALL)))
        .thenReturn(service);
  }

  @AfterEach
  void tearDown() {
    mockedEntity.close();
  }

  @Test
  void getParentEntity_returnsNull_whenQueryHasNoService() {
    Query query = new Query().withId(UUID.randomUUID()).withName("q").withQuery("SELECT 1");

    EntityInterface parent = new QueryRepository().getParentEntity(query, FIELDS);

    assertNull(
        parent,
        "A Query with no service must not resolve a parent, and must not throw during "
            + "ownership-policy evaluation");
  }

  @Test
  void getParentEntity_resolvesServiceWithIncludeAll_whenServicePresent() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(service.getId())
            .withType(Entity.DATABASE_SERVICE)
            .withName(service.getName())
            .withFullyQualifiedName(service.getFullyQualifiedName());
    Query query =
        new Query()
            .withId(UUID.randomUUID())
            .withName("q")
            .withQuery("SELECT 1")
            .withService(serviceRef);

    EntityInterface parent = new QueryRepository().getParentEntity(query, FIELDS);

    assertSame(
        service,
        parent,
        "The Query's service reference must be resolved as the parent entity");
    assertEquals("mysql_prod", parent.getName());
  }
}