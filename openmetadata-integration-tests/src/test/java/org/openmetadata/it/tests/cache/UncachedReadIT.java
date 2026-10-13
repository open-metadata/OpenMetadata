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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.NotFoundCache;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * A read that bypasses the cache is answered by the database, whatever the not-found cache holds. A
 * marker left for an entity that still exists hides it from cached reads only, until it expires.
 *
 * <p>Tests are skipped without a Redis cache provider, which is what the not-found cache needs.
 */
@ExtendWith(TestNamespaceExtension.class)
class UncachedReadIT {

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "The not-found cache needs cacheProvider=redis (set by -Pcache-tests)");
  }

  @Test
  void aNotFoundMarkerDoesNotHideALiveEntityFromAnUncachedRead(TestNamespace ns) {
    Table table = createTable(ns);
    UUID id = table.getId();
    String fqn = table.getFullyQualifiedName();
    NotFoundCache notFound = CacheBundle.getNotFoundCache();
    notFound.markNotFoundById(Entity.TABLE, id);
    notFound.markNotFoundByName(Entity.TABLE, fqn);
    try {
      assertEquals(id, tables().find(id, Include.NON_DELETED, false).getId());
      assertEquals(id, tables().findByName(fqn, Include.NON_DELETED, false).getId());
      assertEquals(
          id, tables().get(null, id, tables().getFields("id"), Include.NON_DELETED, false).getId());
      try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
        assertEquals(id, tables().find(id, Include.NON_DELETED).getId());
      }

      assertThrows(
          EntityNotFoundException.class,
          () -> tables().find(id, Include.NON_DELETED),
          "a cached read still takes the marker's word");
    } finally {
      notFound.invalidate(Entity.TABLE, id, fqn);
      RequestEntityCache.clear();
    }
  }

  private static TableRepository tables() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private static Table createTable(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Column column = new Column().withName("id").withDataType(ColumnDataType.INT);
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.shortPrefix("uncached_read_tbl"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(column)));
  }
}
