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

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Query create, update and delete produce change events like any other entity, so they can be
 * consumed through /v1/events, alerts and webhooks.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class QueryChangeEventIT {

  private static final String EVENTS_PATH = "/v1/events";

  @Test
  void test_changeEventForQueryCreate(TestNamespace ns) {
    long timestamp = System.currentTimeMillis();
    Query query = createQuery(ns, "created");

    ChangeEvent changeEvent =
        awaitQueryChangeEvent(query.getId(), EventType.ENTITY_CREATED, timestamp);

    assertEquals(Entity.QUERY, changeEvent.getEntityType());
    assertEquals(query.getFullyQualifiedName(), changeEvent.getEntityFullyQualifiedName());
  }

  @Test
  void test_changeEventForQueryUpdate(TestNamespace ns) {
    Query query = createQuery(ns, "updated");

    long timestamp = System.currentTimeMillis();
    SdkClients.adminClient()
        .queries()
        .update(query.getId().toString(), query.withDescription("Updated query description"));

    ChangeEvent changeEvent =
        awaitQueryChangeEvent(query.getId(), EventType.ENTITY_UPDATED, timestamp);

    assertEquals(Entity.QUERY, changeEvent.getEntityType());
  }

  @Test
  void test_changeEventForQueryDelete(TestNamespace ns) {
    Query query = createQuery(ns, "deleted");

    long timestamp = System.currentTimeMillis();
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().queries().delete(query.getId().toString(), params);

    ChangeEvent changeEvent =
        awaitQueryChangeEvent(query.getId(), EventType.ENTITY_DELETED, timestamp);

    assertEquals(Entity.QUERY, changeEvent.getEntityType());
  }

  private Query createQuery(TestNamespace ns, String name) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    return SdkClients.adminClient()
        .queries()
        .create(
            new CreateQuery()
                .withName(ns.prefix(name))
                .withDescription("Query created by the query change event test")
                .withQuery("SELECT * FROM " + ns.prefix(name))
                .withService(service.getFullyQualifiedName())
                .withQueryDate(System.currentTimeMillis()));
  }

  private ChangeEvent awaitQueryChangeEvent(UUID queryId, EventType eventType, long timestamp) {
    return Awaitility.await("Wait for the " + eventType + " event of query " + queryId)
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .until(() -> findQueryChangeEvent(queryId, eventType, timestamp), Objects::nonNull);
  }

  private ChangeEvent findQueryChangeEvent(UUID queryId, EventType eventType, long timestamp)
      throws Exception {
    ListResponse<ChangeEvent> events = queryChangeEvents(eventType, timestamp);
    if (events.getData() == null) {
      return null;
    }

    return events.getData().stream()
        .filter(event -> queryId.equals(event.getEntityId()) && event.getEventType() == eventType)
        .findFirst()
        .orElse(null);
  }

  private ListResponse<ChangeEvent> queryChangeEvents(EventType eventType, long timestamp)
      throws Exception {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put(eventFilterParam(eventType), Entity.QUERY);
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

  private String eventFilterParam(EventType eventType) {
    return switch (eventType) {
      case ENTITY_CREATED -> "entityCreated";
      case ENTITY_UPDATED -> "entityUpdated";
      case ENTITY_DELETED -> "entityDeleted";
      default -> throw new IllegalArgumentException("Unsupported event type " + eventType);
    };
  }
}
