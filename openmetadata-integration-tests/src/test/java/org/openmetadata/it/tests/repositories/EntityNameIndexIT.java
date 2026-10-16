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
package org.openmetadata.it.tests.repositories;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;

/**
 * Guards the schema invariant the distributed reindex depends on: every non-time-series entity
 * table is paginated with {@code ORDER BY name, id} — by {@code EntityRepository.getCursorAtOffset}
 * (partition-boundary cursor), the coordinator boundary walk, and the keyset batch reads. {@code
 * name} is a generated column derived from {@code json}, so a table without a LEADING-{@code name}
 * index forces that ORDER BY into a filesort that materializes {@code name} from the {@code json}
 * blob for every scanned row and can throw {@code ER_OUT_OF_SORTMEMORY} ("Out of sort memory") on
 * large catalogs (the cost scales with the OFFSET).
 *
 * <p>This is the regression guard for the index drift that caused that failure: index migrations
 * were maintained per-dialect and per-table, so newly added entity tables (and tables given only a
 * {@code (deleted, name, id)} composite, whose leading {@code deleted} column cannot serve the
 * unfiltered reindex ORDER BY) silently lost their leading-{@code name} index. Asserting the
 * invariant across the whole indexed entity catalog fails fast the next time a reindexable table is
 * added without one, on whichever database the suite runs against.
 */
class EntityNameIndexIT {

  /**
   * {@code learning_resource_entity.name} is {@code varchar(3072)}, which exceeds MySQL's 3072-byte
   * index key limit (utf8mb4); it is intentionally not indexed and is small enough that the reindex
   * cursor sort is not a concern.
   */
  private static final Set<String> EXEMPT_TABLES = Set.of("learning_resource_entity");

  @BeforeAll
  static void setupAll() {
    // Ensure the IT server is up so the entity registry is loaded and the migrated schema exists.
    SdkClients.adminClient();
  }

  @Test
  void everyReindexableEntityTableHasLeadingNameIndex() throws SQLException {
    Set<String> tables = reindexableEntityTables();
    assertTrue(
        tables.size() > 30,
        "Expected to inspect the indexed entity catalog but found only "
            + tables.size()
            + " tables");

    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    List<String> missing =
        jdbi.withHandle(
            handle -> findTablesMissingLeadingNameIndex(handle.getConnection(), tables));

    assertTrue(
        missing.isEmpty(),
        "Entity tables paginated by `ORDER BY name, id` during reindex must have a leading-`name` "
            + "index, otherwise their cursor query filesorts and can throw ER_OUT_OF_SORTMEMORY on "
            + "large catalogs. Tables missing the index: "
            + missing);
  }

  private Set<String> reindexableEntityTables() {
    // The reindex processes exactly the entity types with a search index (getAll() in
    // ReindexingOrchestrator is searchRepository.getEntityIndexMap().keySet()), so this is the
    // precise set of tables paginated by the name cursor — no more (app, changeEvent, … are not
    // reindexed), no less.
    SearchRepository searchRepository = Entity.getSearchRepository();
    Set<String> tables = new TreeSet<>();
    for (String entityType : searchRepository.getEntityIndexMap().keySet()) {
      if (SearchIndexEntityTypes.isTimeSeriesEntity(entityType)) {
        continue;
      }
      try {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        tables.add(repository.getDao().getTableName().toLowerCase(Locale.ROOT));
      } catch (EntityNotFoundException ignored) {
        // Index keys without a relational EntityRepository (sub-documents like tableColumn,
        // time-series report data) are not paginated by the name cursor — skip them.
      }
    }
    return tables;
  }

  private List<String> findTablesMissingLeadingNameIndex(Connection connection, Set<String> tables)
      throws SQLException {
    boolean mysql = "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"));
    String catalog = mysql ? connection.getCatalog() : null;
    String schema = mysql ? null : "public";
    DatabaseMetaData metaData = connection.getMetaData();

    List<String> missing = new ArrayList<>();
    for (String table : tables) {
      boolean relevant =
          !EXEMPT_TABLES.contains(table) && hasNameColumn(metaData, catalog, schema, table);
      if (relevant && !hasLeadingNameIndex(metaData, catalog, schema, table)) {
        missing.add(table);
      }
    }
    return missing;
  }

  private boolean hasNameColumn(
      DatabaseMetaData metaData, String catalog, String schema, String table) throws SQLException {
    boolean present;
    try (ResultSet columns = metaData.getColumns(catalog, schema, table, "name")) {
      present = columns.next();
    }
    return present;
  }

  private boolean hasLeadingNameIndex(
      DatabaseMetaData metaData, String catalog, String schema, String table) throws SQLException {
    boolean leadingName = false;
    try (ResultSet indexes = metaData.getIndexInfo(catalog, schema, table, false, false)) {
      while (indexes.next()) {
        boolean firstColumnIsName =
            indexes.getShort("ORDINAL_POSITION") == 1
                && "name".equalsIgnoreCase(indexes.getString("COLUMN_NAME"));
        if (firstColumnIsName) {
          leadingName = true;
        }
      }
    }
    return leadingName;
  }
}
