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
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.v205.OverrideMetadataRestore;

/**
 * The 2.0.5 migration restores what 2.0.x ingestion runs removed. The fixed server no longer lets
 * ingestion-bot remove these, so the damage is recreated as an admin PATCH whose version is then
 * re-attributed to ingestion-bot in the database - the history an affected instance carries.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class OverrideMetadataRestoreMigrationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final String TIER = "Tier.Tier1";
  private static final String PII = "PII.Sensitive";
  private static final String STRIP_EVERYTHING =
      """
      [{"op":"remove","path":"/description"},
       {"op":"remove","path":"/retentionPeriod"},
       {"op":"remove","path":"/tableConstraints"},
       {"op":"remove","path":"/tags/0"},
       {"op":"remove","path":"/columns/0/description"},
       {"op":"remove","path":"/columns/0/tags/0"}]""";

  @Test
  void restoresEverythingAnIngestionBotRemoved(TestNamespace ns) throws Exception {
    Table table = curatedTable(ns, "restore_all");
    patch(table.getId(), STRIP_EVERYTHING, SdkClients.getAdminToken());
    attributeCurrentVersionToIngestionBot(table.getId());

    assertEquals(6, restore(table.getId()));

    Table restored = getTable(table.getId());
    assertEquals("curated description", restored.getDescription());
    assertEquals("P30D", restored.getRetentionPeriod());
    assertEquals("curated column", restored.getColumns().getFirst().getDescription());
    assertEquals(List.of(TIER), tagFqns(restored.getTags()));
    assertEquals(List.of(PII), tagFqns(restored.getColumns().getFirst().getTags()));
    assertEquals(List.of("c1"), restored.getTableConstraints().getFirst().getColumns());
    assertEquals("admin", restored.getUpdatedBy());

    assertEquals(0, restore(table.getId()), "a second run finds nothing left to restore");
  }

  @Test
  void leavesWhatAUserRemoved(TestNamespace ns) throws Exception {
    Table table = curatedTable(ns, "user_cleared");
    patch(table.getId(), STRIP_EVERYTHING, SdkClients.getAdminToken());

    assertEquals(0, restore(table.getId()));
    assertNull(getTable(table.getId()).getDescription());
  }

  /**
   * The restore reads each entity type in pages of 200. t000 is on the first page and t200 is
   * alone on the second, so both coming back proves the cursor moves past a full page.
   */
  @Test
  void restoresEntitiesPastTheFirstPage(TestNamespace ns) throws Exception {
    String schemaFqn =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns))
            .getFullyQualifiedName();
    List<CreateTable> tables =
        IntStream.rangeClosed(0, 200)
            .mapToObj(
                index ->
                    new CreateTable()
                        .withName(String.format("t%03d", index))
                        .withDatabaseSchema(schemaFqn)
                        .withDescription("curated description")
                        .withColumns(
                            List.of(
                                new Column().withName("c1").withDataType(ColumnDataType.STRING))))
            .toList();
    BulkApi.upsert("tables", tables);
    for (String name : List.of("t000", "t200")) {
      UUID id = SdkClients.adminClient().tables().getByName(schemaFqn + "." + name).getId();
      patch(id, "[{\"op\":\"remove\",\"path\":\"/description\"}]", SdkClients.getAdminToken());
      attributeCurrentVersionToIngestionBot(id);
    }

    ListFilter inSchema =
        new ListFilter(Include.NON_DELETED).addQueryParam("databaseSchema", schemaFqn);
    assertEquals(2, OverrideMetadataRestore.restoreType(Entity.TABLE, since(), inSchema));
    assertEquals(
        "curated description",
        SdkClients.adminClient().tables().getByName(schemaFqn + ".t200").getDescription());
  }

  /**
   * The suite's bootstrap ran the real migration workflow, so a recorded marker means the step ran
   * during the upgrade.
   */
  @Test
  void upgradeRanTheRestoreOnce() {
    MigrationDAO migrationDAO = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    AtomicInteger runs = new AtomicInteger();

    DataMigrationStep.runOnce(
        migrationDAO, "2.0.5", OverrideMetadataRestore.STEP_NAME, runs::incrementAndGet);

    assertEquals(0, runs.get(), "the upgrade already ran the restore, a re-run must skip it");
  }

  private void attributeCurrentVersionToIngestionBot(UUID id) {
    String sql =
        "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
            ? "UPDATE table_entity SET json = JSON_SET(json, '$.updatedBy', 'ingestion-bot') WHERE id = :id"
            : "UPDATE table_entity SET json = jsonb_set(json, '{updatedBy}', '\"ingestion-bot\"') WHERE id = :id";
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> handle.createUpdate(sql).bind("id", id.toString()).execute());
  }

  private int restore(UUID id) {
    return OverrideMetadataRestore.restoreEntity(Entity.TABLE, id, since());
  }

  private long since() {
    Long since = TestSuiteBootstrap.getJdbi().withHandle(OverrideMetadataRestore::windowStart);
    assertNotNull(since, "the suite's bootstrap recorded the 2.0.x migrations");
    return since;
  }

  private Table curatedTable(TestNamespace ns, String name) throws Exception {
    String schemaFqn =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns))
            .getFullyQualifiedName();
    CreateTable create =
        new CreateTable()
            .withName(ns.prefix(name))
            .withDatabaseSchema(schemaFqn)
            .withDescription("curated description")
            .withRetentionPeriod("P30D")
            .withTags(List.of(tag(TIER)))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY)
                        .withColumns(List.of("c1"))))
            .withColumns(
                List.of(
                    new Column()
                        .withName("c1")
                        .withDataType(ColumnDataType.STRING)
                        .withDescription("curated column")
                        .withTags(List.of(tag(PII)))));
    BulkApi.upsert("tables", List.of(create));
    return SdkClients.adminClient().tables().getByName(schemaFqn + "." + create.getName());
  }

  private TagLabel tag(String fqn) {
    return new TagLabel().withTagFQN(fqn).withSource(TagLabel.TagSource.CLASSIFICATION);
  }

  private List<String> tagFqns(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).toList();
  }

  private void patch(UUID id, String jsonPatch, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/" + id))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(jsonPatch))
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "patch table " + id + ": " + response.body());
  }

  private Table getTable(UUID id) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/tables/"
                        + id
                        + "?fields=columns,tags,tableConstraints"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "get table " + id + ": " + response.body());
    return MAPPER.readValue(response.body(), Table.class);
  }
}
