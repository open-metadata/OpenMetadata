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
package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

/**
 * Unit coverage for {@link GlossaryTermResource#permissionAssets}: {@code tableColumn} assets are
 * edited through their parent table, so the type-level permission check must see them as tables
 * while the original references reach the repository unchanged.
 */
class GlossaryTermResourcePermissionAssetsTest {
  private MockedStatic<Entity> entityMock;
  private GlossaryTermResource glossaryTermResource;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    GlossaryTermRepository repository = mock(GlossaryTermRepository.class);
    when(repository.getAllowedFields())
        .thenReturn(Set.of("children", "relatedTerms", "usageCount", "tags"));
    entityMock.when(() -> Entity.getEntityRepository(Entity.GLOSSARY_TERM)).thenReturn(repository);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.GLOSSARY_TERM))
        .thenReturn(GlossaryTerm.class);
    glossaryTermResource = new GlossaryTermResource(mock(Authorizer.class), mock(Limits.class));
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  @Test
  void mapsTableColumnAssetsToParentTable() {
    EntityReference column = asset(Entity.TABLE_COLUMN, "svc.db.schema.table1.col1");
    EntityReference table = asset(Entity.TABLE, "svc.db.schema.table1");

    List<EntityReference> mapped = glossaryTermResource.permissionAssets(List.of(column, table));

    assertEquals(Entity.TABLE, mapped.getFirst().getType());
    assertEquals("svc.db.schema.table1.col1", mapped.getFirst().getFullyQualifiedName());
    assertSame(table, mapped.get(1));

    // The column mapping must not mutate the caller's reference in place: the original
    // column (which reaches the repository unchanged) stays a distinct TABLE_COLUMN.
    assertNotSame(column, mapped.getFirst());
    assertEquals(Entity.TABLE_COLUMN, column.getType());
  }

  @Test
  void passesThroughNullAndEmptyAssets() {
    assertNull(glossaryTermResource.permissionAssets(null));
    assertTrue(glossaryTermResource.permissionAssets(List.of()).isEmpty());
  }

  private static EntityReference asset(String type, String fullyQualifiedName) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withFullyQualifiedName(fullyQualifiedName);
  }
}
