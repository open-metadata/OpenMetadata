package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * The 2.2.0 upgrade path for the tableCustomSQLQuery definition.
 *
 * <p>Seeding never rewrites a test definition that already exists, so on an install whose record
 * predates #20307/#22697 the migration is the only thing that adds {@code operator} and {@code
 * partitionExpression}. Without the operator the Add Test Case form has no way to compare the query
 * result to the threshold; without the partition expression Compute Row Count has nothing to count
 * by. Each statement is guarded on the parameter being absent, so re-runs — and deployments that
 * already have the parameter — must be no-ops.
 *
 * <p>Isolated rather than concurrent: it rewrites seeded definitions every other test can read.
 */
@Isolated
public class CustomSqlDefinitionMigrationIT {

  private static final String DEFINITION_NAME = "tableCustomSQLQuery";
  private static final String UNRELATED_DEFINITION_NAME = "columnValuesToBeNotNull";
  private static final List<String> BACKFILLED_PARAMETERS =
      List.of("operator", "partitionExpression");

  @Test
  void upgradeAppendsOperatorAndPartitionExpressionToOldDefinitionRecords() {
    Map<String, String> original = new LinkedHashMap<>();
    List.of(DEFINITION_NAME, UNRELATED_DEFINITION_NAME)
        .forEach(name -> original.put(name, readJson(name)));

    try {
      upgradeOldRecord(original.get(DEFINITION_NAME));
      upgradePartiallyRepairedRecord();
      assertTrue(
          upgradeIsNoOpForModernRecord(original.get(DEFINITION_NAME)),
          "a record that already has both parameters must be untouched");
    } finally {
      original.forEach(this::writeJson);
    }
  }

  /**
   * A record created from a pre-#20307 seed: neither backfilled parameter exists, and the ones the
   * 2.1.0 script appended are already there.
   */
  private void upgradeOldRecord(String seededJson) {
    writeJson(DEFINITION_NAME, withoutBackfilledParameters(seededJson));
    List<String> preExisting = parameterNames(DEFINITION_NAME);
    assertPreconditions(preExisting);

    runTestDefinitionStatements();

    assertBackfilledOnce(seededJson, preExisting);
    assertUnrelatedDefinitionUntouched();

    runTestDefinitionStatements();

    BACKFILLED_PARAMETERS.forEach(
        parameter ->
            assertEquals(
                1,
                countParameter(parameters(DEFINITION_NAME), parameter),
                "a second run must not append " + parameter + " again"));
  }

  private void assertPreconditions(List<String> preExisting) {
    assertTrue(
        preExisting.stream().noneMatch(BACKFILLED_PARAMETERS::contains),
        "precondition: the record looks like one from before 2.2.0");
    assertTrue(
        preExisting.contains("thresholdUnit"),
        "precondition: the 2.1.0 backfill has already added thresholdUnit");
  }

  private void assertBackfilledOnce(String seededJson, List<String> preExisting) {
    JsonNode parameters = parameters(DEFINITION_NAME);
    BACKFILLED_PARAMETERS.forEach(
        parameter ->
            assertEquals(1, countParameter(parameters, parameter), "exactly one " + parameter));
    assertMatchesSeed(parameters, seededJson);
    assertEquals(
        BACKFILLED_PARAMETERS,
        parameterNames(DEFINITION_NAME).subList(preExisting.size(), preExisting.size() + 2),
        "the backfill appends the parameters after the ones already present");
    assertPreservesExistingParameters(parameters, preExisting);
  }

  /** A record from between the two seeds: it has the operator but not the partition expression. */
  private void upgradePartiallyRepairedRecord() {
    writeJson(DEFINITION_NAME, withoutBackfilledParameters(readJson(DEFINITION_NAME)));
    addParameter(readJson(DEFINITION_NAME), "operator");

    runTestDefinitionStatements();

    JsonNode parameters = parameters(DEFINITION_NAME);
    assertEquals(
        1, countParameter(parameters, "operator"), "the seeded operator is not duplicated");
    assertEquals(
        1, countParameter(parameters, "partitionExpression"), "the missing parameter is appended");
  }

  private boolean upgradeIsNoOpForModernRecord(String seededJson) {
    writeJson(DEFINITION_NAME, seededJson);

    runTestDefinitionStatements();

    return seededJson.equals(readJson(DEFINITION_NAME));
  }

