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
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
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
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

/** A read in a {@link FreshReadScope} answers from the database, whatever the caches hold. */
@ExtendWith(TestNamespaceExtension.class)
class FreshReadIT {

  @Test
  void aNotFoundMarkerDoesNotAnswerAFreshRead(TestNamespace ns) {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the not-found cache needs Redis");
    Table table = createTable(ns);
    NotFoundCache notFound = CacheBundle.getNotFoundCache();
    notFound.markNotFoundById(Entity.TABLE, table.getId());
    notFound.markNotFoundByName(Entity.TABLE, table.getFullyQualifiedName());
    try {
      assertThrows(
          EntityNotFoundException.class,
          () -> tables().find(table.getId(), Include.NON_DELETED, false),
          "an ordinary read takes the marker's word");

      try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
        assertEquals(table.getId(), tables().get(null, table.getId(), idOnly()).getId());
        assertEquals(
            table.getId(),
            tables()
                .getByName(
                    null, table.getFullyQualifiedName(), idOnly(), Include.NON_DELETED, false)
                .getId());
      }
    } finally {
      notFound.invalidate(Entity.TABLE, table.getId(), table.getFullyQualifiedName());
    }
  }

  @Test
  void aFreshReadIsNotAnsweredByWhatItsThreadReadEarlier(TestNamespace ns) {
    Table table = createTable(ns);
    Fields description = tables().getFields("description");
    try {
      tables().get(null, table.getId(), description, Include.NON_DELETED, false);
      Table stored = tables().find(table.getId(), Include.NON_DELETED, false);
      Entity.getCollectionDAO().tableDAO().update(stored.withDescription("changed elsewhere"));

      assertEquals(
          table.getDescription(),
          tables()
              .get(null, table.getId(), description, Include.NON_DELETED, false)
              .getDescription(),
          "an ordinary read on this thread answers from what it read earlier");

      try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
        assertEquals(
            "changed elsewhere",
            tables()
                .get(null, table.getId(), description, Include.NON_DELETED, false)
                .getDescription());
      }
    } finally {
      RequestEntityCache.clear();
    }
  }

  private static TableRepository tables() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private static Fields idOnly() {
    return tables().getFields("id");
  }

  private static Table createTable(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Column column = new Column().withName("id").withDataType(ColumnDataType.INT);
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.shortPrefix("fresh_read_tbl"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withDescription("as created")
                .withColumns(List.of(column)));
  }
}
