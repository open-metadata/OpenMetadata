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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Regression for issue #28229: certification changes on a {@link Table} must propagate to every
 * denormalized child search doc (test_case, test_case_result, test_case_resolution_status,
 * test_suite, column) — including the cert-only PATCH path that was previously silently broken by
 * a bad propagation script.
 *
 * <p>The cascade is declarative: {@code TableRepository} registers {@code certification} as {@link
 * org.openmetadata.service.search.PropagationDescriptor.PropagationType#RAW_REPLACE}, the gate in
 * {@code SearchRepository.updateEntityIndex} opens for the cert field, and {@code
 * propagateInheritedFieldsToChildren} emits an {@code update_by_query} with {@code Refresh.True}
 * against the table's child aliases. Because {@code SearchIndexHandler.isAsync()} returns {@code
 * false} and the {@code update_by_query} uses {@code wait_for_completion=true}, the change is
 * visible in ES the moment the PATCH HTTP response returns. The test therefore asserts
 * synchronously — no Awaitility, no polling — and any future regression that re-introduces a race
 * fails the test deterministically.
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TableCertificationPropagationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String CERTIFICATION_SILVER = "Certification.Silver";

  @Test
  void certLifecycle_cascadesToTestCaseAndOwnSearchDoc() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    long ts = System.currentTimeMillis();
    Database database = null;
    try {
      database = createDatabase(client, "cert_prop_db_" + ts);
      DatabaseSchema schema = createSchema(client, database, "cert_prop_schema_" + ts);
      Table table = createTable(client, schema, "cert_prop_table_" + ts);

      long now = System.currentTimeMillis();
      long expiry = now + Duration.ofDays(30).toMillis();

      table.setCertification(buildCertification(CERTIFICATION_GOLD, now, expiry));
      table = client.tables().update(table.getId().toString(), table);

      TestCase testCase = createTestCase(client, table, "cert_prop_tc_" + ts);

      assertTestCaseCertification(client, testCase.getFullyQualifiedName(), CERTIFICATION_GOLD);
      assertTableCertification(client, table.getId().toString(), CERTIFICATION_GOLD);

      table = client.tables().get(table.getId().toString(), "certification");
      table.setCertification(buildCertification(CERTIFICATION_SILVER, now, expiry));
      client.tables().update(table.getId().toString(), table);

      assertTestCaseCertification(client, testCase.getFullyQualifiedName(), CERTIFICATION_SILVER);
      assertTableCertification(client, table.getId().toString(), CERTIFICATION_SILVER);

      table = client.tables().get(table.getId().toString(), "certification");
      table.setCertification(null);
      client.tables().update(table.getId().toString(), table);

      assertTestCaseCertificationAbsent(client, testCase.getFullyQualifiedName());
      assertTableCertificationAbsent(client, table.getId().toString());
    } finally {
      hardDelete(client, database);
    }
  }

  @Test
  void certOnlyPatch_isObservableImmediatelyAfterPatchReturns() throws Exception {
    // Regression for the specific failure mode in #28229 / #28236: a PATCH that mutates *only*
    // certification (no other fields) must observably update both the table doc and every child
    // doc by the time the PATCH response is received. Pre-fix, the descriptor-driven script was
    // malformed for cert-only changes and the cascade was silently aborted by the outer catch.
    OpenMetadataClient client = SdkClients.adminClient();
    long ts = System.currentTimeMillis();
    Database database = null;
    try {
      database = createDatabase(client, "cert_only_db_" + ts);
      DatabaseSchema schema = createSchema(client, database, "cert_only_schema_" + ts);
      Table table = createTable(client, schema, "cert_only_table_" + ts);
      TestCase testCase = createTestCase(client, table, "cert_only_tc_" + ts);

      long now = System.currentTimeMillis();
      long expiry = now + Duration.ofDays(30).toMillis();
      table.setCertification(buildCertification(CERTIFICATION_GOLD, now, expiry));
      client.tables().update(table.getId().toString(), table);

      assertTableCertification(client, table.getId().toString(), CERTIFICATION_GOLD);
      assertTestCaseCertification(client, testCase.getFullyQualifiedName(), CERTIFICATION_GOLD);
    } finally {
      hardDelete(client, database);
    }
  }

  private static Database createDatabase(OpenMetadataClient client, String name) {
    return client
        .databases()
        .create(
            new CreateDatabase()
                .withName(name)
                .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
  }

  private static DatabaseSchema createSchema(
      OpenMetadataClient client, Database database, String name) {
    return client
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(name)
                .withDatabase(database.getFullyQualifiedName()));
  }

  private static Table createTable(OpenMetadataClient client, DatabaseSchema schema, String name) {
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static TestCase createTestCase(OpenMetadataClient client, Table table, String name) {
    return client
        .testCases()
        .create(
            new CreateTestCase()
                .withName(name)
                .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                .withTestDefinition("tableRowCountToEqual")
                .withParameterValues(
                    List.of(new TestCaseParameterValue().withName("value").withValue("100"))));
  }

  private static void assertTestCaseCertification(
      OpenMetadataClient client, String testCaseFqn, String expectedFqn) throws Exception {
    JsonNode certFqn = fetchTestCaseCertificationFqn(client, testCaseFqn);
    assertEquals(
        expectedFqn,
        certFqn.asText(),
        () -> "test_case search doc certification mismatch; doc cert was: " + certFqn);
  }

  private static void assertTestCaseCertificationAbsent(
      OpenMetadataClient client, String testCaseFqn) throws Exception {
    JsonNode source = fetchTestCaseSource(client, testCaseFqn);
    JsonNode cert = source.path("certification");
    assertTrue(
        cert.isMissingNode() || cert.isNull(),
        () -> "test_case search doc still carries certification: " + cert);
  }

  private static void assertTableCertification(
      OpenMetadataClient client, String tableId, String expectedFqn) throws Exception {
    JsonNode source = fetchTableSource(client, tableId);
    JsonNode certFqn = source.path("certification").path("tagLabel").path("tagFQN");
    assertEquals(
        expectedFqn,
        certFqn.asText(),
        () ->
            "table search doc certification mismatch; doc cert was: "
                + source.path("certification"));
  }

  private static void assertTableCertificationAbsent(OpenMetadataClient client, String tableId)
      throws Exception {
    JsonNode source = fetchTableSource(client, tableId);
    JsonNode cert = source.path("certification");
    assertTrue(
        cert.isMissingNode() || cert.isNull(),
        () -> "table search doc still carries certification: " + cert);
  }

  private static JsonNode fetchTestCaseCertificationFqn(
      OpenMetadataClient client, String testCaseFqn) throws Exception {
    return fetchTestCaseSource(client, testCaseFqn)
        .path("certification")
        .path("tagLabel")
        .path("tagFQN");
  }

  private static JsonNode fetchTestCaseSource(OpenMetadataClient client, String testCaseFqn)
      throws Exception {
    return fetchFirstHitSource(
        client,
        "test_case_search_index",
        "fullyQualifiedName.keyword:\"" + testCaseFqn + "\"",
        () -> "test case " + testCaseFqn + " not indexed");
  }

  private static JsonNode fetchTableSource(OpenMetadataClient client, String tableId)
      throws Exception {
    return fetchFirstHitSource(
        client, "table_search_index", "id:" + tableId, () -> "table " + tableId + " not indexed");
  }

  private static JsonNode fetchFirstHitSource(
      OpenMetadataClient client,
      String index,
      String query,
      java.util.function.Supplier<String> notFoundMessage)
      throws Exception {
    String rawJson = client.search().query(query).index(index).size(1).execute();
    JsonNode hits = MAPPER.readTree(rawJson).path("hits").path("hits");
    assertNotNull(hits, "search response missing hits for query: " + query);
    assertTrue(hits.isArray() && hits.size() > 0, notFoundMessage::get);
    return hits.get(0).path("_source");
  }

  private static AssetCertification buildCertification(String fqn, long appliedDate, long expiry) {
    return new AssetCertification()
        .withTagLabel(
            new TagLabel()
                .withTagFQN(fqn)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL))
        .withAppliedDate(appliedDate)
        .withExpiryDate(expiry);
  }

  private static void hardDelete(OpenMetadataClient client, Database database) {
    if (database == null) return;
    try {
      client
          .databases()
          .delete(database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    } catch (Exception ignored) {
      // best-effort cleanup; assertion failures take precedence
    }
  }
}
