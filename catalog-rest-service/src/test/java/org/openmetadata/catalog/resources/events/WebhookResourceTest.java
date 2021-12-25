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

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
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

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;

public class WebhookResourceTest extends EntityResourceTest<Webhook> {
  public static List<EventFilter> ALL_EVENTS_FILTER = new ArrayList<>();

  static {
    ALL_EVENTS_FILTER.add(new EventFilter().withEventType(EventType.ENTITY_CREATED));
    ALL_EVENTS_FILTER.add(new EventFilter().withEventType(EventType.ENTITY_UPDATED));
    ALL_EVENTS_FILTER.add(new EventFilter().withEventType(EventType.ENTITY_DELETED));
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

  /**
   * At the end of the test, ensure all events are delivered over web subscription comparing it with number of events
   * stored in the system.
   */
  public void validateWebhookEvents() throws HttpResponseException, InterruptedException {
    // Check the healthy callback server received all the change events
    ConcurrentLinkedQueue<ChangeEvent> callbackEvents = webhookCallbackResource.getEvents();
    List<ChangeEvent> actualEvents =
        getChangeEvents(null, null, null, callbackEvents.peek().getDateTime(), adminAuthHeaders()).getData();
    int iteration = 0;
    while (callbackEvents.size() < actualEvents.size() && iteration < 10) {
      Thread.sleep(100);
      iteration++;
    }
    assertEquals(actualEvents.size(), callbackEvents.size());
    assertWebhookStatusSuccess("validWebhook");
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
    int iteration = 0;
    while(callbackEvents.size() == 0 && iteration < 100) {
      Thread.sleep(100);
      iteration++;
    }
    assertNotNull(callbackEvents.peek());

    List<ChangeEvent> actualEvents =
        getChangeEvents(null, null, null, callbackEvents.peek().getDateTime(), adminAuthHeaders()).getData();
    iteration = 0;
    while (callbackEvents.size() < actualEvents.size() - 1 && iteration < 30) {
      Thread.sleep(100);
      iteration++;
    }
    assertEquals(actualEvents.size(), callbackEvents.size());
    webhookCallbackResource.clearEventsSlowServer();

    // Check all webhook status
    assertWebhookStatusSuccess("slowServer");
    assertWebhookStatus("callbackResponse300", Status.ERROR, 301, "Moved Permanently");
    assertWebhookStatus("callbackResponse400", Status.AWAITING_RETRY, 400, "Bad Request");
    assertWebhookStatus("callbackResponse500", Status.AWAITING_RETRY, 500, "Internal Server Error");
    assertWebhookStatus("invalidEndpoint", Status.ERROR, null, "UnknownHostException");
  }

  public void createWebhook(String name, String uri) throws URISyntaxException, IOException {
    CreateWebhook createWebhook = createRequest(name, "", "", null).withEndPoint(URI.create(uri));
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
}
