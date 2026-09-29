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
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statement that gives an existing {@code DataConsumerPolicy} the agent SPARQL grant
 * (#34231) against real MySQL and PostgreSQL. The statement is read from the shipped {@code
 * schemaChanges.sql}, so the test fails if either dialect drifts from what upgrades really run.
 *
 * <p>That the statement runs only once per installation is the migration framework's guarantee for
 * schema-changes statements, not something SQL can show, so it is not asserted here.
 */
@Testcontainers(disabledWithoutDocker = true)
class DataConsumerSparqlGrantSqlMigrationTest {
  private static final String PASSWORD = "sparql-grant-test";
  private static final String DATABASE = "grant_test";
  private static final String GRANT_RULE = "DataConsumerPolicy-ExecuteSparqlQuery-Rule";
  private static final String EDIT_RULE = "DataConsumerPolicy-EditRule";
  private static final String STATEMENT_MARKER = "UPDATE policy_entity";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>(DockerImageName.parse("postgres:15"))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432);

  @Test
  void mysqlAddsTheRuleOnceToTheDataConsumerPolicyOnly() throws IOException {
    String jdbcUrl =
        "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
            .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE);
    try (Handle handle = Jdbi.create(jdbcUrl, "root", PASSWORD).open()) {
      handle.execute(
          """
          CREATE TABLE policy_entity (
            id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
            json JSON NOT NULL,
            fqnHash VARCHAR(768) NOT NULL,
            name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name'),
            PRIMARY KEY (id),
            UNIQUE (fqnHash))
          """);

      assertMigrationAddsTheRuleOnce(new Database(handle, MYSQL_DIALECT));
    }
  }

  @Test
  void postgresAddsTheRuleOnceToTheDataConsumerPolicyOnly() throws IOException {
    String jdbcUrl =
        "jdbc:postgresql://%s:%d/%s"
            .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), DATABASE);
    try (Handle handle = Jdbi.create(jdbcUrl, "postgres", PASSWORD).open()) {
      handle.execute(
          """
          CREATE TABLE policy_entity (
            id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
            json JSONB NOT NULL,
            fqnHash VARCHAR(768) NOT NULL,
            name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED,
            PRIMARY KEY (id),
            UNIQUE (fqnHash))
          """);

      assertMigrationAddsTheRuleOnce(new Database(handle, POSTGRES_DIALECT));
    }
  }

  private record Database(Handle handle, String dialect) {
    boolean isPostgres() {
      return POSTGRES_DIALECT.equals(dialect);
    }
  }

  private static void assertMigrationAddsTheRuleOnce(Database db) throws IOException {
    insertPolicy(db, "DataConsumerPolicy", EDIT_RULE);
    insertPolicy(db, "OtherPolicy", "OtherPolicy-Rule");
    String statement = grantStatement(db.dialect());

    db.handle().execute(statement);
    assertEquals(List.of(EDIT_RULE, GRANT_RULE), ruleNames(db, "DataConsumerPolicy"));
    assertEquals(List.of("OtherPolicy-Rule"), ruleNames(db, "OtherPolicy"));
    assertGrantsOnlyTheNamedOperation(db);

    db.handle().execute(statement);
    assertEquals(List.of(EDIT_RULE, GRANT_RULE), ruleNames(db, "DataConsumerPolicy"));
  }

  private static void assertGrantsOnlyTheNamedOperation(Database db) {
    Rule grant =
        policy(db, "DataConsumerPolicy").getRules().stream()
            .filter(rule -> GRANT_RULE.equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(List.of(MetadataOperation.EXECUTE_SPARQL_QUERY), grant.getOperations());
    assertEquals(List.of("all"), grant.getResources());
    assertEquals(Rule.Effect.ALLOW, grant.getEffect());
  }

  private static void insertPolicy(Database db, String name, String ruleName) {
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withRules(
                List.of(
                    new Rule()
                        .withName(ruleName)
                        .withResources(List.of("all"))
                        .withOperations(List.of(MetadataOperation.VIEW_ALL))
                        .withEffect(Rule.Effect.ALLOW)));
    String value = db.isPostgres() ? "CAST(:json AS JSONB)" : ":json";
    db.handle()
        .createUpdate("INSERT INTO policy_entity (json, fqnHash) VALUES (" + value + ", :fqnHash)")
        .bind("json", JsonUtils.pojoToJson(policy))
        .bind("fqnHash", name)
        .execute();
  }

  private static List<String> ruleNames(Database db, String policyName) {
    return policy(db, policyName).getRules().stream().map(Rule::getName).toList();
  }

  private static Policy policy(Database db, String policyName) {
    String text = db.isPostgres() ? "CAST(json AS TEXT)" : "CAST(json AS CHAR)";
    String json =
        db.handle()
            .createQuery("SELECT " + text + " FROM policy_entity WHERE name = :n")
            .bind("n", policyName)
            .mapTo(String.class)
            .one();
    return JsonUtils.readValue(json, Policy.class);
  }

  private static String grantStatement(String dialect) throws IOException {
    String sql = Files.readString(migrationFile(dialect));
    int start = sql.indexOf(STATEMENT_MARKER, sql.indexOf("(#34231)"));
    int end = sql.indexOf(";\n", start);
    assertTrue(start >= 0 && end > start, "Grant statement not found in " + dialect);
    return sql.substring(start, end);
  }

  private static Path migrationFile(String dialect) {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    assertTrue(current != null, "Could not find the repository root");
    return current.resolve(
        "bootstrap/sql/migrations/native/2.1.0/%s/schemaChanges.sql".formatted(dialect));
  }
}
