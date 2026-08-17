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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.configuration.NotificationSettings;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Integration tests for Query Change Events, which are opt-in through the notificationSettings
 * setting (Settings -> Preferences -> Notifications in the UI).
 *
 * <p>Queries are usually ingested in large bulk batches, so a change event per query is only
 * recorded when {@code notificationSettings.enableQueryChangeEvents} is turned on.
 *
 * <p>Test isolation: runs isolated because it mutates a global setting that changes the change
 * events every other concurrently executing test class would produce.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class QueryChangeEventSettingsIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final long EVENT_PROCESSING_MILLIS = 2000;
  private static final String EVENTS_PATH = "/v1/events";
  private static final String NOTIFICATION_SETTINGS_PATH =
      "/v1/system/settings/" + SettingsType.NOTIFICATION_SETTINGS.value();

  @AfterEach
  void resetNotificationSettings() throws Exception {
    setQueryChangeEventsEnabled(false);
  }

  @Test
  void test_queryChangeEventsAreDisabledByDefault() throws Exception {
    NotificationSettings settings = getNotificationSettings();

    assertNotNull(settings, "Notification settings should be seeded");
    assertFalse(
        Boolean.TRUE.equals(settings.getEnableQueryChangeEvents()),
        "Query change events should be disabled by default");
  }

  @Test
  void test_noChangeEventForQueryWhenDisabled(TestNamespace ns) throws Exception {
    setQueryChangeEventsEnabled(false);

    long timestamp = System.currentTimeMillis();
    Query suppressedQuery = createQuery(ns, "disabled");

    // Change events are recorded asynchronously, so let the create above go through the event
    // pipeline before the setting is turned on
    Thread.sleep(EVENT_PROCESSING_MILLIS);

    // Turning the setting on and creating a second query gives the event pipeline a change event
    // to record. Once that one is visible, the earlier query would have been recorded too if
    // change events for queries were not suppressed.
    setQueryChangeEventsEnabled(true);
    Query recordedQuery = createQuery(ns, "enabled");
    awaitQueryCreatedEvent(recordedQuery.getId(), timestamp);

    assertFalse(
        hasQueryCreatedEvent(suppressedQuery.getId(), timestamp),
        "No change event should be recorded for a query created while the setting is disabled");
  }

  @Test
  void test_changeEventForQueryWhenEnabled(TestNamespace ns) throws Exception {
    setQueryChangeEventsEnabled(true);

    long timestamp = System.currentTimeMillis();
    Query query = createQuery(ns, "created");

    ChangeEvent changeEvent = awaitQueryCreatedEvent(query.getId(), timestamp);

    assertEquals(Entity.QUERY, changeEvent.getEntityType());
    assertEquals(EventType.ENTITY_CREATED, changeEvent.getEventType());
  }

  private NotificationSettings getNotificationSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                NOTIFICATION_SETTINGS_PATH,
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Notification settings response should not be null");
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    assertEquals(SettingsType.NOTIFICATION_SETTINGS, settings.getConfigType());

    return JsonUtils.convertValue(settings.getConfigValue(), NotificationSettings.class);
  }

  private void setQueryChangeEventsEnabled(boolean enabled) throws Exception {
    Settings settings =
        new Settings()
            .withConfigType(SettingsType.NOTIFICATION_SETTINGS)
            .withConfigValue(new NotificationSettings().withEnableQueryChangeEvents(enabled));

    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", settings, RequestOptions.builder().build());

    assertEquals(
        enabled,
        Boolean.TRUE.equals(getNotificationSettings().getEnableQueryChangeEvents()),
        "Notification settings should reflect the updated value");
  }

  private Query createQuery(TestNamespace ns, String name) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    return SdkClients.adminClient()
        .queries()
        .create(
            new CreateQuery()
                .withName(ns.prefix(name))
                .withDescription("Query created by the query change event settings test")
                .withQuery("SELECT * FROM " + ns.prefix(name))
                .withService(service.getFullyQualifiedName())
                .withQueryDate(System.currentTimeMillis()));
  }

  private ChangeEvent awaitQueryCreatedEvent(UUID queryId, long timestamp) {
    return Awaitility.await("Wait for the change event of query " + queryId)
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .until(() -> findQueryCreatedEvent(queryId, timestamp), Objects::nonNull);
  }

  private boolean hasQueryCreatedEvent(UUID queryId, long timestamp) throws Exception {
    return findQueryCreatedEvent(queryId, timestamp) != null;
  }

  private ChangeEvent findQueryCreatedEvent(UUID queryId, long timestamp) throws Exception {
    ListResponse<ChangeEvent> events = queryChangeEvents(timestamp);
    if (events.getData() == null) {
      return null;
    }

    return events.getData().stream()
        .filter(
            event ->
                queryId.equals(event.getEntityId())
                    && event.getEventType() == EventType.ENTITY_CREATED)
        .findFirst()
        .orElse(null);
  }

  private ListResponse<ChangeEvent> queryChangeEvents(long timestamp) throws Exception {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("entityCreated", Entity.QUERY);
    queryParams.put("timestamp", Long.toString(timestamp));
    queryParams.put("limit", "1000");

    String responseJson =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                EVENTS_PATH,
                null,
                RequestOptions.builder().queryParams(queryParams).build());

    if (CommonUtil.nullOrEmpty(responseJson)) {
      return new ListResponse<>();
    }

    ListResponse<ChangeEvent> response =
        JsonUtils.readValue(responseJson, new TypeReference<ListResponse<ChangeEvent>>() {});

    return response == null ? new ListResponse<>() : response;
  }
}
