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

import static org.awaitility.Awaitility.await;
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
 * Regression for the Table certification cascade bug (issue #28229). When a Table's certification
 * is added, changed, or removed via PATCH, the existing {@code cascadeCertificationToChildren} path
 * in {@code SearchRepository} must propagate the new cert onto every denormalized child search doc
 * (test_case, test_case_result, test_case_resolution_status, test_suite).
 *
 * <p>Without the fix on {@code TableRepository.getSearchPropagationDescriptors}, the
 * {@code requiresPropagation} gate in {@code SearchRepository.updateEntityIndex} returns
 * {@code false} on a cert-only ChangeDescription, the cascade never fires, and the Data Quality
 * dashboard's Certification filter keeps returning the stale cert until a full reindex.
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TableCertificationPropagationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String CERTIFICATION_SILVER = "Certification.Silver";
  private static final Duration AWAIT_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void certChangeOnTable_cascadesToTestCaseSearchDoc() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    long ts = System.currentTimeMillis();
    Database database = null;
    try {
      database =
          client
              .databases()
              .create(
                  new CreateDatabase()
                      .withName("cert_prop_db_" + ts)
                      .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
      DatabaseSchema schema =
          client
              .databaseSchemas()
              .create(
                  new CreateDatabaseSchema()
                      .withName("cert_prop_schema_" + ts)
                      .withDatabase(database.getFullyQualifiedName()));
      Table table =
          client
              .tables()
              .create(
                  new CreateTable()
                      .withName("cert_prop_table_" + ts)
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withColumns(
                          List.of(
                              new Column().withName("id").withDataType(ColumnDataType.BIGINT))));

      long now = System.currentTimeMillis();
      long expiry = now + Duration.ofDays(30).toMillis();
      table.setCertification(buildCertification(CERTIFICATION_GOLD, now, expiry));
      client.tables().update(table.getId().toString(), table);

      TestCase testCase =
          client
              .testCases()
              .create(
                  new CreateTestCase()
                      .withName("cert_prop_tc_" + ts)
                      .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                      .withTestDefinition("tableRowCountToEqual")
                      .withParameterValues(
                          List.of(
                              new TestCaseParameterValue().withName("value").withValue("100"))));

      awaitTestCaseCertification(client, testCase.getFullyQualifiedName(), CERTIFICATION_GOLD);

      table = client.tables().get(table.getId().toString(), "certification");
      table.setCertification(buildCertification(CERTIFICATION_SILVER, now, expiry));
      client.tables().update(table.getId().toString(), table);

      awaitTestCaseCertification(client, testCase.getFullyQualifiedName(), CERTIFICATION_SILVER);

      table = client.tables().get(table.getId().toString(), "certification");
      table.setCertification(null);
      client.tables().update(table.getId().toString(), table);

      awaitTestCaseCertificationAbsent(client, testCase.getFullyQualifiedName());
    } finally {
      if (database != null) {
        try {
          client
              .databases()
              .delete(
                  database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
        } catch (Exception ignored) {
          // best-effort cleanup; assertion failures take precedence
        }
      }
    }
  }

  private static void awaitTestCaseCertification(
      OpenMetadataClient client, String testCaseFqn, String expectedFqn) {
    await("test_case_search_index reflects cert " + expectedFqn + " for " + testCaseFqn)
        .atMost(AWAIT_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode src = fetchTestCaseSource(client, testCaseFqn);
              JsonNode certFqn = src.path("certification").path("tagLabel").path("tagFQN");
              assertEquals(
                  expectedFqn,
                  certFqn.asText(),
                  () ->
                      "test_case search doc certification mismatch; cert was: "
                          + src.path("certification"));
            });
  }

  private static void awaitTestCaseCertificationAbsent(
      OpenMetadataClient client, String testCaseFqn) {
    await("test_case_search_index has no certification for " + testCaseFqn)
        .atMost(AWAIT_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode src = fetchTestCaseSource(client, testCaseFqn);
              JsonNode cert = src.path("certification");
              assertTrue(
                  cert.isMissingNode() || cert.isNull(),
                  () -> "test_case search doc still carries certification: " + cert);
            });
  }

  private static JsonNode fetchTestCaseSource(OpenMetadataClient client, String testCaseFqn)
      throws Exception {
    String rawJson =
        client
            .search()
            .query("fullyQualifiedName.keyword:\"" + testCaseFqn + "\"")
            .index("test_case_search_index")
            .size(1)
            .execute();
    JsonNode root = MAPPER.readTree(rawJson);
    JsonNode hits = root.path("hits").path("hits");
    assertNotNull(hits, "search response missing hits");
    assertTrue(
        hits.isArray() && hits.size() > 0,
        () -> "test case " + testCaseFqn + " not yet indexed; raw=" + rawJson);
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
}
