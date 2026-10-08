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
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.openmetadata.service.util.EntityUtil;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statement that gives an existing {@code DataConsumerPolicy} the agent SPARQL grant
 * (#34231) against real MySQL and PostgreSQL. The statement is read from the shipped {@code
 * schemaChanges.sql}, so the test fails if either dialect drifts from what upgrades really run.
 *
 * <p>The grant is only added while some allow rule of Data Consumer still lists {@code ViewAll},
 * which is the premise the grant's risk acceptance rests on. The check is deliberately as simple as
 * the 2.0 policy backfills: it does not look at conditions or resources, and it cannot see deny
 * rules in other policies. The "known limit" scenarios pin those gaps so they stay visible.
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
  private static final String SHIPPED_DESCRIPTION =
      "Allow authenticated users to run read-only SPARQL queries through the agent SPARQL"
          + " endpoint. The endpoint does not filter results by asset, so remove this rule if"
          + " viewing is restricted through custom policies.";
  private static final String CUSTOM_DESCRIPTION = "Kept by the administrator";
  private static final String ALL_RESOURCES = "all";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";

  /**
   * MD5 of the grant statement as 2.1.0 first shipped it, which is what environments already at
   * 2.1.0 recorded. The runner tracks statements by a hash of their text, so editing the statement
   * would run it again there, and its only guard (the rule does not exist) would add back a rule an
   * administrator deleted. Change the description with a new statement instead.
   */
  private static final Map<String, String> RECORDED_GRANT_STATEMENT_HASH =
      Map.of(
          MYSQL_DIALECT,
          "38ef58a4f3b4e037bf70417b3c490c6a",
          POSTGRES_DIALECT,
          "f99d8f93f30f81c15c46a65bd31c818d");

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
        new Scenario("ViewAll dropped", List.of(ruleWithout(MetadataOperation.EDIT_TAGS)), false),
        new Scenario("ViewAll denied", List.of(deniedViewRule()), false),
        new Scenario(
            "wildcard operation without ViewAll",
            List.of(ruleWithout(MetadataOperation.ALL)),
            false),
        new Scenario(
            "known limit: conditional ViewAll is not detected",
            List.of(viewRule(ALL_RESOURCES, "isOwner()")),
            true),
        new Scenario(
            "known limit: ViewAll on one resource is not detected",
            List.of(viewRule("table", null)),
            true));
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

  @ParameterizedTest
  @MethodSource("dialects")
  void theGrantStatementKeepsTheTextEnvironmentsAlreadyRecorded(String dialect) {
    assertEquals(
        RECORDED_GRANT_STATEMENT_HASH.get(dialect),
        EntityUtil.hash(grantStatement(dialect)),
        "The grant statement was edited; add a new statement instead (see the constant's note)");
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void anAppendedStatementUpdatesOnlyTheOldDescriptionOfTheRule(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, List.of(viewRule(ALL_RESOURCES, null)));
      insertPolicy(db, OTHER_POLICY, List.of(viewRule(ALL_RESOURCES, null), shippedGrant()));
      handle.execute(grantStatement(dialect));
      assertEquals(SHIPPED_DESCRIPTION, grantDescription(db, DATA_CONSUMER_POLICY));

      handle.execute(descriptionStatement(dialect));

      assertEquals(seededDescription(), grantDescription(db, DATA_CONSUMER_POLICY));
      assertEquals(List.of(EDIT_RULE, GRANT_RULE), ruleNames(db, DATA_CONSUMER_POLICY));
      assertGrantsOnlyTheNamedOperation(db);
      assertEquals(SHIPPED_DESCRIPTION, grantDescription(db, OTHER_POLICY));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void aRuleAnAdministratorDeletedStaysDeletedWhenOnlyUnrecordedStatementsRun(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, List.of(viewRule(ALL_RESOURCES, null)));
      Set<String> recorded = new HashSet<>();
      runUnrecorded(db, recorded, List.of(grantStatement(dialect)));
      deleteGrantRule(db);
      assertEquals(List.of(EDIT_RULE), ruleNames(db, DATA_CONSUMER_POLICY));

      runUnrecorded(db, recorded, List.of(grantStatement(dialect), descriptionStatement(dialect)));

      assertEquals(List.of(EDIT_RULE), ruleNames(db, DATA_CONSUMER_POLICY));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void aDescriptionTheAdministratorCustomisedIsLeftAlone(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(
          db,
          DATA_CONSUMER_POLICY,
          List.of(
              viewRule(ALL_RESOURCES, null), shippedGrant().withDescription(CUSTOM_DESCRIPTION)));

      handle.execute(descriptionStatement(dialect));

      assertEquals(CUSTOM_DESCRIPTION, grantDescription(db, DATA_CONSUMER_POLICY));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void aFreshInstallSeededWithTheNewTextIsLeftAlone(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(
          db,
          DATA_CONSUMER_POLICY,
          List.of(
              viewRule(ALL_RESOURCES, null), shippedGrant().withDescription(seededDescription())));

      handle.execute(descriptionStatement(dialect));

      assertEquals(seededDescription(), grantDescription(db, DATA_CONSUMER_POLICY));
      assertEquals(List.of(EDIT_RULE, GRANT_RULE), ruleNames(db, DATA_CONSUMER_POLICY));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void runningTheWholeFileAgainChangesNothing(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = new Database(handle, dialect);
      createPolicyTable(db);
      insertPolicy(db, DATA_CONSUMER_POLICY, List.of(viewRule(ALL_RESOURCES, null)));
      List<String> file = List.of(grantStatement(dialect), descriptionStatement(dialect));
      file.forEach(handle::execute);
      Policy once = policy(db, DATA_CONSUMER_POLICY);

      file.forEach(handle::execute);

      assertEquals(
          JsonUtils.pojoToJson(once), JsonUtils.pojoToJson(policy(db, DATA_CONSUMER_POLICY)));
      assertEquals(seededDescription(), grantDescription(db, DATA_CONSUMER_POLICY));
    }
  }

  static Stream<String> dialects() {
    return Stream.of(MYSQL_DIALECT, POSTGRES_DIALECT);
  }

  private static Rule viewRule(String resource, String condition) {
    return rule(List.of(resource), MetadataOperation.VIEW_ALL, Rule.Effect.ALLOW, condition)
        .withName(EDIT_RULE);
  }

  private static Rule ruleWithout(MetadataOperation operation) {
    return rule(List.of(ALL_RESOURCES), operation, Rule.Effect.ALLOW, null);
  }

  private static Rule deniedViewRule() {
    return rule(List.of(ALL_RESOURCES), MetadataOperation.VIEW_ALL, Rule.Effect.DENY, null);
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
    List<String> statements =
        ruleStatements(dialect).stream().filter(sql -> !sql.contains(seededDescription())).toList();
    assertEquals(1, statements.size(), "Expected one grant statement in " + dialect);
    return statements.getFirst();
  }

  /** The appended statement that gives the rule its current description. */
  private static String descriptionStatement(String dialect) {
    List<String> statements =
        ruleStatements(dialect).stream().filter(sql -> sql.contains(seededDescription())).toList();
    assertEquals(1, statements.size(), "Expected one description statement in " + dialect);
    return statements.getFirst();
  }

  private static List<String> ruleStatements(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    return MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
        .filter(sql -> sql.contains(GRANT_RULE) && sql.contains(STATEMENT))
        .toList();
  }

  /** The description new installations are seeded with, so the appended statement must match it. */
  private static String seededDescription() {
    try (InputStream seed =
        DataConsumerSparqlGrantSqlMigrationTest.class
            .getClassLoader()
            .getResourceAsStream("json/data/policy/DataConsumerPolicy.json")) {
      Policy policy = JsonUtils.readValue(new String(seed.readAllBytes()), Policy.class);
      return policy.getRules().stream()
          .filter(rule -> GRANT_RULE.equals(rule.getName()))
          .findFirst()
          .orElseThrow()
          .getDescription();
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static Rule shippedGrant() {
    return new Rule()
        .withName(GRANT_RULE)
        .withDescription(SHIPPED_DESCRIPTION)
        .withResources(List.of(ALL_RESOURCES))
        .withOperations(List.of(MetadataOperation.EXECUTE_SPARQL_QUERY))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static String grantDescription(Database db, String policyName) {
    return policy(db, policyName).getRules().stream()
        .filter(rule -> GRANT_RULE.equals(rule.getName()))
        .findFirst()
        .orElseThrow()
        .getDescription();
  }

  /** What the runner does: a statement whose hash is already recorded is not run again. */
  private static void runUnrecorded(Database db, Set<String> recorded, List<String> statements) {
    for (String statement : statements) {
      if (recorded.add(EntityUtil.hash(statement))) {
        db.handle().execute(statement);
      }
    }
  }

  /** An administrator removing the rule, as the release note recommends for opting out. */
  private static void deleteGrantRule(Database db) {
    Policy policy = policy(db, DATA_CONSUMER_POLICY);
    policy.getRules().removeIf(rule -> GRANT_RULE.equals(rule.getName()));
    String value = db.isPostgres() ? "CAST(:json AS JSONB)" : ":json";
    db.handle()
        .createUpdate("UPDATE policy_entity SET json = " + value + " WHERE name = :name")
        .bind("json", JsonUtils.pojoToJson(policy))
        .bind("name", DATA_CONSUMER_POLICY)
        .execute();
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