  private void runTestDefinitionStatements() {
    ConnectionType connectionType = TestSuiteBootstrap.getConnectionType();
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(connectionType).toFile(), connectionType).stream()
            .filter(sql -> sql.contains("UPDATE test_definition"))
            .toList();
    assertEquals(
        BACKFILLED_PARAMETERS.size(),
        statements.size(),
        "the 2.2.0 script backfills one statement per parameter");
    TestSuiteBootstrap.getJdbi().useHandle(handle -> statements.forEach(handle::execute));
  }

  private void assertMatchesSeed(JsonNode parameters, String seededJson) {
    JsonNode seededParameters = JsonUtils.readTree(seededJson).path("parameterDefinition");
    BACKFILLED_PARAMETERS.forEach(
        parameter -> {
          JsonNode expected = findParameter(seededParameters, parameter);
          JsonNode actual = findParameter(parameters, parameter);
          List.of("displayName", "description", "dataType")
              .forEach(
                  field ->
                      assertEquals(
                          expected.path(field).asText(),
                          actual.path(field).asText(),
                          parameter + " " + field));
          assertEquals(optionValues(expected), optionValues(actual), parameter + " optionValues");
        });
  }

  /**
   * The parameters the record already had keep their position and their values — the backfill
   * appends, it never rewrites.
   */
  private void assertPreservesExistingParameters(JsonNode parameters, List<String> preExisting) {
    List<String> current = parameterNames(DEFINITION_NAME);
    assertEquals(
        preExisting, current.subList(0, preExisting.size()), "existing parameters are preserved");
    preExisting.forEach(
        name -> assertEquals(1, countParameter(parameters, name), name + " is not duplicated"));
  }

  private void assertUnrelatedDefinitionUntouched() {
    JsonNode parameters = parameters(UNRELATED_DEFINITION_NAME);
    BACKFILLED_PARAMETERS.forEach(
        parameter ->
            assertEquals(
                0,
                countParameter(parameters, parameter),
                "the backfill must not touch " + UNRELATED_DEFINITION_NAME));
  }

  private static String withoutBackfilledParameters(String json) {
    ObjectNode definition = (ObjectNode) JsonUtils.readTree(json);
    ArrayNode kept = JsonUtils.getObjectMapper().createArrayNode();
    definition
        .path("parameterDefinition")
        .forEach(
            parameter -> {
              if (!BACKFILLED_PARAMETERS.contains(parameter.path("name").asText())) {
                kept.add(parameter);
              }
            });
    definition.set("parameterDefinition", kept);

    return JsonUtils.pojoToJson(definition);
  }

  /** Appends a parameter the way a seed between the two backfills would have left it. */
  private void addParameter(String json, String name) {
    ObjectNode definition = (ObjectNode) JsonUtils.readTree(json);
    ArrayNode parameterDefinition = (ArrayNode) definition.path("parameterDefinition");
    ObjectNode parameter = parameterDefinition.addObject();
    parameter.put("name", name);

    writeJson(DEFINITION_NAME, JsonUtils.pojoToJson(definition));
  }

  private static JsonNode findParameter(JsonNode parameters, String name) {
    for (JsonNode parameter : parameters) {
      if (name.equals(parameter.path("name").asText())) {
        return parameter;
      }
    }

    return JsonUtils.getObjectMapper().createObjectNode();
  }

  private static int countParameter(JsonNode parameters, String name) {
    int count = 0;
    for (JsonNode parameter : parameters) {
      if (name.equals(parameter.path("name").asText())) {
        count++;
      }
    }

    return count;
  }

  private static List<String> optionValues(JsonNode parameter) {
    List<String> values = new ArrayList<>();
    parameter.path("optionValues").forEach(value -> values.add(value.asText()));

    return values;
  }

  private JsonNode parameters(String name) {
    return JsonUtils.readTree(readJson(name)).path("parameterDefinition");
  }

  private List<String> parameterNames(String name) {
    List<String> names = new ArrayList<>();
    parameters(name).forEach(parameter -> names.add(parameter.path("name").asText()));

    return names;
  }

  private String readJson(String name) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM test_definition WHERE name = :name")
                    .bind("name", name)
                    .mapTo(String.class)
                    .one());
  }

  /**
   * The cache invalidation is an artefact of the harness: the rows change behind the repository's
   * back inside the application's JVM, and a stale cached definition would leak into other tests.
   */
  private void writeJson(String name, String json) {
    String jsonBind =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
            ? "CAST(:json AS JSONB)"
            : ":json";
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE test_definition SET json = " + jsonBind + " WHERE name = :name")
                    .bind("json", json)
                    .bind("name", name)
                    .execute());
    String id = JsonUtils.readTree(json).path("id").asText();
    EntityRepository.invalidateCacheForEntity(Entity.TEST_DEFINITION, UUID.fromString(id), name);
  }

  private static Path migrationFile(ConnectionType connectionType) {
    String dialect = connectionType == ConnectionType.POSTGRES ? "postgres" : "mysql";
    Path file =
        Path.of(
            "bootstrap",
            "sql",
            "migrations",
            "native",
            "2.2.0",
            dialect,
            "postDataMigrationSQLScript.sql");

    return Files.exists(file) ? file : Path.of("..").resolve(file);
  }
}
