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

package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.NotFoundCache;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * A hard delete that runs inside a larger unit of work records its entities as not found only once
 * that unit commits. Deleting a schema that contains a table exercises both paths: the schema goes
 * through {@code cleanup} and the table through the bulk subtree delete.
 *
 * <p>Tests are skipped without a Redis cache provider, which is what the not-found cache needs.
 */
@ExtendWith(TestNamespaceExtension.class)
class NestedHardDeleteIT {

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "The not-found cache needs cacheProvider=redis (set by -Pcache-tests)");
  }

  @Test
  void aNestedDeleteThatRollsBackLeavesItsEntitiesReadable(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table table = createTable(ns, schema);

    assertThrows(
        IllegalStateException.class,
        () ->
            schemas()
                .executeInTransaction(
                    () -> {
                      schemas().delete("admin", schema.getId(), true, true);
                      throw new IllegalStateException("the outer work failed");
                    }));

    assertFalse(notFound().isMarkedNotFoundById(Entity.DATABASE_SCHEMA, schema.getId()));
    assertFalse(notFound().isMarkedNotFoundById(Entity.TABLE, table.getId()));
    assertDoesNotThrow(
        () -> SdkClients.adminClient().databaseSchemas().get(schema.getId().toString()));
    assertDoesNotThrow(() -> SdkClients.adminClient().tables().get(table.getId().toString()));
  }

  @Test
  void aNestedDeleteThatCommitsRecordsItsEntitiesAsNotFound(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table table = createTable(ns, schema);

    schemas().executeInTransaction(() -> schemas().delete("admin", schema.getId(), true, true));

    assertTrue(notFound().isMarkedNotFoundById(Entity.DATABASE_SCHEMA, schema.getId()));
    assertTrue(notFound().isMarkedNotFoundById(Entity.TABLE, table.getId()));
  }

  @Test
  void aTopLevelDeleteRecordsItsEntitiesAsNotFound(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table table = createTable(ns, schema);

    schemas().delete("admin", schema.getId(), true, true);

    assertTrue(notFound().isMarkedNotFoundById(Entity.DATABASE_SCHEMA, schema.getId()));
    assertTrue(notFound().isMarkedNotFoundById(Entity.TABLE, table.getId()));
  }

  private static EntityRepository<?> schemas() {
    return Entity.getEntityRepository(Entity.DATABASE_SCHEMA);
  }

  private static NotFoundCache notFound() {
    return CacheBundle.getNotFoundCache();
  }

  private static Table createTable(TestNamespace ns, DatabaseSchema schema) {
    Column column = new Column().withName("id").withDataType(ColumnDataType.INT);
    CreateTable createTable =
        new CreateTable()
            .withName(ns.shortPrefix("nested_delete_tbl"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(column));
    return SdkClients.adminClient().tables().create(createTable);
  }
}
