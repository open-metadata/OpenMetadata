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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.migration.utils.MigrationVersionUtil;

class OntologySqlMigrationParityTest {
  private static final Pattern MYSQL_TABLE_COLLATION =
      Pattern.compile("default\\s+charset=utf8mb4\\s+collate=([a-z0-9_]+)");
  private static final Set<String> CANONICAL_MYSQL_TABLE_COLLATIONS = Set.of("utf8mb4_0900_ai_ci");
  private static final List<String> ONTOLOGY_TABLES =
      List.of(
          "relationship_type_entity",
          "ontology_axiom_entity",
          "ontology_change_set_entity",
          "ontology_annex",
          "ontology_edit_lock",
          "rdf_inference_rule");

  @Test
  void mysqlFreshInstallAndUpgradeTableCollationsStayAligned() throws IOException {
    final DialectSql mysql =
        dialects().filter(dialect -> dialect.name().equals("mysql")).findFirst().orElseThrow();

    assertEquals(
        CANONICAL_MYSQL_TABLE_COLLATIONS, ontologyTableCollations(readFreshInstall(mysql)));
    assertEquals(
        CANONICAL_MYSQL_TABLE_COLLATIONS, ontologyTableCollations(read(mysql.schemaChanges())));
  }

  @ParameterizedTest(name = "{0} fresh install and 2.1 upgrade schemas stay aligned")
  @MethodSource("dialects")
  void freshInstallAndUpgradeSchemasStayAligned(final DialectSql dialect) throws IOException {
    final String freshInstall = readFreshInstall(dialect);
    final String upgrade = read(dialect.schemaChanges());

    for (final String table : ONTOLOGY_TABLES) {
      assertContains(freshInstall, table, dialect.name() + " fresh-install schema");
      assertContains(upgrade, table, dialect.name() + " 2.1 migration");
    }
    assertRelationshipColumns(freshInstall, dialect);
    assertRelationshipColumns(upgrade, dialect);
  }

  @ParameterizedTest(name = "{0} custom ontology storage exists in fresh install and upgrade")
  @MethodSource("dialects")
  void customOntologyStorageStaysAligned(final DialectSql dialect) throws IOException {
    assertContains(
        readFreshInstall(dialect), "rdf_custom_ontology", dialect.name() + " fresh-install schema");
    assertContains(
        read(dialect.schemaChanges()), "rdf_custom_ontology", dialect.name() + " 2.1.0 migration");
  }

  @ParameterizedTest(name = "{0} upgrade backfills typed relationships and RDF rebuild")
  @MethodSource("dialects")
  void upgradeBackfillsRelationshipIdentityAndInvalidatesProjectionStatus(final DialectSql dialect)
      throws IOException {
    final String postData = read(dialect.postDataMigration());

    for (final String token :
        List.of(
            "relationshipid",
            "relationshiptypeid",
            "relationship_type_entity",
            "appconfiguration",
            "entities",
            "apps_extension_time_series",
            "searchindexingapplication")) {
      assertContains(postData, token, dialect.name() + " post-data migration");
    }
  }

  private static void assertRelationshipColumns(final String sql, final DialectSql dialect) {
    assertContains(sql, "relationshipid", dialect.name() + " relationship identity");
    assertContains(sql, "relationshiptypeid", dialect.name() + " typed relationship");
    assertContains(sql, dialect.relationshipIndex(), dialect.name() + " relationship index");
  }

  private static void assertContains(
      final String sql, final String token, final String description) {
    assertTrue(sql.contains(token.toLowerCase(Locale.ROOT)), description + " is missing " + token);
  }

  private static String read(final Path path) throws IOException {
    return Files.readString(path).toLowerCase(Locale.ROOT);
  }

  private static String readFreshInstall(final DialectSql dialect) throws IOException {
    final StringBuilder sql = new StringBuilder(read(dialect.baselineSchema()));
    for (final Path schemaChanges : liveSchemaChanges(dialect)) {
      sql.append('\n').append(read(schemaChanges));
    }
    return sql.toString();
  }

  private static List<Path> liveSchemaChanges(final DialectSql dialect) throws IOException {
    try (Stream<Path> versions = Files.list(dialect.nativeMigrations())) {
      return versions
          .filter(Files::isDirectory)
          .filter(path -> MigrationVersionUtil.isParseable(version(path)))
          .filter(path -> !MigrationVersionUtil.isBelowMinimum(version(path)))
          .sorted(
              (left, right) -> MigrationVersionUtil.compareVersions(version(left), version(right)))
          .map(path -> path.resolve(dialect.name() + "/schemaChanges.sql"))
          .filter(Files::isRegularFile)
          .toList();
    }
  }

  private static String version(final Path path) {
    return path.getFileName().toString();
  }

  private static Set<String> ontologyTableCollations(final String sql) {
    return ONTOLOGY_TABLES.stream()
        .map(table -> tableCollation(sql, table))
        .collect(Collectors.toUnmodifiableSet());
  }

  private static String tableCollation(final String sql, final String table) {
    final Pattern createTable =
        Pattern.compile("create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?" + Pattern.quote(table));
    final Matcher tableStart = createTable.matcher(sql);
    assertTrue(tableStart.find(), "MySQL schema is missing table " + table);
    final int tableEnd = sql.indexOf(';', tableStart.start());
    assertTrue(tableEnd > tableStart.start(), "MySQL schema has an incomplete table " + table);

    final Matcher collation =
        MYSQL_TABLE_COLLATION.matcher(sql.substring(tableStart.start(), tableEnd));
    assertTrue(collation.find(), "MySQL table is missing a default collation: " + table);
    return collation.group(1);
  }

  private static Stream<DialectSql> dialects() {
    final Path root = repositoryRoot();
    final Path migrations = root.resolve("bootstrap/sql/migrations/native");
    return Stream.of(
        dialect(root, migrations, "mysql", "relationship_type_id_index"),
        dialect(root, migrations, "postgres", "entity_relationship_type_id_index"));
  }

  private static DialectSql dialect(
      final Path root, final Path migrations, final String name, final String relationshipIndex) {
    return new DialectSql(
        name,
        root.resolve("bootstrap/sql/migrations/baseline/" + name + "/schema.sql"),
        migrations,
        migrations.resolve("2.1.0/" + name + "/schemaChanges.sql"),
        migrations.resolve("2.1.0/" + name + "/postDataMigrationSQLScript.sql"),
        relationshipIndex);
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null
        && !Files.exists(current.resolve("bootstrap/sql/migrations/baseline/mysql/schema.sql"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }

  private record DialectSql(
      String name,
      Path baselineSchema,
      Path nativeMigrations,
      Path schemaChanges,
      Path postDataMigration,
      String relationshipIndex) {
    @Override
    public String toString() {
      return name;
    }
  }
}
