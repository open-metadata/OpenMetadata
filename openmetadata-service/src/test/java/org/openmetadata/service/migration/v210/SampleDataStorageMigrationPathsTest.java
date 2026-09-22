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

package org.openmetadata.service.migration.v210;

import static java.util.Objects.requireNonNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * External S3 sample-data storage was removed in 2.1.0 (collate#5995) and the tightened
 * {@code sampleDataStorageConfig} schema admits an empty object and nothing else, so the backfill
 * has to reach every place a stored document can still hold the old shape.
 *
 * <p>That set is a property of the schema graph, not of the migration. Hard-coding it on both sides
 * only proves the two copies agree. This test derives it instead: it walks
 * {@code openmetadata-spec} for every property chain that reaches the config, maps each chain onto
 * the table that stores it, and asserts the statement for that table strips it in both dialects. A
 * connector added later that nests a database connection under a new property name fails here,
 * rather than shipping a row that stops deserializing on upgrade.
 */
class SampleDataStorageMigrationPathsTest {

  private static final String HOLDER = "sampleDataStorageConfig";
  private static final String PROPERTIES = "properties";
  private static final String REF = "$ref";
  private static final List<String> BRANCH_KEYWORDS = List.of("oneOf", "anyOf", "allOf", "items");

  private static final String SPEC_MODULE = "openmetadata-spec";
  private static final String SCHEMA_ROOT = "src/main/resources/json/schema";
  private static final String CONNECTIONS = "entity/services/connections";
  private static final String MIGRATION_DIR = "bootstrap/sql/migrations/native/2.1.0";
  private static final String MIGRATION_FILE = "postDataMigrationSQLScript.sql";

  /** Where a service connection sits inside the entity that stores it. */
  private static final String SERVICE_CONNECTION_ROOT = "connection.config";

  /** Test Connection persists the submitted form as an automations workflow request. */
  private static final String WORKFLOW_REQUEST_ROOT = "request.connection.config";

  private static final String AUTOMATIONS_WORKFLOW = "automations_workflow";
  private static final String ENTITY_EXTENSION = "entity_extension";

  /** Connection sub-directory of {@code openmetadata-spec} to the table that stores it. */
  private static final Map<String, String> SERVICE_TABLES =
      Map.of(
          "database", "dbservice_entity",
          "dashboard", "dashboard_service_entity",
          "pipeline", "pipeline_service_entity",
          "metadata", "metadata_service_entity");

  /** Entity schema to the table that stores it; both hold the config in a profiler config. */
  private static final Map<String, String> PROFILER_ENTITIES =
      Map.of(
          "entity/data/database.json", "database_entity",
          "entity/data/databaseSchema.json", "database_schema_entity");

  private static final Path REPO_ROOT = repoRoot();
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final Map<Path, JsonNode> schemaCache = new HashMap<>();
  private final Map<Path, Set<String>> chainCache = new HashMap<>();

  @Test
  void bothDialectsStripEveryPathTheSchemaGraphCanReach() {
    Map<String, Set<String>> expected = expectedPathsByTable();
    String mysql = readMigration("mysql");
    String postgres = readMigration("postgres");

    assertFalse(
        expected.get(ENTITY_EXTENSION).isEmpty(),
        "derived nothing from openmetadata-spec — the walk is broken, not the migration");
    expected.forEach((table, paths) -> assertTableStrips(table, paths, mysql, postgres));
  }

  private void assertTableStrips(String table, Set<String> paths, String mysql, String postgres) {
    String mysqlStatement = statementFor(mysql, table);
    String postgresStatement = statementFor(postgres, table);
    assertFalse(mysqlStatement.isEmpty(), "MySQL migration has no statement for " + table);
    assertFalse(postgresStatement.isEmpty(), "Postgres migration has no statement for " + table);
    paths.forEach(
        path -> {
          assertTrue(
              mysqlStatement.contains(mysqlPath(path)),
              table + " is not stripped at " + path + " by the MySQL migration");
          assertTrue(
              postgresStatement.contains(postgresPath(path)),
              table + " is not stripped at " + path + " by the Postgres migration");
        });
  }

  /**
   * Version history keeps a second copy of every entity, so {@code entity_extension} has to strip
   * the union of everything the live tables strip.
   */
  private Map<String, Set<String>> expectedPathsByTable() {
    Map<String, Set<String>> byTable = new LinkedHashMap<>();
    Set<String> serviceChains = new LinkedHashSet<>();
    SERVICE_TABLES.forEach(
        (kind, table) -> {
          Set<String> kindChains = serviceKindChains(kind);
          serviceChains.addAll(kindChains);
          byTable.put(table, qualify(SERVICE_CONNECTION_ROOT, kindChains));
        });
    PROFILER_ENTITIES.forEach(
        (schema, table) -> byTable.put(table, qualify("", entityChains(schema))));
    byTable.put(AUTOMATIONS_WORKFLOW, qualify(WORKFLOW_REQUEST_ROOT, serviceChains));

    Set<String> snapshots = new LinkedHashSet<>();
    byTable.values().forEach(snapshots::addAll);
    byTable.put(ENTITY_EXTENSION, snapshots);
    return byTable;
  }

  private Set<String> serviceKindChains(String kind) {
    Path directory = schemaPath(CONNECTIONS).resolve(kind);
    Set<String> chains = new LinkedHashSet<>();
    try (Stream<Path> files = Files.list(directory)) {
      files
          .filter(SampleDataStorageMigrationPathsTest::isSchemaFile)
          .forEach(file -> chains.addAll(chainsToHolder(file)));
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot list connection schemas in " + directory, e);
    }
    return chains;
  }

  private Set<String> entityChains(String relativeSchema) {
    return chainsToHolder(schemaPath(relativeSchema));
  }

  /** Every dot-separated property chain from this schema's root down to the config holder. */
  private Set<String> chainsToHolder(Path schema) {
    Path key = schema.normalize();
    Set<String> cached = chainCache.get(key);
    if (cached != null) {
      return cached;
    }
    chainCache.put(key, Set.of()); // breaks $ref cycles while this file is being walked
    ChainWalk walk = new ChainWalk();
    walk.descend(schema(key), key, "");
    chainCache.put(key, walk.found);
    return walk.found;
  }

  /** Collects holder chains across schema files, guarding against cyclic {@code $ref}s. */
  private final class ChainWalk {
    private final Set<String> found = new LinkedHashSet<>();
    private final Set<String> followed = new HashSet<>();

    private void descend(JsonNode node, Path schema, String chain) {
      if (node == null || !node.isObject()) {
        return;
      }
      descendProperties(node.get(PROPERTIES), schema, chain);
      BRANCH_KEYWORDS.forEach(keyword -> descendBranch(node.get(keyword), schema, chain));
      JsonNode ref = node.get(REF);
      if (ref != null && ref.isTextual()) {
        followRef(ref.asText(), schema, chain);
      }
    }

    private void descendProperties(JsonNode properties, Path schema, String chain) {
      if (properties == null || !properties.isObject()) {
        return;
      }
      properties
          .properties()
          .forEach(
              property -> descendProperty(property.getKey(), property.getValue(), schema, chain));
    }

    private void descendProperty(String name, JsonNode value, Path schema, String chain) {
      if (HOLDER.equals(name)) {
        found.add(chain);
        return;
      }
      descend(value, schema, append(chain, name));
    }

    private void descendBranch(JsonNode branch, Path schema, String chain) {
      if (branch == null) {
        return;
      }
      if (branch.isArray()) {
        branch.forEach(element -> descend(element, schema, chain));
        return;
      }
      descend(branch, schema, chain);
    }

    private void followRef(String ref, Path schema, String chain) {
      String[] parts = ref.split("#", 2);
      Path target = parts[0].isEmpty() ? schema : schema.getParent().resolve(parts[0]).normalize();
      if (parts.length == 1) {
        chainsToHolder(target).forEach(reached -> found.add(append(chain, reached)));
        return;
      }
      if (followed.add(target + "#" + parts[1] + "@" + chain)) {
        descend(schema(target).at(parts[1]), target, chain);
      }
    }
  }

  private JsonNode schema(Path file) {
    return schemaCache.computeIfAbsent(
        file.normalize(), SampleDataStorageMigrationPathsTest::parse);
  }

  private static JsonNode parse(Path file) {
    try {
      return MAPPER.readTree(readFile(file));
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot parse " + file, e);
    }
  }

  private static Set<String> qualify(String root, Set<String> chains) {
    Set<String> paths = new LinkedHashSet<>();
    chains.forEach(chain -> paths.add(append(append(root, chain), HOLDER)));
    return paths;
  }

  private static String append(String prefix, String segment) {
    if (prefix == null || prefix.isEmpty()) {
      return segment;
    }
    return segment.isEmpty() ? prefix : prefix + "." + segment;
  }

  /** The statements of one migration that touch {@code table} and mention the config. */
  private static String statementFor(String sql, String table) {
    List<String> matches = new ArrayList<>();
    for (String statement : sql.split(";")) {
      if (statement.contains("UPDATE " + table) && statement.contains(HOLDER)) {
        matches.add(statement);
      }
    }
    return String.join("\n", matches);
  }

  private static String mysqlPath(String path) {
    return "'$." + path + "'";
  }

  private static String postgresPath(String path) {
    return "'{" + path.replace('.', ',') + "}'";
  }

  private static boolean isSchemaFile(Path file) {
    return Files.isRegularFile(file) && file.getFileName().toString().endsWith(".json");
  }

  private static Path schemaPath(String relative) {
    return REPO_ROOT.resolve(SPEC_MODULE).resolve(SCHEMA_ROOT).resolve(relative);
  }

  private static String readMigration(String dialect) {
    return readFile(REPO_ROOT.resolve(MIGRATION_DIR).resolve(dialect).resolve(MIGRATION_FILE));
  }

  private static String readFile(Path file) {
    try {
      return Files.readString(file);
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read " + file, e);
    }
  }

  private static Path repoRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve(SPEC_MODULE))) {
      current = current.getParent();
    }
    return requireNonNull(
        current, "Cannot locate the repository root from " + Path.of("").toAbsolutePath());
  }
}
