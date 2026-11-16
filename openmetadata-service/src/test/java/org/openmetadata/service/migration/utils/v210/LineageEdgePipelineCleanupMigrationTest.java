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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 lineage edge clean-up against real MySQL and PostgreSQL, on the relationship table
 * and indexes those engines carry when the step runs: those of 2.0.7 plus the 2.1.0 schema changes.
 * The MySQL table leaves out the generated metric group column and its unique index. The walk must reach every row across batches and clear
 * only non-pipeline references of lineage edges, and each page must be a range read of the primary
 * key, or the scan grows with the square of the table.
 */
@Testcontainers(disabledWithoutDocker = true)
class LineageEdgePipelineCleanupMigrationTest {
  private static final String PASSWORD = "lineage-cleanup-test";
  private static final String DATABASE = "lineage_cleanup_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();
  private static final int CONTAINS = Relationship.CONTAINS.ordinal();
  private static final int SEEDED_UPSTREAM = 1200;
  private static final int PLAN_ROWS = 20000;
  private static final int PAGE_SIZE = 500;

  /** Columns and indexes of a 2.0.7 table plus those the 2.1.0 schema changes add before this step. */
  private static final List<String> MYSQL_DDL =
      List.of(
          "DROP TABLE IF EXISTS entity_relationship",
          "CREATE TABLE entity_relationship ("
              + " fromId VARCHAR(36) NOT NULL, toId VARCHAR(36) NOT NULL,"
              + " fromEntity VARCHAR(256) NOT NULL, toEntity VARCHAR(256) NOT NULL,"
              + " relation TINYINT NOT NULL, relationType VARCHAR(64) NOT NULL DEFAULT '',"
              + " jsonSchema VARCHAR(256), json JSON, deleted TINYINT(1) NOT NULL DEFAULT 0,"
              + " relationshipId VARCHAR(36), relationshipTypeId VARCHAR(36),"
              + " PRIMARY KEY (fromId, toId, relation, relationType),"
              + " KEY from_index (fromId, relation),"
              + " KEY to_index (toId, relation),"
              + " KEY from_entity_type_index (fromId, fromEntity),"
              + " KEY to_entity_type_index (toId, toEntity),"
              + " KEY idx_entity_relationship_fromEntity_fromId_relation (fromEntity, fromId, relation),"
              + " KEY idx_er_fromEntity_fromId_toEntity_relation (fromEntity, fromId, toEntity, relation),"
              + " KEY idx_er_toEntity_toId_relation (toEntity, toId, relation),"
              + " KEY idx_er_fromEntity_toEntity (fromEntity, toEntity),"
              + " KEY idx_er_relation_fromEntity_toId (relation, fromEntity, toId),"
              + " KEY idx_entity_rel_from_delete (fromId, fromEntity, toId, toEntity, relation),"
              + " KEY idx_entity_rel_to_delete (toId, toEntity, fromId, fromEntity, relation),"
              + " KEY idx_entity_rel_cascade (fromId, relation, toEntity, toId),"
              + " KEY idx_entity_relationship_from_relation (fromId, relation),"
              + " KEY idx_entity_relationship_to_relation (toId, relation),"
              + " KEY idx_entity_relationship_from_type_relation (fromId, fromEntity, relation),"
              + " KEY idx_entity_relationship_to_type_relation (toId, toEntity, relation),"
              + " KEY idx_entity_relationship_from_deleted (fromId, fromEntity, relation, deleted, toId, toEntity),"
              + " KEY idx_entity_relationship_to_deleted (toId, toEntity, relation, deleted, fromId, fromEntity),"
              + " KEY idx_entity_relationship_from_typed (toId, toEntity, relation, fromEntity, deleted, fromId),"
              + " KEY idx_entity_relationship_bidirectional (fromId, toId, relation, deleted),"
              + " KEY idx_er_fromentity_toentity_relation_toid (fromEntity, toEntity, relation, toId),"
              + " UNIQUE KEY relationship_id_unique (relationshipId),"
              + " KEY relationship_type_id_index (relationshipTypeId),"
              + " KEY idx_entity_relationship_pipeline_relation ((CAST(json->>'$.pipeline.id' AS CHAR(36)) COLLATE utf8mb4_bin), relation))"
              + " DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

  /** Columns and indexes of a 2.0.7 table plus those the 2.1.0 schema changes add before this step. */
  private static final List<String> POSTGRES_DDL =
      List.of(
          "DROP TABLE IF EXISTS entity_relationship",
          "CREATE TABLE entity_relationship ("
              + " fromId VARCHAR(36) NOT NULL, toId VARCHAR(36) NOT NULL,"
              + " fromEntity VARCHAR(256) NOT NULL, toEntity VARCHAR(256) NOT NULL,"
              + " relation SMALLINT NOT NULL, jsonSchema VARCHAR(256), json JSONB,"
              + " deleted BOOLEAN NOT NULL DEFAULT FALSE,"
              + " relationType VARCHAR(64) NOT NULL DEFAULT '',"
              + " relationshipId VARCHAR(36), relationshipTypeId VARCHAR(36),"
              + " CONSTRAINT entity_relationship_pkey"
              + " PRIMARY KEY (fromId, toId, relation, relationType))",
          "CREATE INDEX entity_relationship_from_index ON entity_relationship (fromId, relation)",
          "CREATE INDEX entity_relationship_to_index ON entity_relationship (toId, relation)",
          "CREATE INDEX from_entity_type_index ON entity_relationship (fromId, fromEntity)",
          "CREATE INDEX to_entity_type_index ON entity_relationship (toId, toEntity)",
          "CREATE INDEX idx_entity_rel_cascade ON entity_relationship (fromId, relation, toEntity, toId) WHERE relation IN (0, 8)",
          "CREATE INDEX idx_entity_rel_from_delete ON entity_relationship (fromId, fromEntity, toId, toEntity, relation)",
          "CREATE INDEX idx_entity_rel_to_delete ON entity_relationship (toId, toEntity, fromId, fromEntity, relation)",
          "CREATE INDEX idx_entity_relationship_bidirectional ON entity_relationship (fromId, toId, relation) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_from_deleted ON entity_relationship (fromId, fromEntity, relation) INCLUDE (toId, toEntity) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_from_relation ON entity_relationship (fromId, relation)",
          "CREATE INDEX idx_entity_relationship_from_type_relation ON entity_relationship (fromId, fromEntity, relation)",
          "CREATE INDEX idx_entity_relationship_from_typed ON entity_relationship (toId, toEntity, relation, fromEntity) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_fromentity_fromid_relation ON entity_relationship (fromEntity, fromId, relation)",
          "CREATE INDEX idx_entity_relationship_to_deleted ON entity_relationship (toId, toEntity, relation) INCLUDE (fromId, fromEntity) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_to_relation ON entity_relationship (toId, relation)",
          "CREATE INDEX idx_entity_relationship_to_type_relation ON entity_relationship (toId, toEntity, relation)",
          "CREATE INDEX idx_er_fromentity_fromid_toentity_relation ON entity_relationship (fromEntity, fromId, toEntity, relation)",
          "CREATE INDEX idx_er_fromentity_toentity ON entity_relationship (fromEntity, toEntity)",
          "CREATE INDEX idx_er_fromentity_toentity_relation_toid ON entity_relationship (fromEntity, toEntity, relation, toId)",
          "CREATE INDEX idx_er_relation_fromentity_toid ON entity_relationship (relation, fromEntity, toId)",
          "CREATE INDEX idx_er_toentity_toid_relation ON entity_relationship (toEntity, toId, relation)",
          "CREATE UNIQUE INDEX relationship_id_unique ON entity_relationship (relationshipId)",
          "CREATE INDEX entity_relationship_type_id_index ON entity_relationship (relationshipTypeId)",
          "CREATE INDEX idx_entity_relationship_pipeline_relation ON entity_relationship ((json->'pipeline'->>'id'), relation) WHERE (json->'pipeline'->>'id') IS NOT NULL",
          "CREATE UNIQUE INDEX uq_metric_group_single_membership ON entity_relationship (toId)"
              + " WHERE fromEntity = 'metricGroup' AND toEntity = 'metric' AND relation = 10"
              + " AND deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_memory_anchor ON entity_relationship (fromId, relation) WHERE toEntity = 'contextMemory'");

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.3.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withEnv("MYSQL_ROOT_HOST", "%")
          .withExposedPorts(3306)
          .waitingFor(
              Wait.forSuccessfulCommand(
                  "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                      + PASSWORD
                      + " --execute='SELECT 1'"));

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>(DockerImageName.parse("postgres:15"))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432)
          .waitingFor(
              Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2));

  /** A seeded edge and whether the step must clear its pipeline reference. */
  private record Seeded(Key key, LineageDetails details, boolean cleared) {}

  private record Key(String fromId, String toId, int relation, String relationType) {}

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void clearsOnlyNonPipelineLineageReferencesInEveryBatchAndIsIdempotent(String dialect) {
    try (Handle handle = open(dialect)) {
      createTable(handle, dialect);
      List<Seeded> seeded = seed(handle, dialect);

      LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines(
          handle, connectionType(dialect));

      Map<Key, String> afterFirstRun = rows(handle, dialect);
      assertEquals(seeded.size(), afterFirstRun.size(), "the step rewrites rows, never adds them");
      for (Seeded s : seeded) {
        LineageDetails details =
            JsonUtils.readValue(afterFirstRun.get(s.key()), LineageDetails.class);
        assertEquals(s.details().getSqlQuery(), details.getSqlQuery(), "other details survive");
        assertPipeline(s, details);
      }

      LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines(
          handle, connectionType(dialect));

      assertEquals(afterFirstRun, rows(handle, dialect), "a second run changes nothing");
    }
  }

  /**
   * The expanded {@code OR} cursor fails this on Postgres: the planner cannot make an index range
   * from it, so it filters every row before the cursor out of an index read from the start.
   */
  @Test
  void postgresReadsEachPageAsARangeOfThePrimaryKey() {
    try (Handle handle = open(POSTGRES_DIALECT)) {
      createTable(handle, POSTGRES_DIALECT);
      handle.execute(
          "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)"
              + " SELECT md5((g / 20)::text), md5(g::text), 'table', 'table', g % 20"
              + " FROM generate_series(1, "
              + PLAN_ROWS
              + ") AS g");
      handle.execute("ANALYZE entity_relationship");
      Key cursor = cursorInTheMiddle(handle);

      JsonNode plan =
          JsonUtils.readTree(
                  explain(handle, "EXPLAIN (FORMAT JSON) ", ConnectionType.POSTGRES, cursor))
              .get(0)
              .get("Plan");

      JsonNode scan = findNode(plan, "Index Name");
      assertNotNull(scan, "the page is an index scan: " + plan);
      assertEquals("entity_relationship_pkey", scan.get("Index Name").asText(), plan.toString());
      assertTrue(
          scan.path("Index Cond").asText().contains(cursor.fromId()),
          "the cursor bounds the index scan: " + plan);
      assertFalse(plan.toString().contains("Sort"), "the page needs no sort: " + plan);
    }
  }

  /** MySQL keeps the expanded {@code OR} cursor, which it reads as a primary key range. */
  @Test
  void mysqlReadsEachPageAsARangeOfThePrimaryKey() {
    try (Handle handle = open(MYSQL_DIALECT)) {
      createTable(handle, MYSQL_DIALECT);
      handle.execute("SET SESSION cte_max_recursion_depth = " + PLAN_ROWS);
      handle.execute(
          "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)"
              + " WITH RECURSIVE g (n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM g WHERE n < "
              + PLAN_ROWS
              + ") SELECT md5(n DIV 20), md5(n), 'table', 'table', n % 20 FROM g");
      handle.execute("ANALYZE TABLE entity_relationship");
      Key cursor = cursorInTheMiddle(handle);

      JsonNode plan =
          JsonUtils.readTree(explain(handle, "EXPLAIN FORMAT=JSON ", ConnectionType.MYSQL, cursor));

      JsonNode table = findNode(plan, "access_type");
      assertNotNull(table, plan.toString());
      assertEquals("PRIMARY", table.path("key").asText(), plan.toString());
      assertEquals("range", table.path("access_type").asText(), plan.toString());
      assertFalse(plan.toString().contains("\"using_filesort\":true"), plan.toString());
    }
  }

  private static void assertPipeline(Seeded s, LineageDetails details) {
    if (s.cleared()) {
      assertNull(details.getPipeline(), "non-pipeline reference cleared: " + s.key());
    } else {
      assertEquals(s.details().getPipeline(), details.getPipeline(), "kept: " + s.key());
    }
  }

  /**
   * Lineage edges of every kind, three {@code fromId}s holding hundreds of rows each so batch
   * boundaries fall inside one {@code fromId}, rows of one pair that differ only in relation or
   * relation type, and non-lineage rows that name a service and must be left alone.
   */
  private static List<Seeded> seed(Handle handle, String dialect) {
    List<Seeded> seeded = new ArrayList<>();
    for (int i = 0; i < SEEDED_UPSTREAM; i++) {
      String fromId = uuid(i % 3);
      String toId = uuid(1_000 + i);
      seeded.add(lineage(fromId, toId, "", i));
      if (i % 7 == 0) {
        seeded.add(lineage(fromId, toId, "alt", i + 1));
      }
      if (i % 11 == 0) {
        LineageDetails details = withPipeline(Entity.DATABASE_SERVICE, i);
        seeded.add(new Seeded(new Key(fromId, toId, CONTAINS, ""), details, false));
      }
    }
    seeded.forEach(s -> insert(handle, dialect, s));
    return seeded;
  }

  private static Seeded lineage(String fromId, String toId, String relationType, int i) {
    Key key = new Key(fromId, toId, UPSTREAM, relationType);
    return switch (i % 5) {
      case 0 -> new Seeded(key, withPipeline(Entity.DATABASE_SERVICE, i), true);
      case 1 -> new Seeded(key, withPipeline(Entity.PIPELINE, i), false);
      case 2 -> new Seeded(key, withPipeline(Entity.STORED_PROCEDURE, i), false);
      case 3 -> new Seeded(key, withPipeline(Entity.DASHBOARD_SERVICE, i), true);
      default -> new Seeded(key, new LineageDetails().withSqlQuery("q" + i), false);
    };
  }

  private static LineageDetails withPipeline(String type, int i) {
    return new LineageDetails()
        .withSqlQuery("q" + i)
        .withPipeline(
            new EntityReference().withId(UUID.randomUUID()).withType(type).withName("n" + i));
  }

  private static void insert(Handle handle, String dialect, Seeded s) {
    String json = POSTGRES_DIALECT.equals(dialect) ? "CAST(:json AS JSONB)" : ":json";
    handle
        .createUpdate(
            "INSERT INTO entity_relationship"
                + " (fromId, toId, fromEntity, toEntity, relation, relationType, json)"
                + " VALUES (:fromId, :toId, 'table', 'table', :relation, :relationType, "
                + json
                + ")")
        .bind("fromId", s.key().fromId())
        .bind("toId", s.key().toId())
        .bind("relation", s.key().relation())
        .bind("relationType", s.key().relationType())
        .bind("json", JsonUtils.pojoToJson(s.details()))
        .execute();
  }

  private static Map<Key, String> rows(Handle handle, String dialect) {
    String jsonText = POSTGRES_DIALECT.equals(dialect) ? "json::text" : "CAST(json AS CHAR)";
    Map<Key, String> rows = new TreeMap<>(Comparator.comparing(Key::toString));
    handle
        .createQuery(
            "SELECT fromId, toId, relation, relationType, "
                + jsonText
                + " AS body FROM entity_relationship")
        .map((rs, ctx) -> Map.entry(key(rs), rs.getString("body")))
        .forEach(entry -> rows.put(entry.getKey(), entry.getValue()));
    return rows;
  }

  private static Key cursorInTheMiddle(Handle handle) {
    return handle
        .createQuery(
            "SELECT fromId, toId, relation, relationType FROM entity_relationship"
                + " ORDER BY fromId, toId, relation, relationType LIMIT 1 OFFSET "
                + PLAN_ROWS / 2)
        .map((rs, ctx) -> key(rs))
        .one();
  }

  private static Key key(ResultSet rs) throws SQLException {
    return new Key(
        rs.getString("fromId"),
        rs.getString("toId"),
        rs.getInt("relation"),
        rs.getString("relationType"));
  }

  private static String explain(
      Handle handle, String explainPrefix, ConnectionType connectionType, Key cursor) {
    return handle
        .createQuery(explainPrefix + LineageEdgePipelineCleanupMigration.pageSql(connectionType))
        .bind("fromId", cursor.fromId())
        .bind("toId", cursor.toId())
        .bind("relation", cursor.relation())
        .bind("relationType", cursor.relationType())
        .bind("limit", PAGE_SIZE)
        .mapTo(String.class)
        .one();
  }

  /** The first node, depth first, that carries {@code field}. */
  private static JsonNode findNode(JsonNode node, String field) {
    if (node.has(field)) {
      return node;
    }
    for (JsonNode child : node) {
      JsonNode found = findNode(child, field);
      if (found != null) {
        return found;
      }
    }
    return null;
  }

  private static void createTable(Handle handle, String dialect) {
    (POSTGRES_DIALECT.equals(dialect) ? POSTGRES_DDL : MYSQL_DDL).forEach(handle::execute);
  }

  private static ConnectionType connectionType(String dialect) {
    return POSTGRES_DIALECT.equals(dialect) ? ConnectionType.POSTGRES : ConnectionType.MYSQL;
  }

  private static String uuid(int n) {
    return new UUID(0L, n).toString();
  }

  private static Handle open(String dialect) {
    return MYSQL_DIALECT.equals(dialect)
        ? Jdbi.create(
                "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                    .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE),
                "root",
                PASSWORD)
            .open()
        : Jdbi.create(
                "jdbc:postgresql://%s:%d/%s"
                    .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), DATABASE),
                "postgres",
                PASSWORD)
            .open();
  }
}
