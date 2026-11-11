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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the relationship keyset page ({@code getAllRelationshipsAfter}) against real MySQL and
 * PostgreSQL, on the relationship table with the indexes a 2.1.0 database carries. The Data
 * Retention cleanup walks the whole table through it, so each page must be a range read of the
 * primary key, or every page re-reads the table up to the cursor and the walk grows with the square
 * of the table.
 */
@Testcontainers(disabledWithoutDocker = true)
class RelationshipKeysetPageSqlTest {
  private static final String PASSWORD = "relationship-keyset-test";
  private static final String DATABASE = "relationship_keyset_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final int PAGE_SIZE = 7;
  private static final int PLAN_ROWS = 20000;
  private static final int PLAN_PAGE_SIZE = 500;

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
              + " KEY from_index (fromId, relation), KEY to_index (toId, relation),"
              + " KEY from_entity_type_index (fromId, fromEntity),"
              + " KEY to_entity_type_index (toId, toEntity),"
              + " KEY idx_entity_relationship_fromEntity_fromId_relation"
              + " (fromEntity, fromId, relation),"
              + " KEY idx_er_fromEntity_fromId_toEntity_relation"
              + " (fromEntity, fromId, toEntity, relation),"
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
              + " KEY idx_entity_relationship_from_deleted"
              + " (fromId, fromEntity, relation, deleted, toId, toEntity),"
              + " KEY idx_entity_relationship_to_deleted"
              + " (toId, toEntity, relation, deleted, fromId, fromEntity),"
              + " KEY idx_entity_relationship_from_typed"
              + " (toId, toEntity, relation, fromEntity, deleted, fromId),"
              + " KEY idx_entity_relationship_bidirectional (fromId, toId, relation, deleted),"
              + " KEY idx_er_fromentity_toentity_relation_toid"
              + " (fromEntity, toEntity, relation, toId),"
              + " UNIQUE KEY relationship_id_unique (relationshipId),"
              + " KEY relationship_type_id_index (relationshipTypeId),"
              + " KEY idx_entity_relationship_pipeline_relation"
              + " ((CAST(json->>'$.pipeline.id' AS CHAR(36)) COLLATE utf8mb4_bin), relation))"
              + " DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

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
          "CREATE INDEX idx_entity_rel_cascade ON entity_relationship"
              + " (fromId, relation, toEntity, toId) WHERE relation IN (0, 8)",
          "CREATE INDEX idx_entity_rel_from_delete ON entity_relationship"
              + " (fromId, fromEntity, toId, toEntity, relation)",
          "CREATE INDEX idx_entity_rel_to_delete ON entity_relationship"
              + " (toId, toEntity, fromId, fromEntity, relation)",
          "CREATE INDEX idx_entity_relationship_bidirectional ON entity_relationship"
              + " (fromId, toId, relation) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_from_deleted ON entity_relationship"
              + " (fromId, fromEntity, relation) INCLUDE (toId, toEntity) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_from_relation ON entity_relationship"
              + " (fromId, relation)",
          "CREATE INDEX idx_entity_relationship_from_type_relation ON entity_relationship"
              + " (fromId, fromEntity, relation)",
          "CREATE INDEX idx_entity_relationship_from_typed ON entity_relationship"
              + " (toId, toEntity, relation, fromEntity) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_fromentity_fromid_relation ON entity_relationship"
              + " (fromEntity, fromId, relation)",
          "CREATE INDEX idx_entity_relationship_to_deleted ON entity_relationship"
              + " (toId, toEntity, relation) INCLUDE (fromId, fromEntity) WHERE deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_to_relation ON entity_relationship"
              + " (toId, relation)",
          "CREATE INDEX idx_entity_relationship_to_type_relation ON entity_relationship"
              + " (toId, toEntity, relation)",
          "CREATE INDEX idx_er_fromentity_fromid_toentity_relation ON entity_relationship"
              + " (fromEntity, fromId, toEntity, relation)",
          "CREATE INDEX idx_er_fromentity_toentity ON entity_relationship (fromEntity, toEntity)",
          "CREATE INDEX idx_er_fromentity_toentity_relation_toid ON entity_relationship"
              + " (fromEntity, toEntity, relation, toId)",
          "CREATE INDEX idx_er_relation_fromentity_toid ON entity_relationship"
              + " (relation, fromEntity, toId)",
          "CREATE INDEX idx_er_toentity_toid_relation ON entity_relationship"
              + " (toEntity, toId, relation)",
          "CREATE UNIQUE INDEX relationship_id_unique ON entity_relationship (relationshipId)",
          "CREATE INDEX entity_relationship_type_id_index ON entity_relationship"
              + " (relationshipTypeId)",
          "CREATE INDEX idx_entity_relationship_pipeline_relation ON entity_relationship"
              + " ((json->'pipeline'->>'id'), relation) WHERE (json->'pipeline'->>'id') IS NOT NULL",
          "CREATE UNIQUE INDEX uq_metric_group_single_membership ON entity_relationship (toId)"
              + " WHERE fromEntity = 'metricGroup' AND toEntity = 'metric' AND relation = 10"
              + " AND deleted = FALSE",
          "CREATE INDEX idx_entity_relationship_memory_anchor ON entity_relationship"
              + " (fromId, relation) WHERE toEntity = 'contextMemory'");

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

  private record Key(String fromId, String toId, int relation, String relationType) {
    static Key of(CollectionDAO.EntityRelationshipObject row) {
      return new Key(row.getFromId(), row.getToId(), row.getRelation(), row.getRelationType());
    }
  }

  /**
   * Pages of seven over rows that share a {@code fromId}, or a {@code (fromId, toId)} pair that
   * differs only in relation or relation type, so page boundaries fall inside those groups. The walk
   * must return every row exactly once, in key order.
   */
  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void walkReturnsEveryRowOnceInKeyOrder(String dialect) {
    try (Handle handle = open(dialect)) {
      createTable(handle, dialect);
      List<Key> seeded = seed(handle);
      CollectionDAO.EntityRelationshipDAO dao =
          handle.attach(CollectionDAO.EntityRelationshipDAO.class);

      List<Key> walked = new ArrayList<>();
      Key cursor = new Key("", "", -1, "");
      List<CollectionDAO.EntityRelationshipObject> page = next(dao, cursor);
      while (!page.isEmpty()) {
        page.forEach(row -> walked.add(Key.of(row)));
        cursor = Key.of(page.getLast());
        page = next(dao, cursor);
      }

      assertEquals(keysInOrder(handle), walked, "every row once, in key order");
      assertEquals(seeded.size(), walked.size());
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

  private static List<CollectionDAO.EntityRelationshipObject> next(
      CollectionDAO.EntityRelationshipDAO dao, Key cursor) {
    return dao.getAllRelationshipsAfter(
        cursor.fromId(), cursor.toId(), cursor.relation(), cursor.relationType(), PAGE_SIZE);
  }

  private static List<Key> seed(Handle handle) {
    List<Key> keys = new ArrayList<>();
    for (int i = 0; i < 60; i++) {
      String fromId = uuid(i % 3);
      String toId = uuid(1_000 + i / 2);
      keys.add(new Key(fromId, toId, i % 4, ""));
      if (i % 5 == 0) {
        keys.add(new Key(fromId, toId, i % 4, "seeAlso"));
        keys.add(new Key(fromId, toId, i % 4, "synonym"));
      }
    }
    List<Key> unique = keys.stream().distinct().toList();
    unique.forEach(
        key ->
            handle
                .createUpdate(
                    "INSERT INTO entity_relationship"
                        + " (fromId, toId, fromEntity, toEntity, relation, relationType)"
                        + " VALUES (:fromId, :toId, 'glossaryTerm', 'glossaryTerm', :relation,"
                        + " :relationType)")
                .bind("fromId", key.fromId())
                .bind("toId", key.toId())
                .bind("relation", key.relation())
                .bind("relationType", key.relationType())
                .execute());
    return unique;
  }

  private static List<Key> keysInOrder(Handle handle) {
    return handle
        .createQuery(
            "SELECT fromId, toId, relation, relationType FROM entity_relationship"
                + " ORDER BY fromId, toId, relation, relationType")
        .map(
            (rs, ctx) ->
                new Key(
                    rs.getString("fromId"),
                    rs.getString("toId"),
                    rs.getInt("relation"),
                    rs.getString("relationType")))
        .list();
  }

  private static Key cursorInTheMiddle(Handle handle) {
    return keysInOrder(handle).get(PLAN_ROWS / 2);
  }

  private static String explain(
      Handle handle, String explainPrefix, ConnectionType connectionType, Key cursor) {
    return handle
        .createQuery(explainPrefix + pageSql(connectionType))
        .bind("fromId", cursor.fromId())
        .bind("toId", cursor.toId())
        .bind("relation", cursor.relation())
        .bind("relationType", cursor.relationType())
        .bind("limit", PLAN_PAGE_SIZE)
        .mapTo(String.class)
        .one();
  }

  /** The SQL the server runs for {@code getAllRelationshipsAfter} on the given engine. */
  private static String pageSql(ConnectionType connectionType) {
    try {
      ConnectionAwareSqlQuery[] queries =
          CollectionDAO.EntityRelationshipDAO.class
              .getMethod(
                  "getAllRelationshipsAfter",
                  String.class,
                  String.class,
                  int.class,
                  String.class,
                  int.class)
              .getAnnotationsByType(ConnectionAwareSqlQuery.class);
      return Arrays.stream(queries)
          .filter(query -> query.connectionType() == connectionType)
          .findFirst()
          .orElseThrow()
          .value();
    } catch (NoSuchMethodException e) {
      throw new IllegalStateException(e);
    }
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

  private static String uuid(int n) {
    return new UUID(0L, n).toString();
  }

  private static Handle open(String dialect) {
    boolean mysql = MYSQL_DIALECT.equals(dialect);
    String url =
        mysql
            ? "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE)
            : "jdbc:postgresql://%s:%d/%s"
                .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), DATABASE);
    Jdbi jdbi =
        Jdbi.create(url, mysql ? "root" : "postgres", PASSWORD)
            .installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                mysql ? "com.mysql.cj.jdbc.Driver" : "org.postgresql.Driver"));
    return jdbi.open();
  }
}
