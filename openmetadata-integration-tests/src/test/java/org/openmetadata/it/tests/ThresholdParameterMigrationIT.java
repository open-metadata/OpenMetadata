package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import java.util.Set;
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
 * The 2.1.0 upgrade path for the failure-threshold parameters.
 *
 * <p>Seeding never rewrites a test definition that already exists, so on an upgraded install the
 * migration is the only thing that adds {@code threshold} and its companions. Its statements match
 * on {@code test_definition.name}, and for three definitions that name differs from the seed file
 * name — matching on the file name updates nothing, silently, and saving a threshold on those tests
 * then fails with "Parameter 'threshold' is not defined".
 *
 * <p>Isolated rather than concurrent: it rewrites seeded definitions every other test can read.
 */
@Isolated
public class ThresholdParameterMigrationIT {

  private static final Set<String> THRESHOLD_PARAMETERS =
      Set.of("threshold", "thresholdUnit", "dimensionFailurePolicy", "minRowsPerDimension");

  /** Definition name to the parameters 2.1.0 must give it. */
  private static final Map<String, List<String>> EXPECTED_PARAMETERS =
      Map.of(
          "columnValueLengthsToBeBetween",
          List.of("threshold", "thresholdUnit", "dimensionFailurePolicy", "minRowsPerDimension"),
          "columnValuesMissingCount",
          List.of("threshold", "thresholdUnit", "dimensionFailurePolicy"),
          "columnValuesToBeAtExpectedLocation",
          List.of("threshold", "thresholdUnit", "dimensionFailurePolicy"));

  @Test
  void upgradeAddsThresholdParametersToDefinitionsWhoseNameDiffersFromTheirSeedFile() {
    Map<String, String> original = new LinkedHashMap<>();
    EXPECTED_PARAMETERS.keySet().forEach(name -> original.put(name, readJson(name)));

    try {
      original.forEach((name, json) -> writeJson(name, withoutThresholdParameters(json)));
      EXPECTED_PARAMETERS
          .keySet()
          .forEach(
              name ->
                  assertTrue(
                      parameterNames(name).stream().noneMatch(THRESHOLD_PARAMETERS::contains),
                      "precondition: " + name + " looks like a definition from before 2.1.0"));

      runTestDefinitionStatements();

      EXPECTED_PARAMETERS.forEach(
          (name, expected) ->
              assertTrue(
                  parameterNames(name).containsAll(expected),
                  name + " should gain " + expected + " but has " + parameterNames(name)));

      runTestDefinitionStatements();

      EXPECTED_PARAMETERS.forEach(
          (name, expected) ->
              expected.forEach(
                  parameter ->
                      assertEquals(
                          1,
                          parameterNames(name).stream().filter(parameter::equals).count(),
                          "a second run must not append " + parameter + " to " + name + " again")));
    } finally {
      original.forEach(this::writeJson);
    }
  }

  private void runTestDefinitionStatements() {
    ConnectionType connectionType = TestSuiteBootstrap.getConnectionType();
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(connectionType).toFile(), connectionType).stream()
            .filter(sql -> sql.contains("UPDATE test_definition"))
            .toList();
    assertFalse(statements.isEmpty(), "the 2.1.0 script backfills test definitions");
    TestSuiteBootstrap.getJdbi().useHandle(handle -> statements.forEach(handle::execute));
  }

  private static String withoutThresholdParameters(String json) {
    ObjectNode definition = (ObjectNode) JsonUtils.readTree(json);
    ArrayNode kept = JsonUtils.getObjectMapper().createArrayNode();
    definition
        .path("parameterDefinition")
        .forEach(
            parameter -> {
              if (!THRESHOLD_PARAMETERS.contains(parameter.path("name").asText())) {
                kept.add(parameter);
              }
            });
    definition.set("parameterDefinition", kept);
    return JsonUtils.pojoToJson(definition);
  }

  private List<String> parameterNames(String name) {
    List<String> names = new ArrayList<>();
    JsonNode parameters = JsonUtils.readTree(readJson(name)).path("parameterDefinition");
    parameters.forEach(parameter -> names.add(parameter.path("name").asText()));
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
            "2.1.0",
            dialect,
            "postDataMigrationSQLScript.sql");
    return Files.exists(file) ? file : Path.of("..").resolve(file);
  }
}
