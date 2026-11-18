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
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.LineageAPI;
import org.openmetadata.sdk.fluent.OpenLineage;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * End-to-end regression test for the bug where an OpenLineage COMPLETE event lacking a
 * columnLineage facet silently wiped the stored column-level lineage on the from→to edge.
 *
 * <p>Mirrors the unit test in {@code LineageRepositoryTest} but exercises the live REST path
 * {@code POST /v1/openlineage/lineage} → {@code OpenLineageResource.addLineageEdges} → {@code
 * LineageRepository.addLineage} → {@code relationshipDAO().insert}.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class OpenLineageColumnLineagePreservationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<Column> DEFAULT_COLUMNS =
      List.of(
          new Column().withName("id").withDataType(ColumnDataType.BIGINT),
          new Column().withName("amount").withDataType(ColumnDataType.BIGINT));

  private static OpenMetadataClient client;

  @BeforeAll
  static void setup() {
    OpenLineage.setDefaultClient(SdkClients.adminClient());
    Tables.setDefaultClient(SdkClients.adminClient());
    LineageAPI.setDefaultClient(SdkClients.adminClient());
    DatabaseServices.setDefaultClient(SdkClients.adminClient());
    Databases.setDefaultClient(SdkClients.adminClient());
    DatabaseSchemas.setDefaultClient(SdkClients.adminClient());
    client = SdkClients.adminClient();
  }

  /**
   * Headline assertion of the bug fix: a no-facet OpenLineage COMPLETE event posted for an edge
   * that already has column-level lineage must NOT wipe the stored column lineage.
   */
  @Test
  void testNoFacetCompleteEventPreservesStoredColumnLineage(TestNamespace ns) throws Exception {
    Table src = createSourceTable();
    Table dst = createTargetTable(schemaFqnOf(src));

    ColumnLineage stored = columnLineage(src, dst, "amount");
    putColumnLineage(src, dst, stored);
    assertEdgeHasColumnLineage(src, dst, stored, "after initial PUT");

    // Step 2: send a second OpenLineage COMPLETE event for the same datasets but WITHOUT a
    // columnLineage facet — the routine producer path. Before the fix, this wiped the stored
    // column lineage; after the fix, the stored entries survive.
    String response = sendNoFacetCompleteEvent(ns, src, dst);

    JsonNode json = MAPPER.readTree(response);
    assertEquals("success", json.get("status").asText(), response);
    assertTrue(
        json.get("lineageEdgesCreated").asInt() >= 1,
        "expected at least 1 lineage edge created, got: " + response);

    // Step 3: re-fetch the edge and confirm the stored column lineage is intact.
    assertEdgeHasColumnLineage(src, dst, stored, "after no-facet OpenLineage COMPLETE event");
  }

  /**
   * Replace-semantics guard end-to-end: an OpenLineage-style addLineage with explicit non-null
   * column lineage REPLACES the stored entries (the fix must not turn every write into a union).
   * Exercised through the lineage API directly because the OpenLineage columnLineage facet
   * parsing path is unit-tested in OpenLineageColumnMapperTest; here we verify the store side.
   */
  @Test
  void testFacetCarryingCompleteEventReplacesStoredColumnLineage(TestNamespace ns)
      throws Exception {
    Table src = createSourceTable();
    Table dst = createTargetTable(schemaFqnOf(src));

    ColumnLineage initial = columnLineage(src, dst, "amount");
    putColumnLineage(src, dst, initial);
    assertEdgeHasColumnLineage(src, dst, initial, "after initial PUT");

    ColumnLineage replacement = columnLineage(src, dst, "id");
    putColumnLineage(src, dst, replacement);
    assertEdgeHasColumnLineage(src, dst, replacement, "after replacing write");
  }

  private String sendNoFacetCompleteEvent(TestNamespace ns, Table src, Table dst) {
    String response =
        OpenLineage.event()
            .withEventType("COMPLETE")
            .withEventTime(Instant.now().toString())
            .withJob(ns.prefix("no_facet_job"), ns.prefix("namespace"))
            .withRun(UUID.randomUUID().toString())
            .addInput(datasetBareName(src), serviceNamespace(src))
            .addOutput(datasetBareName(dst), serviceNamespace(dst))
            .send();
    assertNotNull(response);
    return response;
  }

  private static ColumnLineage columnLineage(Table src, Table dst, String column) {
    return new ColumnLineage()
        .withFromColumns(List.of(src.getFullyQualifiedName() + "." + column))
        .withToColumn(dst.getFullyQualifiedName() + "." + column);
  }

  /** Creates the source table under a fresh, uniquely-named service/db/schema triple. */
  private Table createSourceTable() {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    DatabaseService service =
        DatabaseServices.builder()
            .name("ol_col_lin_pres_" + uniqueId)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Test service for OpenLineage column-lineage preservation tests")
            .create();
    Database db =
        Databases.create()
            .name("ecommerce_" + uniqueId)
            .in(service.getFullyQualifiedName())
            .execute();
    // Unique schema + table names so the OpenLineage dataset resolver — which, without a
    // namespaceToServiceMapping, falls back to a suffix LIKE search across every service —
    // matches only this test's tables under CONCURRENT execution.
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name("shopify_" + uniqueId)
            .in(db.getFullyQualifiedName())
            .execute();
    return Tables.create()
        .name("raw_order_" + uniqueId)
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(DEFAULT_COLUMNS)
        .execute();
  }

  /** Creates the target table inside the source table's schema so the edge shares a service. */
  private Table createTargetTable(String schemaFqn) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    return Tables.create()
        .name("fact_order_" + uniqueId)
        .inSchema(schemaFqn)
        .withColumns(DEFAULT_COLUMNS)
        .execute();
  }

  /** FQN is {@code <service>.<db>.<schema>.<table>}; the schema FQN is the first three tokens. */
  private static String schemaFqnOf(Table t) {
    String[] parts = t.getFullyQualifiedName().split("\\.");
    return parts[0] + "." + parts[1] + "." + parts[2];
  }

  /** PUTs an edge with the given column lineage entry (sets source=MANUAL). Idempotent / retried. */
  private void putColumnLineage(Table from, Table to, ColumnLineage entry) {
    LineageDetails details =
        new LineageDetails()
            .withSource(LineageDetails.Source.MANUAL)
            .withColumnsLineage(List.of(entry));
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));
    Awaitility.await("PUT edge " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              client.lineage().addLineage(addLineage);
              return true;
            });
  }

  /** Fetches GET /v1/lineage/getLineageEdge/{from}/{to} and asserts the column lineage matches. */
  private void assertEdgeHasColumnLineage(Table from, Table to, ColumnLineage expected, String when)
      throws Exception {
    Awaitility.await("edge column lineage visible " + when)
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              String response =
                  client.getHttpClient().executeForString(HttpMethod.GET, edgePath(from, to), null);
              JsonNode root = MAPPER.readTree(response);
              JsonNode edge = root.get("edge");
              if (edge == null) {
                return false;
              }
              JsonNode cols = edge.get("columnsLineage");
              if (cols == null || !cols.isArray() || cols.isEmpty()) {
                return false;
              }
              return cols.size() == 1;
            });
    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, edgePath(from, to), null);
    JsonNode edge = MAPPER.readTree(response).get("edge");
    assertNotNull(edge, "edge missing " + when + ": " + response);
    JsonNode cols = edge.get("columnsLineage");
    assertNotNull(cols, "columnsLineage missing on edge " + when);
    assertTrue(cols.isArray() && cols.size() == 1, "expected 1 entries " + when + ", got: " + cols);
    assertEquals(expected.getToColumn(), cols.get(0).get("toColumn").asText(), "toColumn " + when);
    assertEquals(
        expected.getFromColumns().getFirst(),
        cols.get(0).get("fromColumns").get(0).asText(),
        "fromColumns " + when);
  }

  /** The OpenLineage event format uses the bare table name (schema.table) as the dataset name. */
  private static String datasetBareName(Table t) {
    String fqn = t.getFullyQualifiedName();
    // FQN is <service>.<db>.<schema>.<table>; OpenLineage dataset name is <schema>.<table>
    String[] parts = fqn.split("\\.");
    return parts[parts.length - 2] + "." + parts[parts.length - 1];
  }

  /** The OpenLineage event namespace is the service FQN (root of the table FQN). */
  private static String serviceNamespace(Table t) {
    return t.getFullyQualifiedName().split("\\.")[0];
  }

  private static String edgePath(Table from, Table to) {
    return "/v1/lineage/getLineageEdge/" + from.getId() + "/" + to.getId();
  }
}
