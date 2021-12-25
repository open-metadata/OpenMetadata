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

package org.openmetadata.catalog.resources.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.events.CreateWebhook;
import org.openmetadata.catalog.jdbi3.WebhookRepository.WebhookEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.events.WebhookResource.WebhookList;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventFilter;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.type.Webhook.Status;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;

public class WebhookResourceTest extends EntityResourceTest<Webhook> {
  public static List<EventFilter> ALL_EVENTS_FILTER = new ArrayList<>();

  static {
    ALL_EVENTS_FILTER.add(new EventFilter().withEventType(EventType.ENTITY_CREATED).withEntities(List.of("*")));
    ALL_EVENTS_FILTER.add(new EventFilter().withEventType(EventType.ENTITY_UPDATED).withEntities(List.of("*")));
    ALL_EVENTS_FILTER.add(new EventFilter().withEventType(EventType.ENTITY_DELETED).withEntities(List.of("*")));
  }

  public WebhookResourceTest() {
    super(Entity.WEBHOOK, Webhook.class, WebhookList.class, "webhook", "", false, false, false);
    supportsPatch = false;
  }

  @Test
  public void post_webhookEnabledStateChange() throws URISyntaxException, IOException, InterruptedException {
    // Disabled webhook will not start webhook publisher
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/counter";
    CreateWebhook create =
        createRequest("disabledWebhook", "", "", null).withEnabled(false).withEndPoint(URI.create(uri));
    Webhook webhook = createAndCheckEntity(create, adminAuthHeaders());
    assertEquals(Status.NOT_STARTED, webhook.getStatus());
    Webhook getWebhook = getEntity(webhook.getId(), adminAuthHeaders());
    assertEquals(Status.NOT_STARTED, getWebhook.getStatus());
    assertEquals(0, webhookCallbackResource.getCount());

    // Now enable the webhook
    int counter = webhookCallbackResource.getCount();
    create.withEnabled(true);
    getWebhook = updateEntity(create, Response.Status.OK, adminAuthHeaders());
    assertEquals(Status.SUCCESS, getWebhook.getStatus());
    getWebhook = getEntity(webhook.getId(), adminAuthHeaders());
    assertEquals(Status.SUCCESS, getWebhook.getStatus());

    // Change event for webhook enabling is received to ensure the call back has started
    int iterations = 0;
    while (webhookCallbackResource.getCount() <= counter && iterations < 100) {
      Thread.sleep(10);
      iterations++;
    }
    assertEquals(counter + 1, webhookCallbackResource.getCount());

    // Disable the webhook and ensure it is disabled
    create.withEnabled(false);
    getWebhook = updateEntity(create, Response.Status.OK, adminAuthHeaders());
    assertEquals(Status.NOT_STARTED, getWebhook.getStatus());
    getWebhook = getEntity(webhook.getId(), adminAuthHeaders());
    assertEquals(Status.NOT_STARTED, getWebhook.getStatus());

    // Ensure callback is disabled and no further events are received
    iterations = 0;
    while (iterations < 100) {
      Thread.sleep(10);
      iterations++;
      assertEquals(counter + 1, webhookCallbackResource.getCount()); // Event counter remains the same
    }
  }

  @Override
  public CreateWebhook createRequest(String name, String description, String displayName, EntityReference owner)
      throws URISyntaxException {
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/ignore";
    return new CreateWebhook()
        .withName(name)
        .withDescription(description)
        .withEventFilters(ALL_EVENTS_FILTER)
        .withEndPoint(URI.create(uri))
        .withBatchSize(100);
  }

