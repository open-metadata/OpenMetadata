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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
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
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.OrphanTestCaseRelationshipCleanup;

/**
 * End-to-end test for {@link OrphanTestCaseRelationshipCleanup} (the Data Retention cleanup of test
 * cases whose core relationship rows are missing). Verifies that a test case whose
 * {@code testCase -> testDefinition} relationship row is deleted is itself hard-deleted AND its
 * {@code testCaseResult} time-series rows are removed, while a healthy test case (and its results)
 * is left untouched — the cleanup is selective, not a blanket wipe.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseRelationshipRetentionCleanupIT {

  private static final int BATCH = 10_000;
  private static final String RESULT_EXTENSION = "testCase.testCaseResult";

  @Test
  void missingTestDefinition_deletesTestCaseAndResults_keepsHealthy(TestNamespace ns)
      throws Exception {
    Table table = createTable(ns);

    TestCase healthy = createTestCase(table, "healthy_" + ns.uniqueShortId());
    TestCase broken = createTestCase(table, "broken_" + ns.uniqueShortId());
    seedResult(healthy.getFullyQualifiedName());
    seedResult(broken.getFullyQualifiedName());

    // Both have results to start with.
    assertTrue(resultRowCount(broken.getFullyQualifiedName()) >= 1, "broken should have a result");
    assertTrue(
        resultRowCount(healthy.getFullyQualifiedName()) >= 1, "healthy should have a result");

    // Break the broken test case: remove its testDefinition relationship row (leaving the
    // testDefinition entity intact) — the exact data-drift state the cleanup targets.
    Entity.getCollectionDAO()
        .relationshipDAO()
        .deleteTo(
            broken.getId(),
            Entity.TEST_CASE,
            Relationship.CONTAINS.ordinal(),
            Entity.TEST_DEFINITION);

    OrphanTestCaseRelationshipCleanup.Result result =
        new OrphanTestCaseRelationshipCleanup(Entity.getCollectionDAO(), false)
            .performCleanup(BATCH);

    assertTrue(
        result.getMissingTestDefinitionDeleted() >= 1,
        "the broken test case must be counted as missing-test-definition");

    // Broken test case and its results are gone.
    assertEquals(
        0, testCaseRowCount(broken.getId().toString()), "broken test case must be deleted");
    assertEquals(
        0,
        resultRowCount(broken.getFullyQualifiedName()),
        "broken test case's results must be cascaded away");

    // Healthy test case and its results survive — the cleanup is selective.
    assertEquals(1, testCaseRowCount(healthy.getId().toString()), "healthy test case must survive");
    assertTrue(
        resultRowCount(healthy.getFullyQualifiedName()) >= 1,
        "healthy test case's results survive");
  }

  private Table createTable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName("tcrelDb_" + id)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("tcrelSc_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName("tcrelTb_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private TestCase createTestCase(Table table, String name) throws Exception {
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

  private void seedResult(String testCaseFqn) {
    SdkClients.adminClient()
        .testCaseResults()
        .create(
            testCaseFqn,
            new CreateTestCaseResult()
                .withTimestamp(System.currentTimeMillis())
                .withTestCaseStatus(TestCaseStatus.Failed)
                .withResult("seeded for retention cleanup test"));
  }

  private int testCaseRowCount(String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM test_case WHERE id = :id")
                    .bind("id", id)
                    .mapTo(Integer.class)
                    .one());
  }

  private int resultRowCount(String testCaseFqn) {
    String fqnHash = FullyQualifiedName.buildHash(testCaseFqn);
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM data_quality_data_time_series "
                            + "WHERE entityFQNHash = :h AND extension = :ext")
                    .bind("h", fqnHash)
                    .bind("ext", RESULT_EXTENSION)
                    .mapTo(Integer.class)
                    .one());
  }
}
