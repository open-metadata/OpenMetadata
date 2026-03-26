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
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
}
