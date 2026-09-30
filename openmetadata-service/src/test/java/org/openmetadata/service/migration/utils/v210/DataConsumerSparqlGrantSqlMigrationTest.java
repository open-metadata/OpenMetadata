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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statement that gives an existing {@code DataConsumerPolicy} the agent SPARQL grant
 * (#34231) against real MySQL and PostgreSQL. The statement is read from the shipped {@code
 * schemaChanges.sql}, so the test fails if either dialect drifts from what upgrades really run.
 *
 * <p>The grant is only added while Data Consumer still has an unconditional allow rule for {@code
 * ViewAll} (or {@code All}) on every resource, which is the premise the grant's risk acceptance
 * rests on. Deny rules in other policies are not visible to the statement and are not tested.
 *
 * <p>That the statement runs only once per installation is the migration framework's guarantee for
 * schema-changes statements, not something SQL can show, so it is not asserted here.
 */
@Testcontainers(disabledWithoutDocker = true)
class DataConsumerSparqlGrantSqlMigrationTest {
  private static final String PASSWORD = "sparql-grant-test";
  private static final String DATABASE = "grant_test";
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String OTHER_POLICY = "OtherPolicy";
  private static final String GRANT_RULE = "DataConsumerPolicy-ExecuteSparqlQuery-Rule";
  private static final String EDIT_RULE = "DataConsumerPolicy-EditRule";
  private static final String OTHER_RULE = "OtherPolicy-Rule";
  private static final String STATEMENT = "UPDATE policy_entity";
  private static final String ALL_RESOURCES = "all";
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

  private record Scenario(String description, List<Rule> rules, boolean granted) {
    @Override
    public String toString() {
      return description;
    }
  }

  private record Database(Handle handle, String dialect) {
    boolean isPostgres() {
      return POSTGRES_DIALECT.equals(dialect);
    }
  }

  static Stream<Arguments> scenarios() {
    return Stream.of(MYSQL_DIALECT, POSTGRES_DIALECT)
        .flatMap(
            dialect -> grantScenarios().stream().map(scenario -> Arguments.of(dialect, scenario)));
  }

  private static List<Scenario> grantScenarios() {
    return List.of(
        new Scenario("seeded policy", List.of(viewRule(ALL_RESOURCES, null)), true),
        new Scenario("capitalised resource", List.of(viewRule("All", null)), true),
        new Scenario("blank condition", List.of(viewRule(ALL_RESOURCES, " ")), true),
        new Scenario(
            "wildcard operation",
            List.of(rule(List.of(ALL_RESOURCES), MetadataOperation.ALL, Rule.Effect.ALLOW, null)),
            true),
        new Scenario(
            "ViewAll dropped",
            List.of(
                rule(List.of(ALL_RESOURCES), MetadataOperation.EDIT_TAGS, Rule.Effect.ALLOW, null)),
            false),
        new Scenario("conditional ViewAll", List.of(viewRule(ALL_RESOURCES, "isOwner()")), false),
        new Scenario("ViewAll on one resource only", List.of(viewRule("table", null)), false),
        new Scenario(
            "ViewAll denied",
            List.of(
                rule(List.of(ALL_RESOURCES), MetadataOperation.VIEW_ALL, Rule.Effect.DENY, null)),
            false),
        new Scenario(
            "conditions met by different rules",
            List.of(
                rule(List.of(ALL_RESOURCES), MetadataOperation.EDIT_TAGS, Rule.Effect.ALLOW, null),
                viewRule("table", null)),
            false));
  }

  @ParameterizedTest(name = "{0}: {1}")
  @MethodSource("scenarios")
  void grantsOnlyWhereDataConsumerStillHasUnconditionalViewAll(String dialect, Scenario scenario) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, scenario.rules());

      handle.execute(grantStatement(dialect));

      assertEquals(scenario.granted(), hasGrantRule(db));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void addsTheRuleOnceToTheDataConsumerPolicyOnly(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, List.of(viewRule(ALL_RESOURCES, null)));
      insertPolicy(db, OTHER_POLICY, List.of(viewRule(ALL_RESOURCES, null)));
      String statement = grantStatement(dialect);

      handle.execute(statement);
      assertEquals(List.of(EDIT_RULE, GRANT_RULE), ruleNames(db, DATA_CONSUMER_POLICY));
      assertEquals(List.of(EDIT_RULE), ruleNames(db, OTHER_POLICY));
      assertGrantsOnlyTheNamedOperation(db);

      handle.execute(statement);
      assertEquals(List.of(EDIT_RULE, GRANT_RULE), ruleNames(db, DATA_CONSUMER_POLICY));
    }
  }

  static Stream<String> dialects() {
    return Stream.of(MYSQL_DIALECT, POSTGRES_DIALECT);
  }

  private static Rule viewRule(String resource, String condition) {
    return rule(List.of(resource), MetadataOperation.VIEW_ALL, Rule.Effect.ALLOW, condition)
        .withName(EDIT_RULE);
  }

  private static Rule rule(
      List<String> resources, MetadataOperation operation, Rule.Effect effect, String condition) {
    return new Rule()
        .withName(OTHER_RULE)
        .withResources(resources)
        .withOperations(List.of(operation))
        .withEffect(effect)
        .withCondition(condition);
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

  private static void createPolicyTable(Database db) {
    db.handle().execute("DROP TABLE IF EXISTS policy_entity");
    db.handle().execute(db.isPostgres() ? POSTGRES_POLICY_TABLE : MYSQL_POLICY_TABLE);
  }

  private static final String MYSQL_POLICY_TABLE =
      """
      CREATE TABLE policy_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
        json JSON NOT NULL,
        fqnHash VARCHAR(768) NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name'),
        PRIMARY KEY (id),
        UNIQUE (fqnHash))
      """;

  private static final String POSTGRES_POLICY_TABLE =
      """
      CREATE TABLE policy_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
        json JSONB NOT NULL,
        fqnHash VARCHAR(768) NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED,
        PRIMARY KEY (id),
        UNIQUE (fqnHash))
      """;

  private static void insertPolicy(Database db, String name, List<Rule> rules) {
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withRules(rules);
    String value = db.isPostgres() ? "CAST(:json AS JSONB)" : ":json";
    db.handle()
        .createUpdate("INSERT INTO policy_entity (json, fqnHash) VALUES (" + value + ", :fqnHash)")
        .bind("json", JsonUtils.pojoToJson(policy))
        .bind("fqnHash", name)
        .execute();
  }

  private static boolean hasGrantRule(Database db) {
    return ruleNames(db, DATA_CONSUMER_POLICY).contains(GRANT_RULE);
  }

  private static void assertGrantsOnlyTheNamedOperation(Database db) {
    Rule grant =
        policy(db, DATA_CONSUMER_POLICY).getRules().stream()
            .filter(rule -> GRANT_RULE.equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(List.of(MetadataOperation.EXECUTE_SPARQL_QUERY), grant.getOperations());
    assertEquals(List.of(ALL_RESOURCES), grant.getResources());
    assertEquals(Rule.Effect.ALLOW, grant.getEffect());
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

  /** Parsed with the migration framework's own splitter, so it is what an upgrade would execute. */
  private static String grantStatement(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
            .filter(sql -> sql.contains(GRANT_RULE) && sql.contains(STATEMENT))
            .toList();
    assertEquals(1, statements.size(), "Expected one grant statement in " + dialect);
    return statements.getFirst();
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
