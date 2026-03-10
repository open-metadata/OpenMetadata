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

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for verifying that bulk asset operations (add/remove) record the correct user
 * in the change event.
 *
 * <p>This tests the fix for the bug where bulk asset operations on domains, data products, and
 * teams would show the entity creator in the activity feed instead of the user who actually
 * performed the add/remove action.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkAssetChangeEventUserIT {

  private static final String EVENTS_PATH = "/v1/events";

  @Test
  void test_domainBulkAddAssets_recordsCorrectUser(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    Domain domain =
        adminClient
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("domain"))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Test domain for change event user test"));

    Table table = createTestTable(ns);

    long timestampBeforeAdd = System.currentTimeMillis();

    OpenMetadataClient user1Client = SdkClients.user1Client();
    BulkAssets addAssets = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    String addPath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add";
    user1Client.getHttpClient().execute(HttpMethod.PUT, addPath, addAssets, Void.class);

    Awaitility.await("Wait for change event to be recorded")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ListResponse<ChangeEvent> events =
                  queryChangeEvents(
                      adminClient.getHttpClient(), null, "domain", null, null, timestampBeforeAdd);

              assertNotNull(events);
              assertNotNull(events.getData());

              ChangeEvent addAssetEvent =
                  events.getData().stream()
                      .filter(
                          e ->
                              e.getEntityId().equals(domain.getId())
                                  && e.getEventType() == EventType.ENTITY_UPDATED)
                      .findFirst()
                      .orElse(null);

              assertNotNull(addAssetEvent, "Should find change event for bulk add assets");
              assertEquals(
                  "shared_user1",
                  addAssetEvent.getUserName(),
                  "Change event should show user1, not the domain creator (admin)");
            });
  }

  @Test
  void test_domainBulkRemoveAssets_recordsCorrectUser(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    Domain domain =
        adminClient
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("domain"))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Test domain for change event user test"));

    Table table = createTestTable(ns);

    BulkAssets assets = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    String addPath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add";
    adminClient.getHttpClient().execute(HttpMethod.PUT, addPath, assets, Void.class);

    Thread.sleep(500);

    long timestampBeforeRemove = System.currentTimeMillis();

    OpenMetadataClient user1Client = SdkClients.user1Client();
    String removePath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/remove";
    user1Client.getHttpClient().execute(HttpMethod.PUT, removePath, assets, Void.class);

    Awaitility.await("Wait for change event to be recorded")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ListResponse<ChangeEvent> events =
                  queryChangeEvents(
                      adminClient.getHttpClient(),
                      null,
                      "domain",
                      null,
                      null,
                      timestampBeforeRemove);

              assertNotNull(events);
              assertNotNull(events.getData());

              ChangeEvent removeAssetEvent =
                  events.getData().stream()
                      .filter(
                          e ->
                              e.getEntityId().equals(domain.getId())
                                  && e.getEventType() == EventType.ENTITY_UPDATED)
                      .findFirst()
                      .orElse(null);

              assertNotNull(removeAssetEvent, "Should find change event for bulk remove assets");
              assertEquals(
                  "shared_user1",
                  removeAssetEvent.getUserName(),
                  "Change event should show user1, not the domain creator (admin)");
            });
  }

  @Test
  void test_teamBulkAddAssets_recordsCorrectUser(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    Team team =
        adminClient
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDescription("Test team for change event user test"));

    User testUser = shared.USER2;

    long timestampBeforeAdd = System.currentTimeMillis();

    OpenMetadataClient user1Client = SdkClients.user1Client();
    BulkAssets addAssets = new BulkAssets().withAssets(List.of(testUser.getEntityReference()));
    String addPath = "/v1/teams/" + team.getFullyQualifiedName() + "/assets/add";
    user1Client.getHttpClient().execute(HttpMethod.PUT, addPath, addAssets, Void.class);

    Awaitility.await("Wait for change event to be recorded")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ListResponse<ChangeEvent> events =
                  queryChangeEvents(
                      adminClient.getHttpClient(), null, "team", null, null, timestampBeforeAdd);

              assertNotNull(events);
              assertNotNull(events.getData());

              ChangeEvent addAssetEvent =
                  events.getData().stream()
                      .filter(
                          e ->
                              e.getEntityId().equals(team.getId())
                                  && e.getEventType() == EventType.ENTITY_UPDATED)
                      .findFirst()
                      .orElse(null);

              assertNotNull(addAssetEvent, "Should find change event for bulk add assets");
              assertEquals(
                  "shared_user1",
                  addAssetEvent.getUserName(),
                  "Change event should show user1, not the team creator (admin)");
            });
  }

  @Test
  void test_teamBulkRemoveAssets_recordsCorrectUser(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    Team team =
        adminClient
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDescription("Test team for change event user test"));

    User testUser = shared.USER2;

    BulkAssets assets = new BulkAssets().withAssets(List.of(testUser.getEntityReference()));
    String addPath = "/v1/teams/" + team.getFullyQualifiedName() + "/assets/add";
    adminClient.getHttpClient().execute(HttpMethod.PUT, addPath, assets, Void.class);

    Thread.sleep(500);

    long timestampBeforeRemove = System.currentTimeMillis();

    OpenMetadataClient user1Client = SdkClients.user1Client();
    String removePath = "/v1/teams/" + team.getFullyQualifiedName() + "/assets/remove";
    user1Client.getHttpClient().execute(HttpMethod.PUT, removePath, assets, Void.class);

    Awaitility.await("Wait for change event to be recorded")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ListResponse<ChangeEvent> events =
                  queryChangeEvents(
                      adminClient.getHttpClient(), null, "team", null, null, timestampBeforeRemove);

              assertNotNull(events);
              assertNotNull(events.getData());

              ChangeEvent removeAssetEvent =
                  events.getData().stream()
                      .filter(
                          e ->
                              e.getEntityId().equals(team.getId())
                                  && e.getEventType() == EventType.ENTITY_UPDATED)
                      .findFirst()
                      .orElse(null);

              assertNotNull(removeAssetEvent, "Should find change event for bulk remove assets");
              assertEquals(
                  "shared_user1",
                  removeAssetEvent.getUserName(),
                  "Change event should show user1, not the team creator (admin)");
            });
  }

  private Table createTestTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("table"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("ID column")));

    return SdkClients.adminClient().tables().create(createTable);
  }

  private ListResponse<ChangeEvent> queryChangeEvents(
      HttpClient httpClient,
      String entityCreated,
      String entityUpdated,
      String entityRestored,
      String entityDeleted,
      Long timestamp)
      throws Exception {

    int maxRetries = 5;
    int retryDelayMs = 500;

    for (int retry = 0; retry < maxRetries; retry++) {
      Map<String, String> queryParams = new HashMap<>();
      if (entityCreated != null) {
        queryParams.put("entityCreated", entityCreated);
      }
      if (entityUpdated != null) {
        queryParams.put("entityUpdated", entityUpdated);
      }
      if (entityRestored != null) {
        queryParams.put("entityRestored", entityRestored);
      }
      if (entityDeleted != null) {
        queryParams.put("entityDeleted", entityDeleted);
      }
      if (timestamp != null) {
        queryParams.put("timestamp", timestamp.toString());
      }

      RequestOptions options = RequestOptions.builder().queryParams(queryParams).build();

      String responseJson = httpClient.executeForString(HttpMethod.GET, EVENTS_PATH, null, options);
      ListResponse<ChangeEvent> response = deserializeEventListResponse(responseJson);

      if (response != null && response.getData() != null && !response.getData().isEmpty()) {
        return response;
      }

      if (retry < maxRetries - 1) {
        Thread.sleep(retryDelayMs);
      }
    }

    return new ListResponse<>();
  }

  private ListResponse<ChangeEvent> deserializeEventListResponse(String json) throws Exception {
    if (CommonUtil.nullOrEmpty(json)) {
      return null;
    }
    return JsonUtils.readValue(json, new TypeReference<ListResponse<ChangeEvent>>() {});
  }
}
