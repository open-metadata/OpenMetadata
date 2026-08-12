/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.HydrateLineageRequest;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for {@code POST /v1/lineage/hydrate} — the batch entity hydration endpoint.
 *
 * <p>Replaces N per-node entity GETs with one round-trip. The response is a
 * {@code HydrateLineageResponse} with an {@code entitiesByType} map (keyed by entityType) and a
 * {@code droppedCount} of entries the caller could not see. Tests cover the happy paths (single
 * type, mixed types, fields propagation), request validation, and the silent-drop contract for
 * non-existent ids (they don't fail the batch — they're omitted from {@code entitiesByType} and
 * counted in {@code droppedCount}).
 *
 * <p>The full "permitted vs denied principal" silent-drop contract is enforced at the
 * implementation level by {@code LineageHydrator.hydrate} (which loads each entity via
 * {@code repo.get(...)} and then runs {@code authorizer.getPermission} against the already-loaded
 * entity, keeping only those whose {@code VIEW_BASIC} access is {@code ALLOW} or
 * {@code CONDITIONAL_ALLOW}). End-to-end coverage with a restricted-permission principal is left
 * as a follow-up — it requires bootstrapping a team / domain / policy stack that's heavier than
 * this IT's scope.
 */
@Execution(ExecutionMode.CONCURRENT)
public class LineageHydrateIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String HYDRATE_PATH = "/v1/lineage/hydrate";

  @Test
  void hydrateReturnsTablesGroupedByType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageHydrateIT");

    Table t1 = createTable(client, namespace, "hydrate_one");
    Table t2 = createTable(client, namespace, "hydrate_two");

    HydrateLineageRequest request =
        new HydrateLineageRequest()
            .withEntities(
                List.of(
                    new EntityReference().withType("table").withId(t1.getId()),
                    new EntityReference().withType("table").withId(t2.getId())));

    JsonNode response = postHydrate(client, request);

    JsonNode entitiesByType = response.get("entitiesByType");
    assertNotNull(entitiesByType, "response must contain entitiesByType");
    assertTrue(entitiesByType.has("table"), "entitiesByType must group by entityType");
    JsonNode tables = entitiesByType.get("table");
    assertEquals(2, tables.size(), "both requested tables must be returned");
    assertNotNull(tables.get(0).get("fullyQualifiedName"));
    assertNotNull(tables.get(0).get("version"), "hydrated entities should include version");
    assertEquals(0, response.get("droppedCount").asInt(), "no entries should be dropped");
  }

  @Test
  void hydrateDeduplicatesRepeatedRefsBeforeCountingDrops() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageHydrateIT");

    Table table = createTable(client, namespace, "hydrate_duplicate_ref");

    HydrateLineageRequest request =
        new HydrateLineageRequest()
            .withEntities(
                List.of(
                    new EntityReference().withType("table").withId(table.getId()),
                    new EntityReference().withType("table").withId(table.getId())));

    JsonNode response = postHydrate(client, request);
    JsonNode tables = response.get("entitiesByType").get("table");

    assertEquals(1, tables.size(), "duplicate refs should hydrate once");
    assertEquals(table.getId().toString(), tables.get(0).get("id").asText());
    assertEquals(0, response.get("droppedCount").asInt(), "duplicate refs are not drops");
  }

  @Test
  void hydrateMixedTypesReturnsSeparateGroups() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageHydrateIT");

    Table table = createTable(client, namespace, "hydrate_mixed_table");
    Dashboard dashboard = createDashboard(client, namespace, "hydrate_mixed_dash");

    HydrateLineageRequest request =
        new HydrateLineageRequest()
            .withEntities(
                List.of(
                    new EntityReference().withType("table").withId(table.getId()),
                    new EntityReference().withType("dashboard").withId(dashboard.getId())));

    JsonNode response = postHydrate(client, request);
    JsonNode entitiesByType = response.get("entitiesByType");

    assertEquals(1, entitiesByType.get("table").size());
    assertEquals(1, entitiesByType.get("dashboard").size());
    assertEquals(table.getId().toString(), entitiesByType.get("table").get(0).get("id").asText());
    assertEquals(
        dashboard.getId().toString(), entitiesByType.get("dashboard").get(0).get("id").asText());
    assertEquals(0, response.get("droppedCount").asInt());
  }

  @Test
  void hydrateAppliesFieldsParameter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageHydrateIT");

    Table table = createTable(client, namespace, "hydrate_with_fields");

    HydrateLineageRequest withoutFields =
        new HydrateLineageRequest()
            .withEntities(List.of(new EntityReference().withType("table").withId(table.getId())));
    HydrateLineageRequest withFields =
        new HydrateLineageRequest()
            .withEntities(List.of(new EntityReference().withType("table").withId(table.getId())))
            .withFields("tags,owners");

    JsonNode bare = postHydrate(client, withoutFields);
    JsonNode rich = postHydrate(client, withFields);

    JsonNode bareTable = bare.get("entitiesByType").get("table").get(0);
    JsonNode richTable = rich.get("entitiesByType").get("table").get(0);

    // tags / owners are not populated on a bare GET unless explicitly requested.
    assertFalse(
        bareTable.has("tags")
            && bareTable.get("tags").isArray()
            && bareTable.get("tags").size() > 0,
        "bare hydration should not populate tags");
    // With fields requested, the keys must be present (may be empty arrays).
    assertTrue(richTable.has("tags"), "fields=tags must include tags key");
    assertTrue(richTable.has("owners"), "fields=owners must include owners key");
  }

  @Test
  void hydrateSilentlyDropsMissingIds() throws Exception {
    // The endpoint's silent-drop contract: ids the batch cannot resolve (because they're
    // unauthorized OR non-existent) are omitted from the response rather than failing the
    // entire batch. This test exercises the shape using a non-existent UUID alongside a
    // valid table — full per-principal authz coverage requires team/domain bootstrapping and
    // is tracked as follow-up (see class JavaDoc).
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageHydrateIT");
    Table table = createTable(client, namespace, "hydrate_silent_drop");

    HydrateLineageRequest request =
        new HydrateLineageRequest()
            .withEntities(
                List.of(
                    new EntityReference().withType("table").withId(table.getId()),
                    new EntityReference().withType("table").withId(UUID.randomUUID())));

    JsonNode response = postHydrate(client, request);

    // The batch returns 200 with the resolvable id, omitting the missing one — not 404 or
    // empty.
    JsonNode entitiesByType = response.get("entitiesByType");
    assertTrue(entitiesByType.has("table"), "response must include the resolvable table");
    JsonNode tables = entitiesByType.get("table");
    assertEquals(1, tables.size(), "only the existing table should be returned");
    assertEquals(table.getId().toString(), tables.get(0).get("id").asText());
    assertEquals(
        1,
        response.get("droppedCount").asInt(),
        "the unresolvable id should be counted as dropped");
  }

  @Test
  void hydrateRejectsEmptyEntities() {
    OpenMetadataClient client = SdkClients.adminClient();
    HydrateLineageRequest empty = new HydrateLineageRequest().withEntities(List.of());
    Exception thrown = assertThrows(Exception.class, () -> postHydrate(client, empty));
    // Either 400 from bean validation (@Size min=1) or 400 from our own check.
    String msg = thrown.getMessage() == null ? "" : thrown.getMessage();
    assertTrue(
        msg.contains("400") || msg.toLowerCase().contains("size") || msg.contains("entities"),
        "empty entities must yield a 4xx, got: " + msg);
  }

  @Test
  void hydrateRejectsBlankEntityType() {
    OpenMetadataClient client = SdkClients.adminClient();
    HydrateLineageRequest request =
        new HydrateLineageRequest()
            .withEntities(List.of(new EntityReference().withType("   ").withId(UUID.randomUUID())));
    Exception thrown = assertThrows(Exception.class, () -> postHydrate(client, request));
    String msg = thrown.getMessage() == null ? "" : thrown.getMessage();
    assertTrue(
        msg.contains("400")
            || msg.toLowerCase().contains("non-blank")
            || msg.toLowerCase().contains("type"),
        "blank entity type must yield a clear 4xx, got: " + msg);
  }

  @Test
  void hydrateUnknownTypeFailsCleanly() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    HydrateLineageRequest request =
        new HydrateLineageRequest()
            .withEntities(
                List.of(
                    new EntityReference()
                        .withType("nonexistent_type_xyz")
                        .withId(UUID.randomUUID())));
    Exception thrown = assertThrows(Exception.class, () -> postHydrate(client, request));
    String msg = thrown.getMessage() == null ? "" : thrown.getMessage();
    assertTrue(
        msg.contains("nonexistent_type_xyz")
            || msg.toLowerCase().contains("entity type")
            || msg.contains("400")
            || msg.contains("404"),
        "unknown entity type must yield a 4xx, got: " + msg);
  }

  private static JsonNode postHydrate(OpenMetadataClient client, HydrateLineageRequest request)
      throws Exception {
    String body =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, HYDRATE_PATH, request, RequestOptions.builder().build());
    return MAPPER.readTree(body);
  }

  private Table createTable(OpenMetadataClient client, TestNamespace namespace, String tableName)
      throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);

    CreateTable createTable = new CreateTable();
    createTable.setName(namespace.prefix(tableName));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    createTable.setColumns(columns);

    return client.tables().create(createTable);
  }

  private Dashboard createDashboard(
      OpenMetadataClient client, TestNamespace namespace, String dashboardName) throws Exception {
    DashboardService service = DashboardServiceTestFactory.createMetabase(namespace);

    CreateDashboard createDashboard = new CreateDashboard();
    createDashboard.setName(namespace.prefix(dashboardName));
    createDashboard.setService(service.getFullyQualifiedName());

    return client.dashboards().create(createDashboard);
  }
}
