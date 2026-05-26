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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.LineageAPI;
import org.openmetadata.sdk.fluent.OpenLineage;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.wrappers.FluentTable;

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
public class OpenLineageLineageResolutionIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<Column> DEFAULT_COLUMNS =
      List.of(
          new Column().withName("id").withDataType(ColumnDataType.BIGINT),
          new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

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
  void testUnresolvableDatasetsCreateNoEdges(TestNamespace ns) throws Exception {
    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("unknown_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput("nonexistent_schema.nonexistent_table", "nonexistent_service")
            .addOutput("nonexistent_schema.nonexistent_output", "nonexistent_service")
            .send();

    JsonNode json = MAPPER.readTree(response);
    assertEquals(
        0, json.get("lineageEdgesCreated").asInt(), "Unresolvable datasets should create 0 edges");
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
  // Helpers
  // ====================================================================================

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

  @SuppressWarnings("unchecked")
  private static Map<?, ?> fetchOpenLineageEdgeDetails(
      String inputTableName, String outputTableName) {
    String inputFqn = schemaFqn + "." + inputTableName;
    String outputFqn = schemaFqn + "." + outputTableName;
    Map<?, ?>[] holder = new Map<?, ?>[1];
    Awaitility.await("OpenLineage edge from " + inputTableName + " to " + outputTableName)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              LineageAPI.LineageGraph graph =
                  LineageAPI.forName$("table", inputFqn).upstream(0).downstream(1).fetch();
              Map<String, Object> lineage = MAPPER.readValue(graph.getRaw(), Map.class);
              List<?> edges = (List<?>) lineage.get("downstreamEdges");
              if (edges == null) {
                return false;
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
                  holder[0] = details;
                  return true;
                }
              }
              return false;
            });
    return holder[0];
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
