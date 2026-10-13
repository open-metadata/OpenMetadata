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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
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
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statements that give an existing {@code DataConsumerPolicy} a default grant against
 * real MySQL and PostgreSQL: the agent SPARQL grant (#34231) and context memory creation
 * (ai-platform#1580). Each statement is read from the shipped {@code schemaChanges.sql}, so the test
 * fails if either dialect drifts from what upgrades really run.
 *
 * <p>A grant is only added while some allow rule of Data Consumer still lists the operation its risk
 * acceptance rests on: {@code ViewAll} for SPARQL, which can only expose what Data Consumers already
 * view, and {@code EditDescription} for memories, which are the same kind of contribution as a
 * description. The check is deliberately as simple as the 2.0 policy backfills: it does not look at
 * conditions or resources, and it cannot see deny rules in other policies. The "known limit"
 * scenarios pin those gaps so they stay visible.
 *
 * <p>That a statement runs only once per installation is the migration framework's guarantee for
 * schema-changes statements, not something SQL can show, so it is not asserted here.
 */
@Testcontainers(disabledWithoutDocker = true)
class DataConsumerPolicyGrantSqlMigrationTest {
  private static final String PASSWORD = "policy-grant-test";
  private static final String DATABASE = "grant_test";
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String OTHER_POLICY = "OtherPolicy";
  private static final String EDIT_RULE = "DataConsumerPolicy-EditRule";
  private static final String OTHER_RULE = "OtherPolicy-Rule";
  private static final String STATEMENT = "UPDATE policy_entity";
  private static final String ALL_RESOURCES = "all";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";

  private static final Grant SPARQL_GRANT =
      new Grant(
          "DataConsumerPolicy-ExecuteSparqlQuery-Rule",
          MetadataOperation.VIEW_ALL,
          ALL_RESOURCES,
          MetadataOperation.EXECUTE_SPARQL_QUERY);
  private static final Grant CONTEXT_MEMORY_GRANT =
      new Grant(
          "DataConsumerPolicy-CreateContextMemory-Rule",
          MetadataOperation.EDIT_DESCRIPTION,
          Entity.CONTEXT_MEMORY,
          MetadataOperation.CREATE);
  private static final List<Grant> GRANTS = List.of(SPARQL_GRANT, CONTEXT_MEMORY_GRANT);
  private static final List<String> DIALECTS = List.of(MYSQL_DIALECT, POSTGRES_DIALECT);
  private static final String SEEDED_POLICY = "/json/data/policy/DataConsumerPolicy.json";

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

  /**
   * A rule a 2.1.0 statement appends, and the operation an allow rule of Data Consumer must still
   * list for it to be appended.
   */
  private record Grant(
      String rule, MetadataOperation premise, String resource, MetadataOperation operation) {
    @Override
    public String toString() {
      return rule;
    }
  }

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
    return GRANTS.stream()
        .flatMap(
            grant ->
                DIALECTS.stream()
                    .flatMap(
                        dialect ->
                            grantScenarios(grant).stream()
                                .map(scenario -> Arguments.of(grant, dialect, scenario))));
  }

  static Stream<Arguments> grantsByDialect() {
    return GRANTS.stream()
        .flatMap(grant -> DIALECTS.stream().map(dialect -> Arguments.of(grant, dialect)));
  }

  private static List<Scenario> grantScenarios(Grant grant) {
    String premise = grant.premise().value();
    return List.of(
        new Scenario("seeded policy", seededRulesBefore(grant), true),
        new Scenario("only " + premise, List.of(premiseRule(grant, ALL_RESOURCES, null)), true),
        new Scenario("capitalised resource", List.of(premiseRule(grant, "All", null)), true),
        new Scenario(
            premise + " dropped", List.of(ruleWithout(MetadataOperation.EDIT_TAGS)), false),
        new Scenario(premise + " denied", List.of(deniedPremiseRule(grant)), false),
        new Scenario(
            "wildcard operation without " + premise,
            List.of(ruleWithout(MetadataOperation.ALL)),
            false),
        new Scenario(
            "known limit: conditional " + premise + " is not detected",
            List.of(premiseRule(grant, ALL_RESOURCES, "isOwner()")),
            true),
        new Scenario(
            "known limit: " + premise + " on one resource is not detected",
            List.of(premiseRule(grant, "table", null)),
            true));
  }

  @ParameterizedTest(name = "{0} on {1}: {2}")
  @MethodSource("scenarios")
  void grantsOnlyWhereDataConsumerStillHasItsPremise(
      Grant grant, String dialect, Scenario scenario) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, scenario.rules());

      handle.execute(grantStatement(grant, dialect));

      assertEquals(scenario.granted(), ruleNames(db, DATA_CONSUMER_POLICY).contains(grant.rule()));
    }
  }

  @ParameterizedTest(name = "{0} on {1}")
  @MethodSource("grantsByDialect")
  void addsTheRuleOnceToTheDataConsumerPolicyOnly(Grant grant, String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, List.of(premiseRule(grant, ALL_RESOURCES, null)));
      insertPolicy(db, OTHER_POLICY, List.of(premiseRule(grant, ALL_RESOURCES, null)));
      String statement = grantStatement(grant, dialect);

      handle.execute(statement);
      assertEquals(List.of(EDIT_RULE, grant.rule()), ruleNames(db, DATA_CONSUMER_POLICY));
      assertEquals(List.of(EDIT_RULE), ruleNames(db, OTHER_POLICY));
      assertGrantsOnlyTheNamedOperation(db, grant);

      handle.execute(statement);
      assertEquals(List.of(EDIT_RULE, grant.rule()), ruleNames(db, DATA_CONSUMER_POLICY));
    }
  }

  /** The shipped seed as an install created before {@code grant} existed holds it. */
  private static List<Rule> seededRulesBefore(Grant grant) {
    try (InputStream seed =
        DataConsumerPolicyGrantSqlMigrationTest.class.getResourceAsStream(SEEDED_POLICY)) {
      assertNotNull(seed, "Missing seed " + SEEDED_POLICY);
      String json = new String(seed.readAllBytes(), StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, Policy.class).getRules().stream()
          .filter(rule -> !grant.rule().equals(rule.getName()))
          .toList();
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read seed " + SEEDED_POLICY, e);
    }
  }

  private static Rule premiseRule(Grant grant, String resource, String condition) {
    return rule(List.of(resource), grant.premise(), Rule.Effect.ALLOW, condition)
        .withName(EDIT_RULE);
  }

  private static Rule ruleWithout(MetadataOperation operation) {
    return rule(List.of(ALL_RESOURCES), operation, Rule.Effect.ALLOW, null);
  }

  private static Rule deniedPremiseRule(Grant grant) {
    return rule(List.of(ALL_RESOURCES), grant.premise(), Rule.Effect.DENY, null);
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

  private static void assertGrantsOnlyTheNamedOperation(Database db, Grant grant) {
    Rule added =
        policy(db, DATA_CONSUMER_POLICY).getRules().stream()
            .filter(rule -> grant.rule().equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(List.of(grant.operation()), added.getOperations());
    assertEquals(List.of(grant.resource()), added.getResources());
    assertEquals(Rule.Effect.ALLOW, added.getEffect());
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
  private static String grantStatement(Grant grant, String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
            .filter(sql -> sql.contains(grant.rule()) && sql.contains(STATEMENT))
            .toList();
    assertEquals(1, statements.size(), "Expected one " + grant + " statement in " + dialect);
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