  @Override
  public void validateCreatedEntity(Webhook webhook, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateWebhook createRequest = (CreateWebhook) request;
    validateCommonEntityFields(
        getEntityInterface(webhook), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), webhook.getName());
    assertEquals(createRequest.getEventFilters(), webhook.getEventFilters());
  }

  @Override
  public void validateUpdatedEntity(Webhook webhook, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(webhook, request, authHeaders);
  }

  @Override
  public void compareEntities(Webhook expected, Webhook updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Patch not supported
  }

  @Override
  public EntityInterface<Webhook> getEntityInterface(Webhook entity) {
    return new WebhookEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(Webhook entity, boolean byName) throws HttpResponseException {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {}

  /**
   * Before a test for every entity resource, create a webhook subscription. At the end of the test, ensure all events
   * are delivered over web subscription comparing it with number of events stored in the system.
   */
  public void startWebhookSubscription() throws IOException, URISyntaxException {
    // Valid webhook callback
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook";
    CreateWebhook createWebhook =
        createRequest("validWebhook", "validWebhook", "", null).withEndPoint(URI.create(baseUri));
    createEntity(createWebhook, adminAuthHeaders());
  }

  /** Start webhook subscription for given entity and various event types */
  public void startWebhookEntitySubscriptions(String entity) throws IOException, URISyntaxException {
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook";

    // Create webhook with endpoint api/v1/test/webhook/entityCreated/<entity> to receive entityCreated events
    String name = EventType.ENTITY_CREATED + ":" + entity;
    String uri = baseUri + "/" + EventType.ENTITY_CREATED + "/" + entity;
    List<EventFilter> filters =
        List.of(new EventFilter().withEventType(EventType.ENTITY_CREATED).withEntities(List.of(entity)));
    createWebhook(name, uri, filters);

    // Create webhook with endpoint api/v1/test/webhook/entityUpdated/<entity> to receive entityUpdated events
    name = EventType.ENTITY_UPDATED + ":" + entity;
    uri = baseUri + "/" + EventType.ENTITY_UPDATED + "/" + entity;
    filters = List.of(new EventFilter().withEventType(EventType.ENTITY_UPDATED).withEntities(List.of(entity)));
    createWebhook(name, uri, filters);

    // TODO entity deleted events
  }

  /**
   * At the end of the test, ensure all events are delivered over web subscription comparing it with number of events
   * stored in the system.
   */
  public void validateWebhookEvents() throws HttpResponseException, InterruptedException {
    // Check the healthy callback server received all the change events
    ConcurrentLinkedQueue<ChangeEvent> callbackEvents = webhookCallbackResource.getEvents();
    List<ChangeEvent> actualEvents =
        getChangeEvents("*", "*", "*", callbackEvents.peek().getDateTime(), adminAuthHeaders()).getData();
    waitAndCheckForEvents(callbackEvents, actualEvents, 10, 100);
    assertWebhookStatusSuccess("validWebhook");
  }

  /** At the end of the test, ensure all events are delivered for the combination of entity and eventTypes */
  public void validateWebhookEntityEvents(String entity) throws HttpResponseException, InterruptedException {
    // Check the healthy callback server received all the change events
    // For the entity all the webhooks registered for created events have the right number of events
    List<ChangeEvent> callbackEvents =
        webhookCallbackResource.getEntityCallbackEvents(EventType.ENTITY_CREATED, entity);
    Date date = callbackEvents.get(0).getDateTime();
    List<ChangeEvent> events = getChangeEvents(entity, null, null, date, adminAuthHeaders()).getData();
    waitAndCheckForEvents(callbackEvents, events, 30, 100);

    // For the entity all the webhooks registered for updated events have the right number of events
    callbackEvents = webhookCallbackResource.getEntityCallbackEvents(EventType.ENTITY_UPDATED, entity);
    // Use previous date if no update events
    date = callbackEvents.size() > 0 ? callbackEvents.get(0).getDateTime() : date;
    events = getChangeEvents(null, entity, null, date, adminAuthHeaders()).getData();
    waitAndCheckForEvents(callbackEvents, events, 30, 100);

    // TODO add delete event support
  }

  @Test
  public void testDifferentTypesOfWebhooks() throws IOException, InterruptedException, URISyntaxException {
    Thread.sleep(1000);
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook";

    // Create multiple webhooks each with different type of response to callback
    createWebhook("slowServer", baseUri + "/slowServer"); // Callback response 1 second slower
    createWebhook("callbackTimeout", baseUri + "/timeout"); // Callback response 12 seconds slower
    createWebhook("callbackResponse300", baseUri + "/300"); // 3xx response
    createWebhook("callbackResponse400", baseUri + "/400"); // 4xx response
    createWebhook("callbackResponse500", baseUri + "/500"); // 5xx response
    createWebhook("invalidEndpoint", "http://invalidUnknownHost"); // Invalid URL

    // Now check state of webhooks created
    ConcurrentLinkedQueue<ChangeEvent> callbackEvents = webhookCallbackResource.getEventsSlowServer();
    waitForFirstEvent(callbackEvents, 100, 100);
    assertNotNull(callbackEvents.peek());

    Thread.sleep(1000); // Wait for change events to be recorded

    List<ChangeEvent> actualEvents =
        getChangeEvents("*", "*", "*", callbackEvents.peek().getDateTime(), adminAuthHeaders()).getData();
    waitAndCheckForEvents(callbackEvents, actualEvents, 30, 100);
    webhookCallbackResource.clearEventsSlowServer();

    // Check all webhook status
    assertWebhookStatusSuccess("slowServer");
    assertWebhookStatus("callbackResponse300", Status.FAILED, 301, "Moved Permanently");
    assertWebhookStatus("callbackResponse400", Status.AWAITING_RETRY, 400, "Bad Request");
    assertWebhookStatus("callbackResponse500", Status.AWAITING_RETRY, 500, "Internal Server Error");
    assertWebhookStatus("invalidEndpoint", Status.FAILED, null, "UnknownHostException");
  }

  public void createWebhook(String name, String uri) throws URISyntaxException, IOException {
    createWebhook(name, uri, ALL_EVENTS_FILTER);
  }

  public void createWebhook(String name, String uri, List<EventFilter> filters) throws URISyntaxException, IOException {
    CreateWebhook createWebhook =
        createRequest(name, "", "", null).withEndPoint(URI.create(uri)).withEventFilters(filters);
    createAndCheckEntity(createWebhook, adminAuthHeaders());
  }

  public void assertWebhookStatusSuccess(String name) throws HttpResponseException {
    Webhook webhook = getEntityByName(name, "", adminAuthHeaders());
    assertEquals(Status.SUCCESS, webhook.getStatus());
    assertNull(webhook.getFailureDetails());
  }

  public void assertWebhookStatus(String name, Status status, Integer statusCode, String failedReason)
      throws HttpResponseException {
    Webhook webhook = getEntityByName(name, "", adminAuthHeaders());
    assertEquals(status, webhook.getStatus());
    assertEquals(statusCode, webhook.getFailureDetails().getLastFailedStatusCode());
    assertEquals(failedReason, webhook.getFailureDetails().getLastFailedReason());
  }

  public void waitAndCheckForEvents(
      Collection<ChangeEvent> expected, Collection<ChangeEvent> received, int iteration, long sleepMillis)
      throws InterruptedException {
    while (expected.size() < received.size() && iteration < 10) {
      Thread.sleep(sleepMillis);
      iteration++;
    }
    if (expected.size() != received.size()) {
      expected.forEach(
          c1 ->
              LOG.info(
                  "expected {}:{}:{}:{}",
                  c1.getDateTime().getTime(),
                  c1.getEventType(),
                  c1.getEntityType(),
                  c1.getEntityId()));
      received.forEach(
          c1 ->
              LOG.info(
                  "received {}:{}:{}:{}",
                  c1.getDateTime().getTime(),
                  c1.getEventType(),
                  c1.getEntityType(),
                  c1.getEntityId()));
    }
    assertEquals(expected.size(), received.size());
  }

  public void waitForFirstEvent(Collection c1, int iteration, long sleepMillis) throws InterruptedException {
    while (c1.size() > 0 && iteration < 10) {
      Thread.sleep(sleepMillis);
      iteration++;
    }
  }
}
