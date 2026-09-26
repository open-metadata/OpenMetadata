/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

class TableRepositoryPatchFieldsTest {

  private static final Set<String> TABLE_ALLOWED_FIELDS =
      new HashSet<>(
          Arrays.asList(
              "id",
              "name",
              "displayName",
              "fullyQualifiedName",
              "description",
              "version",
              "updatedAt",
              "updatedBy",
              "href",
              "tableType",
              "columns",
              "tableConstraints",
              "tablePartition",
              "owners",
              "databaseSchema",
              "database",
              "service",
              "serviceType",
              "schemaDefinition",
              "tags",
              "usageSummary",
              "followers",
              "joins",
              "sampleData",
              "tableProfilerConfig",
              "customMetrics",
              "testSuite",
              "deleted",
              "extension",
              "domain",
              "dataProducts",
              "votes",
              "lifeCycle",
              "sourceHash",
              "pipelineObservability"));

  private TableRepository createRepo(MockedStatic<Entity> entityMock) {
    CollectionDAO dao = mock(CollectionDAO.class);
    EntityDataDAOs.TableDAO tableDAO = mock(EntityDataDAOs.TableDAO.class);
    when(dao.tableDAO()).thenReturn(tableDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.TABLE))
        .thenReturn(Table.class);
    entityMock
        .when(() -> Entity.registerResourcePermissions(Entity.TABLE, null))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.registerResourceFieldViewMapping(Entity.TABLE, null))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.getEntityFields(Table.class))
        .thenReturn(TABLE_ALLOWED_FIELDS);
    return new TableRepository();
  }

  /** schemaDefinition must be in PATCH_FIELDS so the PATCH projection includes it. */
  @Test
  void patchFieldsContainsSchemaDefinition() {
    assert TableRepository.PATCH_FIELDS.contains("schemaDefinition")
        : "schemaDefinition must be in PATCH_FIELDS (fix for #32625)";
  }

  /**
   * clearFields must preserve schemaDefinition when the field set (built from PATCH_FIELDS)
   * includes it. Before the fix, schemaDefinition was absent from PATCH_FIELDS, so every PATCH
   * silently nulled the stored DDL.
   */
  @Test
  void clearFieldsPreservesSchemaDefinitionWhenIncluded() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      TableRepository repo = createRepo(entityMock);

      Table table = new Table().withId(UUID.randomUUID()).withName("view_table");
      table.setSchemaDefinition("CREATE VIEW view_table AS SELECT * FROM src");

      Fields patchFields = new Fields(Set.of("schemaDefinition"));
      repo.clearFields(table, patchFields);

      assertNotNull(table.getSchemaDefinition());
      assertEquals("CREATE VIEW view_table AS SELECT * FROM src", table.getSchemaDefinition());
    }
  }

  /**
   * clearFields must null schemaDefinition when it is absent from the field set, e.g. when loading
   * a Table without the schemaDefinition projection.
   */
  @Test
  void clearFieldsNullsSchemaDefinitionWhenExcluded() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      TableRepository repo = createRepo(entityMock);

      Table table = new Table().withId(UUID.randomUUID()).withName("view_table");
      table.setSchemaDefinition("CREATE VIEW view_table AS SELECT * FROM src");

      repo.clearFields(table, Fields.EMPTY_FIELDS);

      assertNull(table.getSchemaDefinition());
    }
  }
}
