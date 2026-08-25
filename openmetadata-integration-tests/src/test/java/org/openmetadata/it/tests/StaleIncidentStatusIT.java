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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
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
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseResolutionStatusRepository;

/**
 * Regression tests for stale {@code testCaseResolutionStatus} incident state.
 *
 * <p>A {@code testCaseResolutionStatus} row whose {@code parentOf} relationship to its test case is
 * missing made {@code GET /dataQuality/testCases/testCaseIncidentStatus/stateId/{stateId}} fail with
 * {@code EntityRelationshipNotFoundException}, and deleting the rows left both the relationship and
 * the stale {@code incidentId} on the test case behind.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class StaleIncidentStatusIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @Test
  void deleteByIdRemovesParentRelationship(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "delRel");
    TestCase testCase = createTestCase(table, "delRelCase_" + ns.uniqueShortId());

    TestCaseResolutionStatus status =
        client
            .testCaseResolutionStatuses()
            .create(
                new CreateTestCaseResolutionStatus()
                    .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
                    .withTestCaseReference(testCase.getFullyQualifiedName()));
    assertNotNull(status.getId());
    assertEquals(1, countRelationshipsTo(status.getId()), "parentOf relationship should exist");

    resolutionStatusRepository().deleteById(status.getId(), true);

    assertEquals(
        0,
        countRowsById("test_case_resolution_status_time_series", status.getId().toString()),
        "time series row should be deleted");
    assertEquals(
        0,
        countRelationshipsTo(status.getId()),
        "parentOf relationship must be deleted with the row, otherwise it is left orphaned");
  }

  @Test
  void stateIdEndpointSkipsOrphanedRows(TestNamespace ns) throws Exception {
    Table table = createTable(ns, "stateId");
    TestCase testCase = createTestCase(table, "stateIdCase_" + ns.uniqueShortId());

    UUID stateId = createIncident(testCase);
    orphanResolutionStatusRows(stateId);

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/" + stateId,
                null,
                RequestOptions.builder().build());

    JsonNode data = readData(response);
    assertEquals(
        0,
        data.size(),
        "every row for this stateId is orphaned, so all must be skipped rather than 500: "
            + response);
  }

  /**
   * The guard added for orphaned rows must not swallow healthy ones: a valid incident still has to
   * come back with its parent test case resolved.
   */
  @Test
  void stateIdEndpointReturnsHealthyIncident(TestNamespace ns) throws Exception {
    Table table = createTable(ns, "healthy");
    TestCase testCase = createTestCase(table, "healthyCase_" + ns.uniqueShortId());

    UUID stateId = createIncident(testCase);

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/" + stateId,
                null,
                RequestOptions.builder().build());

    JsonNode data = readData(response);
    assertTrue(data.size() >= 1, "a healthy incident must return its rows, got: " + response);
    JsonNode testCaseReference = data.get(0).get("testCaseReference");
    assertNotNull(testCaseReference, "testCaseReference must be resolved for healthy rows");
    assertEquals(
        testCase.getId().toString(),
        testCaseReference.get("id").asText(),
        "testCaseReference must point at the owning test case");
  }

  @Test
  void softDeleteLeavesRowAndRelationshipIntact(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "softDel");
    TestCase testCase = createTestCase(table, "softDelCase_" + ns.uniqueShortId());

    TestCaseResolutionStatus status =
        client
            .testCaseResolutionStatuses()
            .create(
                new CreateTestCaseResolutionStatus()
                    .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
                    .withTestCaseReference(testCase.getFullyQualifiedName()));

    resolutionStatusRepository().deleteById(status.getId(), false);

    assertEquals(
        1,
        countRowsById("test_case_resolution_status_time_series", status.getId().toString()),
        "time series rows are immutable and must survive a soft delete");
    assertEquals(
        1, countRelationshipsTo(status.getId()), "soft delete must not touch the relationship");
  }

  @Test
  void deleteByIdIgnoresUnknownId() {
    resolutionStatusRepository().deleteById(UUID.randomUUID(), true);
  }

  private JsonNode readData(String response) throws Exception {
    assertNotNull(response, "endpoint must not fail");
    JsonNode data = MAPPER.readTree(response).get("data");
    assertNotNull(data, "expected a result list rather than an error, got: " + response);
    return data;
  }

  /** Creates a real incident by ingesting a failing result, and returns its stateId. */
  private UUID createIncident(TestCase testCase) {
    OpenMetadataClient client = SdkClients.adminClient();
    CreateTestCaseResult result =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withResult("Test failed");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result);

    TestCaseResolutionStatus latest =
        resolutionStatusRepository().getLatestRecord(testCase.getFullyQualifiedName());
    assertNotNull(latest, "a failing result should have opened an incident");
    assertNotNull(latest.getStateId());
    return latest.getStateId();
  }

  /** Simulates the production corruption: rows survive but lose their parentOf relationship. */
  private void orphanResolutionStatusRows(UUID stateId) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "DELETE FROM entity_relationship WHERE toEntity = 'testCaseResolutionStatus' "
                            + "AND toId IN (SELECT id FROM test_case_resolution_status_time_series "
                            + "WHERE stateId = :stateId)")
                    .bind("stateId", stateId.toString())
                    .execute());
  }

  private TestCaseResolutionStatusRepository resolutionStatusRepository() {
    return (TestCaseResolutionStatusRepository)
        Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESOLUTION_STATUS);
  }

  private int countRelationshipsTo(UUID toId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE toId = :id")
                    .bind("id", toId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countRowsById(String table, String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id)
                    .mapTo(Integer.class)
                    .one());
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
    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName(name)
            .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
            .withTestDefinition(testDefFqn);
    return client.testCases().create(createTestCase);
  }

  private Table createTable(TestNamespace ns, String prefix) throws Exception {
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
