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

package org.openmetadata.service.fernet.rotation;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Refused;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Scope;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlTable;

/** The stores one run reads: SQL tables first, in catalog order, then Redis. */
final class TokenStores {

  /**
   * @param stores what to read, SQL before Redis
   * @param leftOut the tables of the schema that a run without {@code --every-table} left out
   * @param tables how many tables are read
   * @param columns how many eligible columns they have
   */
  record Discovery(List<TokenStore> stores, List<String> leftOut, int tables, int columns) {}

  private static final List<String> REQUIRED =
      List.of(VersionsStore.TABLE, "openmetadata_settings");

  private TokenStores() {}

  static Discovery discover(
      Handle handle, Dialect dialect, Optional<RedisTokenStore> redis, Scope scope) {
    List<SqlTable> catalog = SqlCatalog.read(handle, dialect);
    List<String> missing = missingOpenMetadataTables(catalog);
    if (!missing.isEmpty()) {
      throw new Refused(
          "The schema this host reads ("
              + dialect.currentSchema()
              + " is "
              + currentSchemaName(handle, dialect)
              + ") has no "
              + String.join(" or ", missing)
              + " table, so it is not an OpenMetadata database. Point this host's database"
              + " settings at the servers' database.");
    }
    List<SqlTable> read =
        scope == Scope.EVERY_TABLE
            ? catalog
            : catalog.stream().filter(table -> !LargeTables.isLarge(table.name())).toList();
    List<TokenStore> stores = new ArrayList<>();
    for (SqlTable table : read) {
      if (scope == Scope.EVERY_TABLE || !isVersions(table)) {
        stores.add(new SqlTableStore(handle, dialect, table));
      }
    }
    if (scope == Scope.SKIP_LARGE_TABLES) {
      // The versions table is not an id table of its own: walking its ids would read every version.
      List<SqlTable> entityTables = read.stream().filter(table -> !isVersions(table)).toList();
      read.stream()
          .filter(TokenStores::isVersions)
          .findFirst()
          .ifPresent(
              versions -> stores.add(new VersionsStore(handle, dialect, versions, entityTables)));
    }
    redis.ifPresent(stores::add);
    List<String> leftOut =
        catalog.stream()
            .map(SqlTable::name)
            .filter(table -> !read.stream().anyMatch(it -> it.name().equals(table)))
            .toList();
    return new Discovery(
        List.copyOf(stores),
        leftOut,
        read.size(),
        read.stream().mapToInt(table -> table.columns().size()).sum());
  }

  /** The tables every OpenMetadata schema has, whichever release created it. */
  static List<String> missingOpenMetadataTables(List<SqlTable> catalog) {
    return REQUIRED.stream()
        .filter(required -> catalog.stream().noneMatch(it -> it.name().equalsIgnoreCase(required)))
        .toList();
  }

  private static String currentSchemaName(Handle handle, Dialect dialect) {
    return String.valueOf(
        handle.createQuery("SELECT " + dialect.currentSchema()).mapTo(String.class).one());
  }

  private static boolean isVersions(SqlTable table) {
    return table.name().equalsIgnoreCase(VersionsStore.TABLE);
  }
}
