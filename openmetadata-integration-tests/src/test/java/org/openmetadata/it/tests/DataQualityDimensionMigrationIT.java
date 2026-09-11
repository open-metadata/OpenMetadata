package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
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
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.migration.utils.v210.DataQualityDimensionMigration;

/**
 * The 2.1.0 upgrade path for data quality dimensions (issue #30362).
 *
 * <p>Test cases created before 2.1.0 hold no dimension relationship, and the upgrade is the only
 * thing that will ever give them one — migration statements are checksummed as applied, so a
 * backfill that does nothing does nothing permanently.
 *
 * <p>Isolated rather than concurrent: proving the migration stands on its own means taking away
 * the seeded dimension it has to join against, which is state the whole suite shares.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class DataQualityDimensionMigrationIT {

  /**
   * Not used by any other test, so it can be removed and restored without disturbing them. The
   * migration re-seeds it from the same JSON resource the server uses.
   */
  private static final String SACRIFICIAL_DIMENSION = "Consistency";

  /**
   * The regression that shipped: the backfill lived in the SQL migration, which runs to completion
   * before the server boots and seeds the dimension entities. Its join therefore matched an empty
   * table and inserted nothing.
   *
   * <p>Deleting the dimension row reproduces exactly that — the migration has to seed what it
   * needs before it can resolve anything. Without the seeding step this fails: the join finds no
   * dimension and the test case is left with none, which is precisely what happened on upgrade.
   */
  @Test
  void migrationSeedsTheDimensionsItJoinsAgainstBeforeBackfilling(TestNamespace ns) {
    Table table = createTable(ns, "seed");
    TestDefinition definition = createTestDefinition(ns, "seed", SACRIFICIAL_DIMENSION);
    TestCase testCase = createTestCase(table, "seedCase_" + ns.uniqueShortId(), definition, null);

    // The full pre-upgrade shape: no relationship, and no dimension entity to point one at.
    deleteDimensionRelationship(testCase.getId());
    deleteDimensionRow(SACRIFICIAL_DIMENSION);
    assertEquals(0, countDimensionRows(SACRIFICIAL_DIMENSION), "precondition: dimension removed");
    assertNull(refOf(testCase), "precondition: test case looks like one created before 2.1.0");

    DataQualityDimensionMigration.backfillTestCaseDimensions(
        TestSuiteBootstrap.getJdbi().open(), TestSuiteBootstrap.getConnectionType());

    assertEquals(
        1,
        countDimensionRows(SACRIFICIAL_DIMENSION),
        "the migration seeds the system dimensions rather than assuming they are there");
    EntityReference repaired = refOf(testCase);
    assertNotNull(repaired, "and only then can the backfill resolve one for the test case");
    assertEquals(SACRIFICIAL_DIMENSION, repaired.getName());
    assertEquals(
        Boolean.TRUE,
        repaired.getInherited(),
        "backfilled rows are inherited, so reclassifying the definition still moves them");
  }

  /** Upgrading twice, or upgrading an already-current deployment, must not duplicate anything. */
  @Test
  void backfillIsIdempotentAndSparesDimensionsTheUserPicked(TestNamespace ns) {
    Table table = createTable(ns, "idem");
    TestDefinition definition = createTestDefinition(ns, "idem", "Completeness");
    TestCase inherited = createTestCase(table, "idemInh_" + ns.uniqueShortId(), definition, null);
    TestCase overridden =
        createTestCase(table, "idemOwn_" + ns.uniqueShortId(), definition, "Accuracy");

    deleteDimensionRelationship(inherited.getId());
    runBackfill();
    runBackfill();

    assertEquals("Completeness", refOf(inherited).getName());
    assertEquals(
        1, countDimensionEdges(inherited.getId()), "a second run adds no second relationship row");
    assertEquals(
        "Accuracy",
        refOf(overridden).getName(),
        "a dimension the user picked is never touched by the backfill");
  }

  // ------------------------------------------------------------------- helpers

  private void runBackfill() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                DataQualityDimensionMigration.backfillTestCaseDimensions(
                    handle, TestSuiteBootstrap.getConnectionType()));
  }

  private void deleteDimensionRelationship(UUID testCaseId) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "DELETE FROM entity_relationship WHERE toId = :id "
                            + "AND toEntity = 'testCase' AND fromEntity = 'dataQualityDimension'")
                    .bind("id", testCaseId.toString())
                    .execute());
  }

  /**
   * Removes the dimension the way an upgrading deployment would never have had it in the first
   * place.
   *
   * <p>The cache invalidation is an artefact of the harness, not of the migration: these tests run
   * the migration inside the application's JVM, so a row deleted behind the repository's back
   * leaves its name-cache entry behind and the seeding would decide the dimension is still there.
   * A real upgrade runs in its own process against a cold cache.
   */
  private void deleteDimensionRow(String name) {
    String id =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT id FROM data_quality_dimension WHERE name = :name")
                        .bind("name", name)
                        .mapTo(String.class)
                        .findOne()
                        .orElse(null));
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM data_quality_dimension WHERE name = :name")
                    .bind("name", name)
                    .execute());
    if (id != null) {
      EntityRepository.invalidateCacheForEntity(
          Entity.DATA_QUALITY_DIMENSION, UUID.fromString(id), name);
    }
  }

  private int countDimensionRows(String name) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT count(*) FROM data_quality_dimension WHERE name = :name")
                    .bind("name", name)
                    .mapTo(Integer.class)
                    .one());
  }

  private int countDimensionEdges(UUID testCaseId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT count(*) FROM entity_relationship WHERE toId = :id "
                            + "AND toEntity = 'testCase' AND fromEntity = 'dataQualityDimension'")
                    .bind("id", testCaseId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private EntityReference refOf(TestCase testCase) {
    return SdkClients.adminClient()
        .testCases()
        .get(testCase.getId().toString())
        .getDataQualityDimension();
  }

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
                .withDescription("dimension migration IT")
                .withEntityType(TestDefinitionEntityType.COLUMN)
                .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA))
                .withDataQualityDimension(dimension));
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
