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
import java.util.ArrayList;
import java.util.Comparator;
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
 * Runs the 2.1.0 statement that adds the administration deny rule to {@code DomainOnlyAccessPolicy}
 * against real MySQL and PostgreSQL. The statement is read from the shipped {@code
 * schemaChanges.sql}, and the added rule is compared with the seeded policy, so neither can drift
 * from what upgrades run.
 */
@Testcontainers(disabledWithoutDocker = true)
class DomainOnlyAccessPolicySqlMigrationTest {
  private static final String PASSWORD = "domain-policy-test";
  private static final String DATABASE = "domain_policy_test";
  private static final String POLICY = "DomainOnlyAccessPolicy";
  private static final String OTHER_POLICY = "OtherPolicy";
  private static final List<String> ADDED_RULES =
      List.of("DomainAccessDenyAdministrationRule", "DomainAccessDenyTeamAndUserRule");
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

  private record Scenario(String description, List<Rule> rules, boolean appended) {
    @Override
    public String toString() {
      return description;
    }
  }

  static Stream<Arguments> scenarios() {
    Rule deny = shippedDeny();
    Rule allow = shippedAllow();
    return Stream.of(MYSQL_DIALECT, POSTGRES_DIALECT)
        .flatMap(
            dialect ->
                Stream.of(
                        // 1.9.10 wrote deny first; the repository stores rules sorted by name
                        new Scenario("as 1.9.10 migrated it", List.of(deny, allow), true),
                        new Scenario("as the repository stores it", List.of(allow, deny), true),
                        // A deny only removes access, so a customised policy gets it too
                        new Scenario(
                            "allow condition customised",
                            List.of(deny, shippedAllow().withCondition("hasDomain() && isOwner()")),
                            true),
                        new Scenario(
                            "rule already present", withAddedRules(List.of(deny, allow)), false))
                    .map(scenario -> Arguments.of(dialect, scenario)));
  }

  @ParameterizedTest(name = "{0}: {1}")
  @MethodSource("scenarios")
  void addsTheDenyRulesOnce(String dialect, Scenario scenario) {
    try (Handle handle = open(dialect)) {
      createPolicyTable(handle, dialect);
      insertPolicy(handle, dialect, POLICY, scenario.rules());
      insertPolicy(handle, dialect, OTHER_POLICY, List.of(shippedDeny(), shippedAllow()));
      List<String> statements = migrationStatements(dialect);

      statements.forEach(handle::execute);
      List<Rule> afterFirstRun = policy(handle, dialect, POLICY).getRules();
      statements.forEach(handle::execute);

      List<Rule> expected =
          scenario.appended() ? withAddedRules(scenario.rules()) : scenario.rules();
      assertEquals(summary(expected), summary(afterFirstRun));
      assertEquals(afterFirstRun, policy(handle, dialect, POLICY).getRules(), "Second run changed");
      assertEquals(
          summary(List.of(shippedDeny(), shippedAllow())),
          summary(policy(handle, dialect, OTHER_POLICY).getRules()),
          "Another policy must be left alone");
    }
  }

  private static Rule shippedDeny() {
    return new Rule()
        .withName("DomainAccessDenyRule")
        .withDescription("Deny access when domain check fails")
        .withEffect(Rule.Effect.DENY)
        .withResources(new ArrayList<>(List.of("All")))
        .withOperations(new ArrayList<>(List.of(MetadataOperation.ALL)))
        .withCondition("!hasDomain()");
  }

  private static Rule shippedAllow() {
    return new Rule()
        .withName("DomainAccessAllowRule")
        .withDescription("Allow access when domain check passes")
        .withEffect(Rule.Effect.ALLOW)
        .withResources(new ArrayList<>(List.of("All")))
        .withOperations(new ArrayList<>(List.of(MetadataOperation.ALL)))
        .withCondition("hasDomain()");
  }

  /** Name, effect, resources, operations and condition of each rule, in name order. */
  private static List<String> summary(List<Rule> rules) {
    return rules.stream()
        .sorted(Comparator.comparing(Rule::getName))
        .map(
            rule ->
                String.join(
                    "|",
                    rule.getName(),
                    rule.getEffect().value(),
                    rule.getResources().stream().sorted().toList().toString(),
                    rule.getOperations().stream()
                        .map(MetadataOperation::value)
                        .sorted()
                        .toList()
                        .toString(),
                    rule.getCondition()))
        .toList();
  }

  /** {@code rules} followed by the added rules as new installations are seeded with them. */
  private static List<Rule> withAddedRules(List<Rule> rules) {
    try (InputStream seed =
        DomainOnlyAccessPolicySqlMigrationTest.class
            .getClassLoader()
            .getResourceAsStream("json/data/policy/DomainAccessPolicy.json")) {
      List<Rule> result = new ArrayList<>(rules);
      JsonUtils.readValue(new String(seed.readAllBytes()), Policy.class).getRules().stream()
          .filter(rule -> ADDED_RULES.contains(rule.getName()))
          .forEach(result::add);
      return result;
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
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

  private static void createPolicyTable(Handle handle, String dialect) {
    handle.execute("DROP TABLE IF EXISTS policy_entity");
    handle.execute(POSTGRES_DIALECT.equals(dialect) ? POSTGRES_POLICY_TABLE : MYSQL_POLICY_TABLE);
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

  private static void insertPolicy(Handle handle, String dialect, String name, List<Rule> rules) {
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withRules(rules);
    String value = POSTGRES_DIALECT.equals(dialect) ? "CAST(:json AS JSONB)" : ":json";
    handle
        .createUpdate("INSERT INTO policy_entity (json, fqnHash) VALUES (" + value + ", :fqnHash)")
        .bind("json", JsonUtils.pojoToJson(policy))
        .bind("fqnHash", name)
        .execute();
  }

  private static Policy policy(Handle handle, String dialect, String policyName) {
    String text = POSTGRES_DIALECT.equals(dialect) ? "CAST(json AS TEXT)" : "CAST(json AS CHAR)";
    String json =
        handle
            .createQuery("SELECT " + text + " FROM policy_entity WHERE name = :n")
            .bind("n", policyName)
            .mapTo(String.class)
            .one();
    return JsonUtils.readValue(json, Policy.class);
  }

  /** Parsed with the migration framework's own splitter, so they are what an upgrade would run. */
  private static List<String> migrationStatements(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
            .filter(sql -> sql.contains(POLICY) && ADDED_RULES.stream().anyMatch(sql::contains))
            .toList();
    assertEquals(ADDED_RULES.size(), statements.size(), "Expected one statement per added rule");
    return statements;
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
