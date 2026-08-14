/*
 *  Copyright 2025 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Regression tests for the test-case / test-definition delete path.
 *
 * <ul>
 *   <li><b>Resilient delete (orphans):</b> a test case whose {@code testDefinition} relationship
 *       row — or whose entityLink target table — was removed out from under it can still be
 *       hard-deleted, and the delete sweeps its {@code entity_relationship} rows and
 *       test-case-result time-series. Before the fix the delete threw 500 because the delete path
 *       eagerly resolved the (now-missing) {@code testDefinition}/table via {@code putFields}, so
 *       {@code DataRetention}'s orphan cleanup could never reap these rows.
 *   <li><b>Test-definition delete confirmation:</b> deleting a test definition that still has test
 *       cases is blocked with a counted message unless {@code recursive=true}, in which case it
 *       cascade-deletes the test cases.
 *   <li><b>Residual sweep on the bulk cascade:</b> a recursive service hard delete reaps a test
 *       case whose suite chain is broken, via {@code TableRepository.entitySpecificCleanup}. That
 *       hook was unreachable while the bulk path looped the no-arg overload, so the cascade left
 *       orphans behind — and every later Data Quality listing that included one answered 404,
 *       because {@code PIIMasker.getTestCases} resolves each row's table. The listing's own
 *       tolerance for a dangling entityLink is covered by {@code PIIMaskerTest}: staging a real
 *       orphan here would need the table gone from the entity caches too, which no API sequence
 *       leaves behind once this sweep runs.
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseDeleteResilienceIT {

  @Test
  void orphanTestCase_missingTestDefinitionRelationship_hardDeletesAndSweepsRelationsAndResults(
      TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "orphTd");
    TestCase testCase = createSystemTestCase(table, "orphTdCase_" + ns.uniqueShortId());
    UUID testCaseId = testCase.getId();

    // Seed a test-case-result so we can assert the time-series is swept on delete.
    insertTestCaseResult(testCase.getFullyQualifiedName());
    assertTrue(
        countByFqnHash("data_quality_data_time_series", testCase.getFullyQualifiedName()) >= 1,
        "precondition: a test-case-result row was inserted");

    // Reproduce the production orphan exactly: drop the testDefinition -> testCase relationship
    // row, leaving the test_case row alive. The testDefinition lookup is mustHaveRelationship=true,
    // so this is the state that made the old delete path throw.
    Entity.getCollectionDAO()
        .relationshipDAO()
        .deleteTo(
            testCaseId, Entity.TEST_CASE, Relationship.CONTAINS.ordinal(), Entity.TEST_DEFINITION);
    assertEquals(
        0,
        countTestDefinitionEdges(testCaseId),
        "precondition: testDefinition relationship removed");

    // The hard delete must succeed (pre-fix this threw 500 "does not have expected relationship").
    client
        .testCases()
        .delete(testCaseId.toString(), Map.of("hardDelete", "true", "recursive", "true"));

    assertEquals(0, countById("test_case", testCaseId), "test_case row removed");
    assertEquals(0, countRelationshipRows(testCaseId), "all entity_relationship rows removed");
    assertEquals(
        0,
        countByFqnHash("data_quality_data_time_series", testCase.getFullyQualifiedName()),
        "test-case-result time-series removed");
  }

  @Test
  void orphanTestCase_deletedEntityLinkTable_hardDeletesAndSweepsRelations(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "orphTbl");
    TestCase testCase = createSystemTestCase(table, "orphTblCase_" + ns.uniqueShortId());
    UUID testCaseId = testCase.getId();

    // Orphan the test case the way a service/database deletion does: drop its basic test suite row
    // and its entityLink target table. Remove the suite BEFORE the table so we never leave a basic
    // suite whose table is gone — that transient state would break concurrent GET /testSuites
    // listings, since TestSuiteRepository.setInheritedFields resolves each basic suite's table.
    UUID basicSuiteId =
        client.testCases().get(testCaseId.toString(), "testSuite").getTestSuite().getId();
    Entity.getCollectionDAO().testSuiteDAO().delete(basicSuiteId);
    Entity.getCollectionDAO().tableDAO().delete(table.getId());

    client
        .testCases()
        .delete(testCaseId.toString(), Map.of("hardDelete", "true", "recursive", "true"));

    assertEquals(0, countById("test_case", testCaseId), "test_case row removed");
    assertEquals(0, countRelationshipRows(testCaseId), "all entity_relationship rows removed");
  }

  @Test
  void recursiveServiceHardDelete_withBrokenSuiteChain_sweepsResidualTestCase(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = createDatabaseService(ns);
    Table table = createTable(ns, "resid", service.getFullyQualifiedName());
    TestCase testCase = createSystemTestCase(table, "residCase_" + ns.uniqueShortId());
    UUID testCaseId = testCase.getId();

    // Break the table -> basic suite -> test case CONTAINS chain the cascade walks, leaving the
    // test case reachable only through its entityLink. This is the state TableRepository's residual
    // sweep exists for: legacy data, an earlier partial-failure cascade, or a test case linked only
    // to a logical suite. Drop the suite -> case edge rather than the table -> suite edge so the
    // cascade still reaps the basic suite and never leaves one whose table is gone — that state
    // breaks concurrent GET /testSuites listings.
    Entity.getCollectionDAO()
        .relationshipDAO()
        .deleteTo(testCaseId, Entity.TEST_CASE, Relationship.CONTAINS.ordinal(), Entity.TEST_SUITE);

    client
        .databaseServices()
        .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    // Pre-fix the bulk path looped the no-arg entitySpecificCleanup overload while TableRepository
    // overrides only the deletedBy-aware one, so this residual test case outlived the cascade and
    // every later Data Quality listing that happened to include it answered 404.
    // The cascade runs inside the DELETE request, but poll briefly rather than asserting straight
    // through: BaseServiceIT's shared regression treats service subtree deletion as asynchronous.
    Awaitility.await("residual test case swept by the recursive service cascade")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> assertEquals(0, countById("test_case", testCaseId), "test_case row removed"));
    assertEquals(0, countRelationshipRows(testCaseId), "all entity_relationship rows removed");
  }

  @Test
  void deleteTestDefinition_nonRecursive_blockedWithDependentCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestDefinition testDefinition = createCustomTableTestDefinition(ns);
    Table table = createTable(ns, "tdBlock");
    createCustomTestCase(
        table, "tdBlockCase_" + ns.uniqueShortId(), testDefinition.getFullyQualifiedName());

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> client.testDefinitions().delete(testDefinition.getId().toString()));

    assertEquals(400, error.getStatusCode());
    assertTrue(error.getMessage().contains("depend on it"), error.getMessage());
    assertTrue(error.getMessage().contains("1 test case"), error.getMessage());
    assertTrue(error.getMessage().contains("recursive=true"), error.getMessage());

    assertNotNull(
        client.testDefinitions().get(testDefinition.getId().toString()),
        "test definition must survive a blocked non-recursive delete");
  }

  @Test
  void deleteTestDefinition_withSoftDeletedDependentTestCase_stillBlocked(TestNamespace ns) {
    // A soft-deleted test case still references its definition and would be hard-deleted by a
    // recursive delete, so it intentionally still counts toward the dependent guard. The count
    // reflects the recursive-delete blast radius, matching what EntityRepository.deleteChildren
    // would cascade — filtering it to only live test cases would desync the guard from the cascade.
    OpenMetadataClient client = SdkClients.adminClient();
    TestDefinition testDefinition = createCustomTableTestDefinition(ns);
    Table table = createTable(ns, "tdSoft");
    TestCase testCase =
        createCustomTestCase(
            table, "tdSoftCase_" + ns.uniqueShortId(), testDefinition.getFullyQualifiedName());
    client.testCases().delete(testCase.getId().toString()); // soft delete

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> client.testDefinitions().delete(testDefinition.getId().toString()));

    assertEquals(400, error.getStatusCode());
    assertTrue(error.getMessage().contains("1 test case"), error.getMessage());
  }

  @Test
  void deleteTestDefinition_recursive_cascadeDeletesTestCases(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestDefinition testDefinition = createCustomTableTestDefinition(ns);
    Table table = createTable(ns, "tdCascade");
    TestCase testCase =
        createCustomTestCase(
            table, "tdCascadeCase_" + ns.uniqueShortId(), testDefinition.getFullyQualifiedName());
    UUID testCaseId = testCase.getId();

    client
        .testDefinitions()
        .delete(
            testDefinition.getId().toString(), Map.of("recursive", "true", "hardDelete", "true"));

    assertEquals(
        0, countById("test_definition", testDefinition.getId()), "test definition removed");
    assertEquals(0, countById("test_case", testCaseId), "dependent test case cascade-deleted");
  }

  private Table createTable(TestNamespace ns, String prefix) {
    return createTable(ns, prefix, SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName());
  }

  private Table createTable(TestNamespace ns, String prefix, String serviceFqn) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(new CreateDatabase().withName(prefix + "Db_" + id).withService(serviceFqn));
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

  private DatabaseService createDatabaseService(TestNamespace ns) {
    MysqlConnection connection =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test")
            .withAuthType(new basicAuth().withPassword("test"));
    return SdkClients.adminClient()
        .databaseServices()
        .create(
            new CreateDatabaseService()
                .withName(ns.prefix("residSvc"))
                .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
                .withConnection(new DatabaseConnection().withConfig(connection)));
  }

  private TestCase createSystemTestCase(Table table, String name) {
    OpenMetadataClient client = SdkClients.adminClient();
    String testDefFqn =
        client
            .testDefinitions()
            .list(new ListParams().withLimit(1))
            .getData()
            .get(0)
            .getFullyQualifiedName();
    return client
        .testCases()
        .create(
            new CreateTestCase()
                .withName(name)
                .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
                .withTestDefinition(testDefFqn));
  }

  private TestCase createCustomTestCase(Table table, String name, String testDefinitionFqn) {
    return SdkClients.adminClient()
        .testCases()
        .create(
            new CreateTestCase()
                .withName(name)
                .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                .withTestDefinition(testDefinitionFqn));
  }

  private TestDefinition createCustomTableTestDefinition(TestNamespace ns) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("delTestDef"));
    request.setDescription("Custom table test definition for delete-path tests");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));
    return SdkClients.adminClient().testDefinitions().create(request);
  }

  private void insertTestCaseResult(String testCaseFqn) {
    // The data_quality_data_time_series.id column is derived from json -> '$.id', so the seeded
    // result must carry an id (the repository assigns one on the normal create path).
    String json =
        String.format(
            "{\"id\":\"%s\",\"timestamp\":%d,\"testCaseStatus\":\"Success\",\"result\":\"ok\"}",
            UUID.randomUUID(), System.currentTimeMillis());
    Entity.getCollectionDAO()
        .dataQualityDataTimeSeriesDao()
        .insert(
            testCaseFqn,
            TestCaseResultRepository.TESTCASE_RESULT_EXTENSION,
            "testCaseResult",
            json,
            null);
  }

  private int countTestDefinitionEdges(UUID testCaseId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM entity_relationship WHERE toId = :id "
                            + "AND toEntity = 'testCase' AND fromEntity = 'testDefinition' "
                            + "AND relation = :rel")
                    .bind("id", testCaseId.toString())
                    .bind("rel", Relationship.CONTAINS.ordinal())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countRelationshipRows(UUID testCaseId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM entity_relationship WHERE toId = :id OR fromId = :id")
                    .bind("id", testCaseId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countById(String table, UUID id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countByFqnHash(String table, String fqn) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE entityFQNHash = :h")
                    .bind("h", FullyQualifiedName.buildHash(fqn))
                    .mapTo(Integer.class)
                    .one());
  }
}
