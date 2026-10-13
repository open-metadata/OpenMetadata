package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * End-to-end behaviour of the data quality dimension a test case carries.
 *
 * <p>A test case stores its dimension as a relationship written when it is created, so nothing is
 * resolved at read time. That makes a change to the test definition's dimension something that has
 * to be <em>pushed down</em>, and it makes the distinction between a dimension a test case
 * inherited and one the user chose the thing every operation has to respect. These tests pin the
 * full transition matrix — set, reclassify, clear, reset, delete — and assert on both sides of that
 * distinction every time.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataQualityDimensionPropagationIT {

  private static final String DIMENSIONS_PATH = "/v1/dataQuality/dimensions";
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  // ---------------------------------------------------------------- happy path

  @Test
  void testCaseWithoutADimensionInheritsTheOneOnItsTestDefinition(TestNamespace ns) {
    Table table = createTable(ns, "inh");
    TestDefinition definition = createTestDefinition(ns, "inh", "Completeness");

    TestCase testCase = createTestCase(table, "inhCase_" + ns.uniqueShortId(), definition, null);

    assertNotNull(testCase.getDataQualityDimension(), "dimension is resolved at create time");
    assertEquals("Completeness", testCase.getDataQualityDimension().getName());
    assertEquals(
        Boolean.TRUE,
        testCase.getDataQualityDimension().getInherited(),
        "a dimension taken from the test definition is marked inherited");
  }

  @Test
  void testCaseWithItsOwnDimensionIsNotMarkedInherited(TestNamespace ns) {
    Table table = createTable(ns, "own");
    TestDefinition definition = createTestDefinition(ns, "own", "Completeness");

    TestCase testCase =
        createTestCase(table, "ownCase_" + ns.uniqueShortId(), definition, "Accuracy");

    assertEquals("Accuracy", testCase.getDataQualityDimension().getName());
    assertNull(
        testCase.getDataQualityDimension().getInherited(),
        "a dimension the caller supplied is the test case's own, not inherited");
  }

  @Test
  void reclassifyingATestDefinitionMovesInheritedTestCasesAndSparesOverrides(TestNamespace ns) {
    Table table = createTable(ns, "recl");
    TestDefinition definition = createTestDefinition(ns, "recl", "Completeness");
    String custom = createCustomDimension(ns, "Recl");

    TestCase inherited = createTestCase(table, "reclInh_" + ns.uniqueShortId(), definition, null);
    TestCase overridden =
        createTestCase(table, "reclOvr_" + ns.uniqueShortId(), definition, "Accuracy");

    reclassify(definition, custom);

    assertEquals(
        custom,
        dimensionOf(inherited),
        "the inherited test case follows its test definition to the new dimension");
    assertEquals(Boolean.TRUE, refOf(inherited).getInherited(), "and is still marked inherited");
    assertEquals(
        "Accuracy",
        dimensionOf(overridden),
        "a dimension set on the test case itself survives the reclassification");
  }

  @Test
  void clearingATestDefinitionsDimensionRemovesInheritedOnesAndSparesOverrides(TestNamespace ns) {
    Table table = createTable(ns, "clr");
    TestDefinition definition = createTestDefinition(ns, "clr", "Completeness");

    TestCase inherited = createTestCase(table, "clrInh_" + ns.uniqueShortId(), definition, null);
    TestCase overridden =
        createTestCase(table, "clrOvr_" + ns.uniqueShortId(), definition, "Accuracy");

    reclassify(definition, null);

    assertNull(refOf(inherited), "the inherited dimension is dropped with the definition's");
    assertEquals("Accuracy", dimensionOf(overridden), "the override is untouched");
  }

  @Test
  void resettingADimensionOnATestDefinitionRecreatesTheInheritedOnes(TestNamespace ns) {
    Table table = createTable(ns, "rst");
    TestDefinition definition = createTestDefinition(ns, "rst", "Completeness");

    TestCase inherited = createTestCase(table, "rstInh_" + ns.uniqueShortId(), definition, null);
    TestCase overridden =
        createTestCase(table, "rstOvr_" + ns.uniqueShortId(), definition, "Accuracy");

    reclassify(definition, null);
    assertNull(refOf(inherited), "precondition: cleared");

    reclassify(definition, "Uniqueness");

    assertEquals(
        "Uniqueness",
        dimensionOf(inherited),
        "going from no dimension back to one recreates the inherited relationship");
    assertEquals(Boolean.TRUE, refOf(inherited).getInherited());
    assertEquals(
        "Accuracy",
        dimensionOf(overridden),
        "the override is not overwritten when inherited rows are recreated");
  }

  @Test
  void reclassifyingTwiceDoesNotAccumulateRelationships(TestNamespace ns) {
    Table table = createTable(ns, "twice");
    TestDefinition definition = createTestDefinition(ns, "twice", "Completeness");
    TestCase testCase = createTestCase(table, "twiceCase_" + ns.uniqueShortId(), definition, null);

    reclassify(definition, "Uniqueness");
    reclassify(definition, "Validity");
    reclassify(definition, null);
    reclassify(definition, "Integrity");

    assertEquals("Integrity", dimensionOf(testCase));
    assertEquals(
        1,
        countDimensionEdges(testCase.getId()),
        "a test case always has at most one dimension relationship");
  }

  // ------------------------------------------------------------ non-happy path

  @Test
  void reclassifyingToAnUnknownDimensionIsRejectedAndChangesNothing(TestNamespace ns) {
    Table table = createTable(ns, "unk");
    TestDefinition definition = createTestDefinition(ns, "unk", "Completeness");
    TestCase testCase = createTestCase(table, "unkCase_" + ns.uniqueShortId(), definition, null);

    assertThrows(
        Exception.class, () -> reclassify(definition, "NoSuchDimension_" + ns.uniqueShortId()));

    assertEquals(
        "Completeness", dimensionOf(testCase), "a rejected reclassification must not half-apply");
  }

  @Test
  void creatingATestCaseWithAnUnknownDimensionIsRejected(TestNamespace ns) {
    Table table = createTable(ns, "badDim");
    TestDefinition definition = createTestDefinition(ns, "badDim", "Completeness");

    assertThrows(
        Exception.class,
        () ->
            createTestCase(
                table,
                "badDimCase_" + ns.uniqueShortId(),
                definition,
                "Nope_" + ns.uniqueShortId()));
  }

  @Test
  void systemDimensionsCannotBeDeletedOrModified(TestNamespace ns) {
    String id = (String) getDimensionByName("Accuracy").get("id");

    assertEquals(
        400,
        send("DELETE", DIMENSIONS_PATH + "/" + id + "?hardDelete=true", null).statusCode(),
        "system dimensions cannot be deleted");
    assertEquals(
        400,
        sendPatch(
                DIMENSIONS_PATH + "/" + id,
                "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"changed\"}]")
            .statusCode(),
        "system dimensions cannot be edited");
  }

  @Test
  void creatingADimensionThatAlreadyExistsIsRejected(TestNamespace ns) {
    String name = createCustomDimension(ns, "Dup");
    assertEquals(
        409,
        send("POST", DIMENSIONS_PATH, Map.of("name", name)).statusCode(),
        "dimension names are unique");
  }

  @Test
  void deletingADimensionClearsItFromTestDefinitionsAndTestCases(TestNamespace ns) {
    Table table = createTable(ns, "del");
    String custom = createCustomDimension(ns, "Del");
    TestDefinition definition = createTestDefinition(ns, "del", "Completeness");
    reclassify(definition, custom);

    TestCase inherited = createTestCase(table, "delInh_" + ns.uniqueShortId(), definition, null);
    assertEquals(custom, dimensionOf(inherited), "precondition: inherited the custom dimension");

    deleteDimension(custom);

    // The repair is asynchronous: the delete returns as soon as the dimension row is gone.
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () -> {
              assertNull(
                  reload(definition).getDataQualityDimension(),
                  "the dangling name is cleared off the test definition");
              assertNull(refOf(inherited), "the test case no longer reports the deleted dimension");
            });
  }

  @Test
  void deletingADimensionLeavesTestCasesOfOtherDefinitionsAlone(TestNamespace ns) {
    Table table = createTable(ns, "iso");
    String custom = createCustomDimension(ns, "Iso");
    TestDefinition affected = createTestDefinition(ns, "isoA", "Completeness");
    TestDefinition untouched = createTestDefinition(ns, "isoB", "Uniqueness");
    reclassify(affected, custom);

    TestCase inAffected = createTestCase(table, "isoA_" + ns.uniqueShortId(), affected, null);
    TestCase inUntouched = createTestCase(table, "isoB_" + ns.uniqueShortId(), untouched, null);

    deleteDimension(custom);

    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertNull(refOf(inAffected)));
    assertEquals(
        "Uniqueness",
        dimensionOf(inUntouched),
        "an unrelated test definition's test cases keep their dimension");
  }

  @Test
  void puttingTheSameTestDefinitionTwiceUpsertsRatherThan404(TestNamespace ns) {
    // The Python ingestion tests drive test definitions with create_or_update, i.e. PUT. On a PUT
    // the entity arrives with a freshly generated id (EntityMapper.copy), so looking the existing
    // one up by id alone throws EntityNotFoundException and the upsert surfaced as a 404.
    Map<String, Object> body =
        Map.of(
            "name", "upsertDef_" + ns.uniqueShortId(),
            "description", "upsert regression",
            "entityType", "COLUMN",
            "testPlatforms", List.of("OpenMetadata"),
            "dataQualityDimension", "Completeness");

    HttpResponse<String> first = send("PUT", "/v1/dataQuality/testDefinitions", body);
    assertTrue(
        first.statusCode() == 200 || first.statusCode() == 201,
        "first PUT creates: " + first.statusCode() + " " + first.body());

    HttpResponse<String> second = send("PUT", "/v1/dataQuality/testDefinitions", body);
    assertTrue(
        second.statusCode() == 200 || second.statusCode() == 201,
        "second PUT updates rather than 404: " + second.statusCode() + " " + second.body());
  }

  // ------------------------------------------------------------------- helpers

  private TestCase createTestCase(
      Table table, String name, TestDefinition definition, String dimension) {
    CreateTestCase create =
        new CreateTestCase()
            .withName(name)
            .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
            .withTestDefinition(definition.getFullyQualifiedName());
    if (dimension != null) {
      create.withDataQualityDimension(dimension);
    }
    return SdkClients.adminClient().testCases().create(create);
  }

  private TestDefinition createTestDefinition(TestNamespace ns, String prefix, String dimension) {
    return SdkClients.adminClient()
        .testDefinitions()
        .create(
            new CreateTestDefinition()
                .withName(prefix + "Def_" + ns.uniqueShortId())
                .withDescription("propagation IT")
                .withEntityType(TestDefinitionEntityType.COLUMN)
                .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA))
                .withDataQualityDimension(dimension));
  }

  /**
   * Changes the test definition's dimension with a JSON patch — the path the Test Library UI uses,
   * and the one that runs entitySpecificUpdate and therefore the propagation under test.
   */
  private void reclassify(TestDefinition definition, String dimension) {
    TestDefinition current = reload(definition);
    String patch;
    if (dimension == null) {
      if (current.getDataQualityDimension() == null) {
        return;
      }
      patch = "[{\"op\":\"remove\",\"path\":\"/dataQualityDimension\"}]";
    } else {
      // "add" rather than "replace": it works whether or not the field is currently set.
      patch =
          "[{\"op\":\"add\",\"path\":\"/dataQualityDimension\",\"value\":\"" + dimension + "\"}]";
    }
    SdkClients.adminClient()
        .testDefinitions()
        .patch(definition.getId().toString(), JsonUtils.readTree(patch));
  }

  private String createCustomDimension(TestNamespace ns, String prefix) {
    String name = prefix + "Dim" + ns.uniqueShortId();
    HttpResponse<String> response =
        send("POST", DIMENSIONS_PATH, Map.of("name", name, "displayName", name));
    assertEquals(201, response.statusCode(), "created dimension " + name + ": " + response.body());
    return name;
  }

  private void deleteDimension(String name) {
    String id = (String) getDimensionByName(name).get("id");
    HttpResponse<String> response =
        send("DELETE", DIMENSIONS_PATH + "/" + id + "?hardDelete=true", null);
    assertEquals(200, response.statusCode(), "deleted dimension " + name);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getDimensionByName(String name) {
    HttpResponse<String> response =
        send(
            "GET",
            DIMENSIONS_PATH + "/name/" + URLEncoder.encode(name, StandardCharsets.UTF_8),
            null);
    assertEquals(200, response.statusCode(), "dimension " + name + " exists");
    return JsonUtils.readValue(response.body(), Map.class);
  }

  private HttpResponse<String> sendPatch(String path, String jsonPatch) {
    try {
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(SdkClients.baseUrl() + path))
              .header("Authorization", "Bearer " + SdkClients.getAdminToken())
              .header("Content-Type", "application/json-patch+json")
              .method("PATCH", HttpRequest.BodyPublishers.ofString(jsonPatch))
              .build();
      return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (Exception e) {
      throw new IllegalStateException("PATCH " + path + " failed", e);
    }
  }

  /** The dimension endpoints have no SDK client yet, so they are exercised over plain HTTP. */
  private HttpResponse<String> send(String method, String path, Object body) {
    try {
      HttpRequest.BodyPublisher publisher =
          body == null
              ? HttpRequest.BodyPublishers.noBody()
              : HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(body));
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(SdkClients.baseUrl() + path))
              .header("Authorization", "Bearer " + SdkClients.getAdminToken())
              .header("Content-Type", "application/json")
              .method(method, publisher)
              .build();
      return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (Exception e) {
      throw new IllegalStateException(method + " " + path + " failed", e);
    }
  }

  private TestDefinition reload(TestDefinition definition) {
    return SdkClients.adminClient().testDefinitions().get(definition.getId().toString());
  }

  private EntityReference refOf(TestCase testCase) {
    return SdkClients.adminClient()
        .testCases()
        .get(testCase.getId().toString())
        .getDataQualityDimension();
  }

  private String dimensionOf(TestCase testCase) {
    EntityReference ref = refOf(testCase);
    return ref == null ? null : ref.getName();
  }

  private int countDimensionEdges(UUID testCaseId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM entity_relationship WHERE toId = :id "
                            + "AND fromEntity = 'dataQualityDimension'")
                    .bind("id", testCaseId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private Table createTable(TestNamespace ns, String prefix) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "Db_" + id)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(prefix + "Sc_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(prefix + "Tb_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }
}
