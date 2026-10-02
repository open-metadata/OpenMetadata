/*
 *  Copyright 2021 Collate
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.LineageAPI;
import org.openmetadata.sdk.fluent.OpenLineage;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.wrappers.FluentTable;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for OpenLineage → lineage resolution.
 *
 * <p>Verifies that OL COMPLETE events with input/output datasets are resolved to existing OM table
 * entities and lineage edges are created with source=OpenLineage.
 *
 * <p>Creates its own test entities (service, database, schema, tables) to avoid depending on sample
 * data being loaded externally.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class OpenLineageLineageResolutionIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String OPEN_LINEAGE_SETTINGS_TYPE = "openLineageSettings";
  private static final List<Column> DEFAULT_COLUMNS =
      List.of(
          new Column().withName("id").withDataType(ColumnDataType.BIGINT),
          new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

  private static final String EVENT_TIME = "2024-01-15T10:00:00Z";
  private static final long EVENT_TIME_MS = 1705312800000L;
  private static final List<Map<String, Object>> FIELDS =
      List.of(Map.of("name", "id", "type", "bigint"), Map.of("name", "name", "type", "string"));

  private static String srcFqn;
  private static String tgtFqn;
  private static String serviceName;
  private static String schemaFqn;

  @BeforeAll
  static void setup() {
    OpenLineage.setDefaultClient(SdkClients.adminClient());
    Tables.setDefaultClient(SdkClients.adminClient());
    LineageAPI.setDefaultClient(SdkClients.adminClient());
    DatabaseServices.setDefaultClient(SdkClients.adminClient());
    Databases.setDefaultClient(SdkClients.adminClient());
    DatabaseSchemas.setDefaultClient(SdkClients.adminClient());

    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    serviceName = "ol_test_svc_" + uniqueId;

    DatabaseService service =
        DatabaseServices.builder()
            .name(serviceName)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Test service for OpenLineage resolution tests")
            .create();

    Database db =
        Databases.create().name("ecommerce_db").in(service.getFullyQualifiedName()).execute();

    DatabaseSchema schema =
        DatabaseSchemas.create().name("shopify").in(db.getFullyQualifiedName()).execute();

    schemaFqn = schema.getFullyQualifiedName();

    Table rawOrder =
        Tables.create()
            .name("raw_order")
            .inSchema(schemaFqn)
            .withColumns(DEFAULT_COLUMNS)
            .execute();
    srcFqn = rawOrder.getFullyQualifiedName();

    Table factOrder =
        Tables.create()
            .name("fact_order")
            .inSchema(schemaFqn)
            .withColumns(DEFAULT_COLUMNS)
            .execute();
    tgtFqn = factOrder.getFullyQualifiedName();

    Tables.create().name("raw_customer").inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    Tables.create().name("dim_address").inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
  }

  @Test
  @Order(1)
  void testSampleDataTablesExist() {
    FluentTable src = Tables.findByName(srcFqn).fetch();
    assertNotNull(src, "Source table " + srcFqn + " must exist");

    FluentTable tgt = Tables.findByName(tgtFqn).fetch();
    assertNotNull(tgt, "Target table " + tgtFqn + " must exist");
  }

  @Test
  @Order(2)
  void testCompleteEventCreatesLineageEdge(TestNamespace ns) throws Exception {
    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("ol_resolution_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput("ecommerce_db.shopify.raw_order", serviceName)
            .addOutput("ecommerce_db.shopify.fact_order", serviceName)
            .send();

    assertNotNull(response);
    JsonNode json = MAPPER.readTree(response);
    assertEquals("success", json.get("status").asText());
    assertTrue(
        json.get("lineageEdgesCreated").asInt() >= 1,
        "Expected at least 1 lineage edge created, got: " + response);
  }

  @Test
  @Order(3)
  @SuppressWarnings("unchecked")
  void testLineageEdgeHasOpenLineageSource() throws Exception {
    LineageAPI.LineageGraph lineageGraph =
        LineageAPI.forName$("table", srcFqn).upstream(0).downstream(3).fetch();

    assertNotNull(lineageGraph);
    Map<String, Object> lineage = MAPPER.readValue(lineageGraph.getRaw(), Map.class);
    var downstreamEdges = (java.util.List<?>) lineage.get("downstreamEdges");
    assertNotNull(downstreamEdges, "Expected downstream edges from " + srcFqn);

    boolean hasOlEdge =
        downstreamEdges.stream()
            .map(e -> (Map<?, ?>) e)
            .map(e -> (Map<?, ?>) e.get("lineageDetails"))
            .filter(java.util.Objects::nonNull)
            .anyMatch(details -> "OpenLineage".equals(details.get("source")));

    assertTrue(hasOlEdge, "Expected at least one edge with source=OpenLineage");
  }

  @Test
  @Order(4)
  void testStartEventDoesNotCreateEdges(TestNamespace ns) throws Exception {
    String response =
        OpenLineage.event()
            .withEventType("START")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("start_only_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput("ecommerce_db.shopify.raw_order", serviceName)
            .addOutput("ecommerce_db.shopify.fact_order", serviceName)
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertEquals(
        0, json.get("lineageEdgesCreated").asInt(), "START events should not create lineage edges");
  }

  @Test
  @Order(5)
  void testUnresolvableDatasetsAreRejected(TestNamespace ns) throws Exception {
    JsonNode response =
        sendExpectingRejection(
            OpenLineage.event()
                .withEventType("COMPLETE")
                .withEventTime(Instant.now().toString())
                .withJob(ns.prefix("unknown_job"), ns.prefix("namespace"))
                .withRun(UUID.randomUUID().toString())
                .addInput("nonexistent_schema.nonexistent_table", "nonexistent_service")
                .addOutput("nonexistent_schema.nonexistent_output", "nonexistent_service"));

    assertEquals(
        0, response.get("lineageEdgesCreated").asInt(), "Unresolvable datasets create 0 edges");
    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(2, unresolved.size(), response.toString());
    unresolved.forEach(
        dataset -> assertEquals("namespaceNotMapped", dataset.get("reason").asText()));
  }

  @Test
  @Order(6)
  void testMultiInputOutputCreatesAllEdges(TestNamespace ns) throws Exception {
    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("multi_io_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput("ecommerce_db.shopify.raw_order", serviceName)
            .addInput("ecommerce_db.shopify.raw_customer", serviceName)
            .addOutput("ecommerce_db.shopify.dim_address", serviceName)
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertTrue(
        json.get("lineageEdgesCreated").asInt() >= 2,
        "2 inputs → 1 output should create at least 2 edges, got: " + response);
  }

  @Test
  @Order(7)
  void testEmptyInputsOutputsCreateNoEdges(TestNamespace ns) throws Exception {
    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("empty_io_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertEquals(
        0, json.get("lineageEdgesCreated").asInt(), "Empty inputs/outputs should create 0 edges");
  }

  // ====================================================================================
  // §7 OpenLineage eventTime → createdAt/updatedAt tests
  // ====================================================================================

  @Test
  @Order(8)
  void eventTime_populatesCreatedAtAndUpdatedAt(TestNamespace ns) throws Exception {
    String inputName = "ol_temporal_input_first_" + uniqueSuffix();
    String outputName = "ol_temporal_output_first_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    long eventTimeMs = 1705312800000L;
    sendCompleteEvent(ns, "ol_first_event_job", inputName, outputName, "2024-01-15T10:00:00Z");

    Map<?, ?> details = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(details, "Edge with source=OpenLineage should exist");
    assertEquals(eventTimeMs, ((Number) details.get("createdAt")).longValue());
    assertEquals(eventTimeMs, ((Number) details.get("updatedAt")).longValue());
    assertEquals("openlineage", details.get("createdBy"));
    assertEquals("openlineage", details.get("updatedBy"));
    assertEquals("OpenLineage", details.get("source"));
  }

  @Test
  @Order(9)
  void subsequentEvents_advanceUpdatedAt_preserveCreatedAt(TestNamespace ns) throws Exception {
    String inputName = "ol_temporal_input_subseq_" + uniqueSuffix();
    String outputName = "ol_temporal_output_subseq_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    long januaryMs = 1705312800000L;
    long februaryMs = 1707991200000L;
    sendCompleteEvent(ns, "ol_subseq_job_1", inputName, outputName, "2024-01-15T10:00:00Z");
    sendCompleteEvent(ns, "ol_subseq_job_2", inputName, outputName, "2024-02-15T10:00:00Z");

    Map<?, ?> details = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(details);
    assertEquals(
        januaryMs,
        ((Number) details.get("createdAt")).longValue(),
        "createdAt should preserve the first event's timestamp");
    assertEquals(
        februaryMs,
        ((Number) details.get("updatedAt")).longValue(),
        "updatedAt should advance to the latest event's timestamp");
  }

  @Test
  @Order(10)
  void outOfOrderEvents_applyMinMax(TestNamespace ns) throws Exception {
    String inputName = "ol_temporal_input_ooo_" + uniqueSuffix();
    String outputName = "ol_temporal_output_ooo_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    long marchMs = 1709251200000L;
    long januaryMs = 1704067200000L;
    long februaryMs = 1707955200000L;

    sendCompleteEvent(ns, "ol_ooo_job_march", inputName, outputName, "2024-03-01T00:00:00Z");
    sendCompleteEvent(ns, "ol_ooo_job_january", inputName, outputName, "2024-01-01T00:00:00Z");

    Map<?, ?> afterReplay = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(afterReplay);
    assertEquals(
        januaryMs,
        ((Number) afterReplay.get("createdAt")).longValue(),
        "createdAt should be minimized when an earlier event arrives");
    assertEquals(
        marchMs,
        ((Number) afterReplay.get("updatedAt")).longValue(),
        "updatedAt should be maximized — later event already seen, replay does not roll back");

    sendCompleteEvent(ns, "ol_ooo_job_middle", inputName, outputName, "2024-02-15T00:00:00Z");
    Map<?, ?> afterMiddle = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(afterMiddle);
    assertEquals(
        januaryMs,
        ((Number) afterMiddle.get("createdAt")).longValue(),
        "createdAt unchanged when middle event arrives");
    assertEquals(
        marchMs,
        ((Number) afterMiddle.get("updatedAt")).longValue(),
        "updatedAt unchanged when middle event arrives");
    assertTrue(
        februaryMs > januaryMs && februaryMs < marchMs,
        "Sanity: middle timestamp is between created and updated bounds");
  }

  @Test
  @Order(11)
  void olEventSource_taggedCorrectly(TestNamespace ns) throws Exception {
    String inputName = "ol_temporal_input_source_" + uniqueSuffix();
    String outputName = "ol_temporal_output_source_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    sendCompleteEvent(ns, "ol_source_tag_job", inputName, outputName, Instant.now().toString());

    Map<?, ?> details = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(details);
    assertEquals(
        "OpenLineage",
        details.get("source"),
        "OpenLineage-emitted edges must always carry source=OpenLineage");
    assertEquals("openlineage", details.get("createdBy"));
    assertEquals("openlineage", details.get("updatedBy"));
  }

  // ====================================================================================
  // §8 Catalog-platform identifier forms (Glue, Databricks, Hive warehouse paths)
  // ====================================================================================

  @Test
  @Order(12)
  void glueSymlinkForm_resolvesAndCreatesEdge(TestNamespace ns) throws Exception {
    String inputName = "ol_glue_input_" + uniqueSuffix();
    String outputName = "ol_glue_output_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    Map<String, Object> glueInput =
        Map.of(
            "namespace",
            "s3://it-test-bucket",
            "name",
            "warehouse/zone/shopify.db/" + inputName,
            "facets",
            Map.of(
                "symlinks",
                Map.of(
                    "identifiers",
                    List.of(
                        Map.of(
                            "namespace", "arn:aws:glue:us-west-2:123456789012",
                            "name", "table/shopify/" + inputName,
                            "type", "TABLE")))));

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("glue_symlink_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput(glueInput)
            .addOutput("ecommerce_db.shopify." + outputName, serviceName)
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertEquals("success", json.get("status").asText());
    assertTrue(
        json.get("lineageEdgesCreated").asInt() >= 1,
        "Glue-form symlink (table/db/table) should resolve and create an edge, got: " + response);

    Map<?, ?> details = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(details, "Edge resolved via Glue symlink should exist between the test tables");
  }

  @Test
  @Order(13)
  void hiveWarehousePathName_resolvesAndCreatesEdge(TestNamespace ns) throws Exception {
    String inputName = "ol_hivepath_input_" + uniqueSuffix();
    String outputName = "ol_hivepath_output_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    Map<String, Object> pathInput =
        Map.of(
            "namespace", "s3://it-test-bucket", "name", "warehouse/zone/shopify.db/" + inputName);

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("hive_path_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput(pathInput)
            .addOutput("ecommerce_db.shopify." + outputName, serviceName)
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertEquals("success", json.get("status").asText());
    assertTrue(
        json.get("lineageEdgesCreated").asInt() >= 1,
        "Hive warehouse path (.../<db>.db/<table>) should resolve without symlinks, got: "
            + response);

    Map<?, ?> details = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertNotNull(details, "Edge resolved via Hive warehouse path should exist");
  }

  @Test
  @Order(14)
  void glueSymlinkAccountId_prefersAccountScopedTable(TestNamespace ns) throws Exception {
    String accountId = "123456789012";
    String tableName = "ol_glue_acct_input_" + uniqueSuffix();
    String outputName = "ol_glue_acct_output_" + uniqueSuffix();

    // The Glue connector ingests the AWS account id as the OpenMetadata database, so the same
    // physical table can exist twice under one service: once account-scoped, once not.
    Database accountDb = Databases.create().name(accountId).in(serviceName).execute();
    DatabaseSchema accountSchema =
        DatabaseSchemas.create().name("shopify").in(accountDb.getFullyQualifiedName()).execute();
    String accountSchemaFqn = accountSchema.getFullyQualifiedName();

    Tables.create()
        .name(tableName)
        .inSchema(accountSchemaFqn)
        .withColumns(DEFAULT_COLUMNS)
        .execute();
    Tables.create().name(tableName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    Map<String, Object> glueInput =
        Map.of(
            "namespace",
            "s3://it-test-bucket",
            "name",
            "warehouse/zone/shopify.db/" + tableName,
            "facets",
            Map.of(
                "symlinks",
                Map.of(
                    "identifiers",
                    List.of(
                        Map.of(
                            "namespace", "arn:aws:glue:us-west-2:" + accountId,
                            "name", "table/shopify/" + tableName,
                            "type", "TABLE")))));

    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("glue_account_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput(glueInput)
            .addOutput("ecommerce_db.shopify." + outputName, serviceName)
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertEquals("success", json.get("status").asText());

    String outputFqn = schemaFqn + "." + outputName;
    assertNotNull(
        fetchOpenLineageEdgeDetailsByFqn(accountSchemaFqn + "." + tableName, outputFqn),
        "Edge must attach to the table under the account id carried by the Glue ARN namespace");
    assertNoOpenLineageEdge(
        schemaFqn + "." + tableName,
        outputFqn,
        "Edge must not attach to the same-named table in another database");
  }

  @Test
  @Order(15)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void bareTokenName_resolvesViaNamespaceMapping(TestNamespace ns) throws Exception {
    String tableName = "ol_baretoken_input_" + uniqueSuffix();
    String outputName = "ol_baretoken_output_" + uniqueSuffix();
    String eventNamespace = "s3://ol-baretoken-" + uniqueSuffix();

    Tables.create().name(tableName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    String previousSettings = readOpenLineageSettings();
    try {
      writeOpenLineageNamespaceMapping(eventNamespace, serviceName);

      // A single undelimited token: no dots, no slashes, no symlinks facet.
      Map<String, Object> bareInput = Map.of("namespace", eventNamespace, "name", tableName);

      String response =
          OpenLineage.event()
              .withEventType("COMPLETE")
              .withEventTime(Instant.now().toString())
              .withJob(ns.prefix("bare_token_job"), ns.prefix("namespace"))
              .withRun(UUID.randomUUID().toString())
              .addInput(bareInput)
              .addOutput("ecommerce_db.shopify." + outputName, serviceName)
              .send();

      JsonNode json = MAPPER.readTree(response);
      assertEquals("success", json.get("status").asText());
      assertTrue(
          json.get("lineageEdgesCreated").asInt() >= 1,
          "A bare token whose namespace maps to a service should resolve, got: " + response);

      assertNotNull(
          fetchOpenLineageEdgeDetails(tableName, outputName),
          "Edge resolved from a bare dataset name should exist between the test tables");
    } finally {
      restoreOpenLineageSettings(previousSettings);
    }
  }

  @Test
  @Order(16)
  void bareTokenNameWithoutMapping_isRejected(TestNamespace ns) throws Exception {
    String tableName = "ol_baretoken_unmapped_" + uniqueSuffix();
    String outputName = "ol_baretoken_unmapped_out_" + uniqueSuffix();
    Tables.create().name(tableName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    Map<String, Object> bareInput =
        Map.of("namespace", "s3://ol-unmapped-" + uniqueSuffix(), "name", tableName);

    JsonNode response =
        sendExpectingRejection(
            OpenLineage.event()
                .withEventType("COMPLETE")
                .withEventTime(Instant.now().toString())
                .withJob(ns.prefix("bare_token_unmapped_job"), ns.prefix("namespace"))
                .withRun(UUID.randomUUID().toString())
                .addInput(bareInput)
                .addOutput("ecommerce_db.shopify." + outputName, serviceName));

    assertEquals(
        0,
        response.get("lineageEdgesCreated").asInt(),
        "An unmapped bare token must not be matched against the whole catalog by table name");
    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals(tableName, unresolved.get(0).get("name").asText());
    assertEquals("unparsableName", unresolved.get(0).get("reason").asText());
  }

  // ====================================================================================
  // §9 Entities are only created under a mapped service, and never empty (#27548, #28860)
  // ====================================================================================

  @Test
  @Order(17)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void mappedNamespace_createsTheMissingTableWithItsColumns() throws Exception {
    String namespace = uniqueDatasetNamespace();
    String inputName = "ol_create_in_" + uniqueSuffix();
    String outputName = "ol_create_out_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    long notBefore = System.currentTimeMillis();

    JsonNode response =
        withOpenLineageSettings(
            autoCreateUnder(namespace),
            () ->
                send(
                    completeEvent("ol_create_ns", "ol_create_job_" + uniqueSuffix())
                        .addInput("ecommerce_db.shopify." + inputName, namespace)
                        .addOutput(
                            datasetWithColumns(namespace, "ecommerce_db.shopify." + outputName))));

    assertEquals("success", response.get("status").asText(), response.toString());
    assertEquals(1, response.get("lineageEdgesCreated").asInt());
    Table created =
        SdkClients.adminClient().tables().getByName(schemaFqn + "." + outputName, "columns");
    assertEquals(
        List.of("id", "name"), created.getColumns().stream().map(Column::getName).toList());
    assertEquals(
        List.of(ColumnDataType.BIGINT, ColumnDataType.STRING),
        created.getColumns().stream().map(Column::getDataType).toList());
    assertAuditFieldsStamped(created, notBefore);

    Map<?, ?> details = fetchOpenLineageEdgeDetails(inputName, outputName);
    assertEquals(EVENT_TIME_MS, ((Number) details.get("createdAt")).longValue());
    assertEquals(EVENT_TIME_MS, ((Number) details.get("updatedAt")).longValue());
    assertEquals("openlineage", details.get("createdBy"));
    assertEquals("openlineage", details.get("updatedBy"));
  }

  @Test
  @Order(18)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void mappedNamespace_createsTheMissingDatabaseSchemaAndTable() throws Exception {
    String namespace = uniqueDatasetNamespace();
    String suffix = uniqueSuffix();
    String database = "ol_new_db_" + suffix;
    String schema = "ol_new_schema_" + suffix;
    String table = "ol_new_table_" + suffix;
    String inputName = "ol_create_tree_in_" + suffix;
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    long notBefore = System.currentTimeMillis();

    JsonNode response =
        withOpenLineageSettings(
            autoCreateUnder(namespace),
            () ->
                send(
                    completeEvent("ol_create_ns", "ol_create_tree_job_" + suffix)
                        .addInput("ecommerce_db.shopify." + inputName, namespace)
                        .addOutput(
                            datasetWithColumns(namespace, database + "." + schema + "." + table))));

    assertEquals("success", response.get("status").asText(), response.toString());
    String databaseFqn = serviceName + "." + database;
    String schemaFqnCreated = databaseFqn + "." + schema;
    assertAuditFieldsStamped(
        SdkClients.adminClient().databases().getByName(databaseFqn), notBefore);
    assertAuditFieldsStamped(
        SdkClients.adminClient().databaseSchemas().getByName(schemaFqnCreated), notBefore);
    Table created =
        SdkClients.adminClient().tables().getByName(schemaFqnCreated + "." + table, "columns");
    assertEquals(2, created.getColumns().size());
    assertAuditFieldsStamped(created, notBefore);
    assertNotNull(
        fetchOpenLineageEdgeDetailsByFqn(
            schemaFqn + "." + inputName, created.getFullyQualifiedName()));
  }

  @Test
  @Order(19)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void mappedNamespaceWithoutColumns_isAPartialSuccessThatCreatesNothing() throws Exception {
    String namespace = uniqueDatasetNamespace();
    String inputName = "ol_partial_in_" + uniqueSuffix();
    String outputName = "ol_partial_out_" + uniqueSuffix();
    String missingName = "ol_partial_missing_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    JsonNode response =
        withOpenLineageSettings(
            autoCreateUnder(namespace),
            () ->
                send(
                    completeEvent("ol_partial_ns", "ol_partial_job_" + uniqueSuffix())
                        .addInput("ecommerce_db.shopify." + inputName, namespace)
                        .addOutput("ecommerce_db.shopify." + outputName, namespace)
                        .addOutput("ecommerce_db.shopify." + missingName, namespace)));

    assertEquals("partial_success", response.get("status").asText(), response.toString());
    assertEquals(1, response.get("lineageEdgesCreated").asInt());
    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals("ecommerce_db.shopify." + missingName, unresolved.get(0).get("name").asText());
    assertEquals("missingColumns", unresolved.get(0).get("reason").asText());
    assertNotFound(
        () -> SdkClients.adminClient().tables().getByName(schemaFqn + "." + missingName));
  }

  @Test
  @Order(20)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void unmappedNamespace_rejectsTheEventAndCreatesNothing() throws Exception {
    String inputName = "ol_unmapped_in_" + uniqueSuffix();
    String missingName = "ol_unmapped_missing_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    JsonNode response =
        withOpenLineageSettings(
            Map.of("autoCreateEntities", true),
            () ->
                sendExpectingRejection(
                    completeEvent("ol_unmapped_ns", "ol_unmapped_job_" + uniqueSuffix())
                        .addInput("ecommerce_db.shopify." + inputName, serviceName)
                        .addOutput(
                            datasetWithColumns(
                                uniqueDatasetNamespace(), "ecommerce_db.shopify." + missingName))));

    assertEquals("failure", response.get("status").asText(), response.toString());
    assertEquals(0, response.get("lineageEdgesCreated").asInt());
    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals("namespaceNotMapped", unresolved.get(0).get("reason").asText());
    assertNotFound(
        () -> SdkClients.adminClient().tables().getByName(schemaFqn + "." + missingName));
  }

  @Test
  @Order(21)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void jobWithoutPipeline_writesTheEdgeWithoutOneAndReportsTheJob(TestNamespace ns)
      throws Exception {
    PipelineService pipelineService = PipelineServiceTestFactory.createAirflow(ns);
    String inputName = "ol_nojob_in_" + uniqueSuffix();
    String outputName = "ol_nojob_out_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    String jobNamespace = "ol_nojob_ns_" + uniqueSuffix();
    String jobName = "ol_nojob_job_" + uniqueSuffix();

    JsonNode response =
        withOpenLineageSettings(
            Map.of("autoCreateEntities", true, "defaultPipelineService", pipelineService.getName()),
            () ->
                send(
                    completeEvent(jobNamespace, jobName)
                        .addInput("ecommerce_db.shopify." + inputName, serviceName)
                        .addOutput("ecommerce_db.shopify." + outputName, serviceName)));

    assertEquals("success", response.get("status").asText(), response.toString());
    assertEquals(1, response.get("lineageEdgesCreated").asInt());
    JsonNode job = response.get("unresolvedJobs").get(0);
    assertEquals(jobName, job.get("name").asText());
    assertEquals("pipelineNotFound", job.get("reason").asText());
    assertNotFound(
        () ->
            SdkClients.adminClient()
                .pipelines()
                .getByName(
                    pipelineService.getFullyQualifiedName() + "." + jobNamespace + "-" + jobName));
    assertNull(fetchOpenLineageEdgeDetails(inputName, outputName).get("pipeline"));
  }

  @Test
  @Order(22)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void existingPipeline_isLinkedToTheEdge(TestNamespace ns) throws Exception {
    PipelineService pipelineService = PipelineServiceTestFactory.createAirflow(ns);
    String jobNamespace = "ol_job_ns_" + uniqueSuffix();
    String jobName = "ol_job_" + uniqueSuffix();
    Pipeline pipeline =
        SdkClients.adminClient()
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(jobNamespace + "-" + jobName)
                    .withService(pipelineService.getFullyQualifiedName()));
    String inputName = "ol_job_in_" + uniqueSuffix();
    String outputName = "ol_job_out_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    JsonNode response =
        withOpenLineageSettings(
            Map.of("defaultPipelineService", pipelineService.getName()),
            () ->
                send(
                    completeEvent(jobNamespace, jobName)
                        .addInput("ecommerce_db.shopify." + inputName, serviceName)
                        .addOutput("ecommerce_db.shopify." + outputName, serviceName)));

    assertEquals("success", response.get("status").asText(), response.toString());
    assertTrue(response.get("unresolvedJobs").isEmpty(), response.toString());
    Map<?, ?> edgePipeline =
        (Map<?, ?>) fetchOpenLineageEdgeDetails(inputName, outputName).get("pipeline");
    assertNotNull(edgePipeline, "Edge must reference the job's existing pipeline");
    assertEquals(pipeline.getFullyQualifiedName(), edgePipeline.get("fullyQualifiedName"));
  }

  @Test
  @Order(23)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void batch_reportsTheOutcomeOfEveryEvent() throws Exception {
    String inputName = "ol_batch_in_" + uniqueSuffix();
    String outputName = "ol_batch_out_" + uniqueSuffix();
    String missingName = "ol_batch_missing_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Tables.create().name(outputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    String input = "ecommerce_db.shopify." + inputName;

    JsonNode response =
        withOpenLineageSettings(
            Map.of("autoCreateEntities", true),
            () ->
                MAPPER.readTree(
                    OpenLineage.batch()
                        .addEvent(
                            completeEvent("ol_batch_ns", "ol_batch_ok_" + uniqueSuffix())
                                .addInput(input, serviceName)
                                .addOutput("ecommerce_db.shopify." + outputName, serviceName))
                        .addEvent(
                            completeEvent("ol_batch_ns", "ol_batch_bad_" + uniqueSuffix())
                                .addInput(input, serviceName)
                                .addOutput(
                                    "ecommerce_db.shopify." + missingName,
                                    uniqueDatasetNamespace()))
                        .addEvent(
                            completeEvent("ol_batch_ns", "ol_batch_start_" + uniqueSuffix())
                                .withEventType("START")
                                .addInput(input, serviceName)
                                .addOutput("ecommerce_db.shopify." + outputName, serviceName))
                        .send()));

    assertEquals("partial_success", response.get("status").asText(), response.toString());
    JsonNode summary = response.get("summary");
    assertEquals(3, summary.get("received").asInt());
    assertEquals(1, summary.get("successful").asInt());
    assertEquals(0, summary.get("partial").asInt());
    assertEquals(1, summary.get("failed").asInt());
    assertEquals(1, summary.get("skipped").asInt());
    assertEquals(1, response.get("failedEvents").get(0).get("index").asInt());
    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals(1, unresolved.get(0).get("eventIndex").asInt());
    assertEquals("namespaceNotMapped", unresolved.get(0).get("reason").asText());
  }

  @Test
  @Order(24)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void invalidColumns_leaveNoEmptyDatabaseOrSchemaBehind() throws Exception {
    String namespace = uniqueDatasetNamespace();
    String suffix = uniqueSuffix();
    String database = "ol_invalid_db_" + suffix;
    String inputName = "ol_invalid_in_" + suffix;
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();
    Map<String, Object> repeatedColumns =
        Map.of(
            "namespace",
            namespace,
            "name",
            database + ".ol_invalid_schema_" + suffix + ".ol_invalid_table_" + suffix,
            "facets",
            Map.of(
                "schema",
                Map.of(
                    "fields",
                    List.of(
                        Map.of("name", "id", "type", "bigint"),
                        Map.of("name", "id", "type", "string")))));

    JsonNode response =
        withOpenLineageSettings(
            autoCreateUnder(namespace),
            () ->
                sendExpectingRejection(
                    completeEvent("ol_invalid_ns", "ol_invalid_job_" + suffix)
                        .addInput("ecommerce_db.shopify." + inputName, namespace)
                        .addOutput(repeatedColumns)));

    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals("invalidEntity", unresolved.get(0).get("reason").asText());
    assertNotFound(
        () -> SdkClients.adminClient().databases().getByName(serviceName + "." + database));
  }

  @Test
  @Order(25)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void mappingToAMissingService_isReportedAndCreatesNothing() throws Exception {
    String namespace = uniqueDatasetNamespace();
    String missingService = "ol_missing_svc_" + uniqueSuffix();
    String inputName = "ol_missing_svc_in_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    JsonNode response =
        withOpenLineageSettings(
            Map.of(
                "autoCreateEntities",
                true,
                "namespaceToServiceMapping",
                Map.of(namespace, missingService)),
            () ->
                sendExpectingRejection(
                    completeEvent("ol_missing_svc_ns", "ol_missing_svc_job_" + uniqueSuffix())
                        .addInput("ecommerce_db.shopify." + inputName, serviceName)
                        .addOutput(
                            datasetWithColumns(
                                namespace, "some_db.some_schema.ol_missing_svc_out"))));

    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals("serviceNotFound", unresolved.get(0).get("reason").asText());
    assertTrue(unresolved.get(0).get("message").asText().contains(missingService));
  }

  @Test
  @Order(26)
  @ResourceLock(
      value = SharedResourceLocks.OPEN_LINEAGE_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void twoPartNameUnderAServiceWithSeveralDatabases_reportsTheMissingDatabase() throws Exception {
    String namespace = uniqueDatasetNamespace();
    Databases.create().name("ol_second_db_" + uniqueSuffix()).in(serviceName).execute();
    String inputName = "ol_two_part_in_" + uniqueSuffix();
    String missingName = "ol_two_part_out_" + uniqueSuffix();
    Tables.create().name(inputName).inSchema(schemaFqn).withColumns(DEFAULT_COLUMNS).execute();

    JsonNode response =
        withOpenLineageSettings(
            autoCreateUnder(namespace),
            () ->
                sendExpectingRejection(
                    completeEvent("ol_two_part_ns", "ol_two_part_job_" + uniqueSuffix())
                        .addInput("ecommerce_db.shopify." + inputName, namespace)
                        .addOutput(datasetWithColumns(namespace, "shopify." + missingName))));

    JsonNode unresolved = response.get("unresolvedDatasets");
    assertEquals(1, unresolved.size(), response.toString());
    assertEquals("missingDatabase", unresolved.get(0).get("reason").asText());
    assertNotFound(
        () -> SdkClients.adminClient().tables().getByName(schemaFqn + "." + missingName));
  }

  // ====================================================================================
  // Helpers
  // ====================================================================================

  /**
   * Entity audit fields follow the entity contract, not the edge one: the principal that posted the
   * event and the moment OpenMetadata created the entity, never the OpenLineage eventTime.
   */
  private static void assertAuditFieldsStamped(EntityInterface entity, long notBefore) {
    String fqn = entity.getFullyQualifiedName();
    assertEquals("admin", entity.getUpdatedBy(), "updatedBy of auto-created " + fqn);
    assertNotNull(entity.getUpdatedAt(), "updatedAt of auto-created " + fqn);
    assertTrue(
        entity.getUpdatedAt() >= notBefore,
        "updatedAt of auto-created " + fqn + " must be creation time, not the event time");
  }

  private static void assertNotFound(Executable lookup) {
    OpenMetadataException missing = assertThrows(OpenMetadataException.class, lookup);
    assertEquals(404, missing.getStatusCode(), missing.getMessage());
  }

  private static OpenLineage.RunEventBuilder completeEvent(String jobNamespace, String jobName) {
    return OpenLineage.event()
        .withEventType("COMPLETE")
        .withEventTime(EVENT_TIME)
        .withJob(jobName, jobNamespace)
        .withRun(UUID.randomUUID().toString());
  }

  private static JsonNode send(OpenLineage.RunEventBuilder event) throws Exception {
    return MAPPER.readTree(event.send());
  }

  /** A rejected event still carries the response body naming each unresolved dataset. */
  private static JsonNode sendExpectingRejection(OpenLineage.RunEventBuilder event)
      throws Exception {
    InvalidRequestException rejection = assertThrows(InvalidRequestException.class, event::send);
    return MAPPER.readTree(rejection.getResponseBody());
  }

  private static Map<String, Object> datasetWithColumns(String namespace, String name) {
    return Map.of(
        "namespace", namespace, "name", name, "facets", Map.of("schema", Map.of("fields", FIELDS)));
  }

  private static String uniqueDatasetNamespace() {
    return "postgres://ol-it-" + uniqueSuffix() + ":5432";
  }

  private static Map<String, Object> autoCreateUnder(String namespace) {
    return Map.of(
        "autoCreateEntities", true, "namespaceToServiceMapping", Map.of(namespace, serviceName));
  }

  private static <T> T withOpenLineageSettings(Map<String, Object> configValue, Callable<T> action)
      throws Exception {
    String previousSettings = readOpenLineageSettings();
    try {
      writeOpenLineageSettings(configValue);
      return action.call();
    } finally {
      restoreOpenLineageSettings(previousSettings);
    }
  }

  /**
   * There is no reset endpoint for openLineageSettings (only searchSettings supports reset), so the
   * test has to capture and restore the value itself. Returns null when the setting has never been
   * persisted.
   */
  private static String readOpenLineageSettings() {
    try {
      return SdkClients.adminClient()
          .getHttpClient()
          .executeForString(
              HttpMethod.GET,
              "/v1/system/settings/" + OPEN_LINEAGE_SETTINGS_TYPE,
              null,
              RequestOptions.builder().build());
    } catch (Exception e) {
      return null;
    }
  }

  private static void writeOpenLineageNamespaceMapping(String namespace, String serviceName)
      throws Exception {
    writeOpenLineageSettings(
        Map.of(
            "autoCreateEntities",
            false,
            "defaultPipelineService",
            "OpenLineage",
            "namespaceToServiceMapping",
            Map.of(namespace, serviceName)));
  }

  private static void writeOpenLineageSettings(Map<String, Object> configValue) throws Exception {
    putOpenLineageSettings(
        Map.of("config_type", OPEN_LINEAGE_SETTINGS_TYPE, "config_value", configValue));
  }

  @SuppressWarnings("unchecked")
  private static void restoreOpenLineageSettings(String previousSettings) throws Exception {
    Map<String, Object> configValue = new HashMap<>();
    if (previousSettings != null && !previousSettings.isBlank()) {
      JsonNode previous = MAPPER.readTree(previousSettings).path("config_value");
      if (previous.isObject()) {
        configValue = MAPPER.convertValue(previous, Map.class);
      }
    }
    configValue.remove("namespaceToServiceMapping");
    putOpenLineageSettings(
        Map.of("config_type", OPEN_LINEAGE_SETTINGS_TYPE, "config_value", configValue));
  }

  private static void putOpenLineageSettings(Map<String, Object> body) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(body),
            RequestOptions.builder().build());
  }

  private static String uniqueSuffix() {
    return UUID.randomUUID().toString().substring(0, 8);
  }

  private static void sendCompleteEvent(
      TestNamespace ns,
      String jobName,
      String inputTableName,
      String outputTableName,
      String eventTime)
      throws Exception {
    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(eventTime)
            .withJob(ns.prefix(jobName), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput("ecommerce_db.shopify." + inputTableName, serviceName)
            .addOutput("ecommerce_db.shopify." + outputTableName, serviceName)
            .send();
    JsonNode json = MAPPER.readTree(response);
    assertEquals(
        "success", json.get("status").asText(), "OpenLineage event submission failed: " + response);
    assertTrue(
        json.get("lineageEdgesCreated").asInt() >= 1,
        "Expected at least one lineage edge, got: " + response);
  }

  private static Map<?, ?> fetchOpenLineageEdgeDetails(
      String inputTableName, String outputTableName) {
    return fetchOpenLineageEdgeDetailsByFqn(
        schemaFqn + "." + inputTableName, schemaFqn + "." + outputTableName);
  }

  private static Map<?, ?> fetchOpenLineageEdgeDetailsByFqn(String inputFqn, String outputFqn) {
    Map<?, ?>[] holder = new Map<?, ?>[1];
    Awaitility.await("OpenLineage edge from " + inputFqn + " to " + outputFqn)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              holder[0] = findOpenLineageEdge(inputFqn, outputFqn);
              return holder[0] != null;
            });
    return holder[0];
  }

  /**
   * Lineage reads are eventually consistent, so a single absence sample can pass simply because
   * nothing is visible yet. Require the absence to hold for a window instead.
   */
  private static void assertNoOpenLineageEdge(String inputFqn, String outputFqn, String message) {
    Awaitility.await(message)
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> findOpenLineageEdge(inputFqn, outputFqn) == null);
  }

  @SuppressWarnings("unchecked")
  private static Map<?, ?> findOpenLineageEdge(String inputFqn, String outputFqn) throws Exception {
    LineageAPI.LineageGraph graph =
        LineageAPI.forName$("table", inputFqn).upstream(0).downstream(1).fetch();
    Map<String, Object> lineage = MAPPER.readValue(graph.getRaw(), Map.class);
    List<?> edges = (List<?>) lineage.get("downstreamEdges");
    if (edges == null) {
      return null;
    }
    Map<String, String> nodeIdToFqn = buildNodeIdToFqnMap(lineage);
    for (Object raw : edges) {
      Map<?, ?> edge = (Map<?, ?>) raw;
      Map<?, ?> details = (Map<?, ?>) edge.get("lineageDetails");
      if (details == null
          || !"OpenLineage".equals(details.get("source"))
          || details.get("createdAt") == null) {
        continue;
      }
      Object toEntityId = edge.get("toEntity");
      String toFqn = toEntityId == null ? null : nodeIdToFqn.get(toEntityId.toString());
      if (outputFqn.equals(toFqn)) {
        return details;
      }
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, String> buildNodeIdToFqnMap(Map<String, Object> lineage) {
    Map<String, String> result = new HashMap<>();
    Object nodes = lineage.get("nodes");
    if (nodes instanceof List<?> list) {
      for (Object item : list) {
        if (item instanceof Map<?, ?> node) {
          Object id = node.get("id");
          Object fqn = node.get("fullyQualifiedName");
          if (id != null && fqn != null) {
            result.put(id.toString(), fqn.toString());
          }
        }
      }
    }
    Object entity = lineage.get("entity");
    if (entity instanceof Map<?, ?> entityNode) {
      Object id = entityNode.get("id");
      Object fqn = entityNode.get("fullyQualifiedName");
      if (id != null && fqn != null) {
        result.put(id.toString(), fqn.toString());
      }
    }
    return result;
  }
}
