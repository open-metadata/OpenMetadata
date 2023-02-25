package org.openmetadata.service.resources.events;

import static org.hibernate.validator.internal.util.Contracts.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.EventFilterRule.Effect.INCLUDE;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.ACTIVE;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.AWAITING_RETRY;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.DISABLED;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.FAILED;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Disabled
public class EventSubscriptionResourceTest extends EntityResourceTest<EventSubscription, CreateEventSubscription> {
  public static final FilteringRules PASS_ALL_FILTERING = new FilteringRules().withResources(List.of("all"));

  public EventSubscriptionResourceTest() {
    super(
        Entity.EVENT_SUBSCRIPTION,
        EventSubscription.class,
        EventSubscriptionResource.EventSubscriptionList.class,
        "events/subscription",
        EventSubscriptionResource.FIELDS);
    supportedNameCharacters = supportedNameCharacters.replace(" ", ""); // Space not supported
    supportsSoftDelete = false;
    supportsFieldsQueryParam = false;
    supportsEmptyDescription = true;
  }

  @Test
  void post_alertActionWithEnabledStateChange(TestInfo test) throws IOException {
    String webhookName = getEntityName(test);
    LOG.info("creating webhook in disabled state");
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/" + webhookName;
    // Create a Disabled Generic Webhook
    Webhook genericWebhook = getWebhook(uri);
    CreateEventSubscription genericWebhookActionRequest =
        createRequest(webhookName).withEnabled(false).withSubscriptionConfig(genericWebhook);
    EventSubscription alert = createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);
    // For the DISABLED Publisher are not available so it will have no status
    SubscriptionStatus status = getStatus(alert.getId(), Response.Status.OK.getStatusCode());
    assertEquals(DISABLED, status.getStatus());
    WebhookCallbackResource.EventDetails details = webhookCallbackResource.getEventDetails(webhookName);
    assertNull(details);
    //
    // Now enable the webhook
    //
    LOG.info("Enabling webhook Action");
    ChangeDescription change = getChangeDescription(alert.getVersion());
    fieldUpdated(change, "enabled", false, true);
    fieldUpdated(change, "batchSize", 10, 50);
    genericWebhookActionRequest.withEnabled(true).withBatchSize(50);

    alert =
        updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);

    SubscriptionStatus status2 = getStatus(alert.getId(), Response.Status.OK.getStatusCode());
    assertEquals(SubscriptionStatus.Status.ACTIVE, status2.getStatus());

    // Ensure the call back notification has started
    details = waitForFirstEvent(webhookName, 25);
    assertEquals(1, details.getEvents().size());
    SubscriptionStatus successDetails = getStatus(alert.getId(), Response.Status.OK.getStatusCode());
    assertEquals(SubscriptionStatus.Status.ACTIVE, successDetails.getStatus());
    assertNull(successDetails.getLastFailedAt());
    //
    // Disable the webhook and ensure notification is disabled
    //
    LOG.info("Disabling webhook");
    genericWebhookActionRequest.withEnabled(false);
    change = getChangeDescription(alert.getVersion());
    fieldUpdated(change, "enabled", true, false);

    // Disabled webhook state is DISABLED
    alert =
        updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);
    SubscriptionStatus status3 = getStatus(alert.getId(), Response.Status.OK.getStatusCode());
    assertEquals(DISABLED, status3.getStatus());

    int iterations = 0;
    while (iterations < 10) {
      Awaitility.await().atLeast(Duration.ofMillis(100L)).untilTrue(new AtomicBoolean(true));
      iterations++;
      assertEquals(1, details.getEvents().size()); // Event counter remains the same
    }

    deleteEntity(alert.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateEndpointURL(TestInfo test) throws IOException {
    String webhookName = getEntityName(test);
    LOG.info("creating webhook in disabled state");
    String uri = "http://invalidUnknowHost";
    Webhook genericWebhook = getWebhook(uri);
    CreateEventSubscription genericWebhookActionRequest =
        createRequest(webhookName)
            .withEnabled(true)
            .withSubscriptionType(CreateEventSubscription.SubscriptionType.GENERIC_WEBHOOK)
            .withSubscriptionConfig(genericWebhook);
    EventSubscription alert = createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);

    // Wait for webhook to be marked as failed
    Awaitility.await()
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(100 * 100L))
        .untilTrue(testExpectedStatus(alert.getId(), FAILED));

    SubscriptionStatus status = getStatus(alert.getId(), Response.Status.OK.getStatusCode());
    assertEquals(FAILED, status.getStatus());

    // Now change the webhook URL to a valid URL and ensure callbacks resume
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/" + test.getDisplayName();
    Webhook genericWebhook2 = getWebhook(baseUri);
    genericWebhookActionRequest = genericWebhookActionRequest.withSubscriptionConfig(genericWebhook2);
    ChangeDescription change = getChangeDescription(alert.getVersion());
    fieldUpdated(change, "subscriptionConfig", genericWebhook, genericWebhook2);

    alert =
        updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);

    // Wait for webhook to be marked as failed
    Awaitility.await()
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(100 * 100L))
        .untilTrue(testExpectedStatus(alert.getId(), ACTIVE));

    SubscriptionStatus status2 = getStatus(alert.getId(), Response.Status.OK.getStatusCode());
    assertEquals(SubscriptionStatus.Status.ACTIVE, status2.getStatus());
    deleteEntity(alert.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateAlertUpdateFields(TestInfo test) throws IOException {
    //
    String alertName = "filterUpdate";
    // Alert Action
    String endpoint =
        "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/counter/" + test.getDisplayName();
    Webhook genericWebhook = getWebhook(endpoint);
    CreateEventSubscription genericWebhookActionRequest =
        createRequest(alertName).withSubscriptionConfig(genericWebhook);

    FilteringRules rule1 =
        new FilteringRules()
            .withResources(List.of("all"))
            .withRules(
                List.of(
                    new EventFilterRule()
                        .withName("EventTypeCreated")
                        .withCondition("matchAnyEventType('entityCreated')")
                        .withEffect(INCLUDE)));

    FilteringRules rule2 =
        new FilteringRules()
            .withResources(List.of("all"))
            .withRules(
                List.of(
                    new EventFilterRule()
                        .withName("EventTypeCreated")
                        .withCondition("matchAnyEventType('entityCreated', 'entityUpdated', 'entityDeleted')")
                        .withEffect(INCLUDE)));

    FilteringRules rule3 =
        new FilteringRules()
            .withResources(List.of("all"))
            .withRules(
                List.of(
                    new EventFilterRule()
                        .withName("EventTypeCreated")
                        .withCondition("matchAnyEventType('entityUpdated', 'entityDeleted')")
                        .withEffect(INCLUDE)));

    FilteringRules rule4 =
        new FilteringRules()
            .withResources(List.of("all"))
            .withRules(
                List.of(
                    new EventFilterRule()
                        .withName("EventTypeCreated")
                        .withCondition("matchAnyEventType('entityUpdated')")
                        .withEffect(INCLUDE)));

    // Set Filter Rules
    genericWebhookActionRequest.withFilteringRules(rule1);
    EventSubscription createdAlert = createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);

    // Rule 2
    ChangeDescription change = getChangeDescription(createdAlert.getVersion());
    fieldUpdated(change, "filteringRules", rule1, rule2);
    genericWebhookActionRequest.withFilteringRules(rule2);

    createdAlert =
        updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);

    // Rule 3
    change = getChangeDescription(createdAlert.getVersion());
    fieldUpdated(change, "filteringRules", rule2, rule3);
    genericWebhookActionRequest.withFilteringRules(rule3);

    createdAlert =
        updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);

    // Rule 4
    change = getChangeDescription(createdAlert.getVersion());
    fieldUpdated(change, "filteringRules", rule3, rule4);
    genericWebhookActionRequest.withFilteringRules(rule4);

    createdAlert =
        updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);

    // Delete Action and Alert
    deleteEntity(createdAlert.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDifferentTypesOfAlerts() throws IOException {
    // Create multiple webhooks each with different type of response to callback

    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook";

    // SlowServer
    String alertName = "slowServer";
    // Alert Action
    Webhook w1 = getWebhook(baseUri + "/simulate/slowServer"); // Callback response 1 second slower
    CreateEventSubscription w1ActionRequest = createRequest(alertName).withSubscriptionConfig(w1);
    EventSubscription w1Alert = createAndCheckEntity(w1ActionRequest, ADMIN_AUTH_HEADERS);

    // CallbackTimeout
    alertName = "callbackTimeout";
    Webhook w2 = getWebhook(baseUri + "/simulate/timeout"); // Callback response 12 seconds slower
    CreateEventSubscription w2ActionRequest = createRequest(alertName).withSubscriptionConfig(w2);
    EventSubscription w2Alert = createAndCheckEntity(w2ActionRequest, ADMIN_AUTH_HEADERS);

    // callbackResponse300
    alertName = "callbackResponse300";
    Webhook w3 = getWebhook(baseUri + "/simulate/300"); // 3xx response
    CreateEventSubscription w3ActionRequest = createRequest(alertName).withSubscriptionConfig(w3);
    EventSubscription w3Alert = createAndCheckEntity(w3ActionRequest, ADMIN_AUTH_HEADERS);

    // callbackResponse400
    alertName = "callbackResponse400";
    Webhook w4 = getWebhook(baseUri + "/simulate/400"); // 3xx response
    CreateEventSubscription w4ActionRequest = createRequest(alertName).withSubscriptionConfig(w4);
    EventSubscription w4Alert = createAndCheckEntity(w4ActionRequest, ADMIN_AUTH_HEADERS);

    // callbackResponse500
    alertName = "callbackResponse500";
    Webhook w5 = getWebhook(baseUri + "/simulate/500"); // 3xx response
    CreateEventSubscription w5ActionRequest = createRequest(alertName).withSubscriptionConfig(w5);
    EventSubscription w5Alert = createAndCheckEntity(w5ActionRequest, ADMIN_AUTH_HEADERS);

    // invalidEndpoint
    alertName = "invalidEndpoint";
    Webhook w6 = getWebhook("http://invalidUnknownHost"); // 3xx response
    CreateEventSubscription w6ActionRequest = createRequest(alertName).withSubscriptionConfig(w6);
    EventSubscription w6Alert = createAndCheckEntity(w6ActionRequest, ADMIN_AUTH_HEADERS);

    // Now check state of webhooks created
    WebhookCallbackResource.EventDetails details = waitForFirstEvent("simulate-slowServer", 25);
    ConcurrentLinkedQueue<ChangeEvent> callbackEvents = details.getEvents();
    assertNotNull(callbackEvents.peek());

    waitAndCheckForEvents("*", "*", "*", callbackEvents.peek().getTimestamp(), callbackEvents, 30);

    // Check all webhook status
    assertAlertStatusSuccessWithId(w1Alert.getId());
    assertAlertStatus(w3Alert.getId(), FAILED, 301, "Moved Permanently");
    assertAlertStatus(w4Alert.getId(), AWAITING_RETRY, 400, "Bad Request");
    assertAlertStatus(w5Alert.getId(), AWAITING_RETRY, 500, "Internal Server Error");
    assertAlertStatus(w6Alert.getId(), FAILED, 400, "UnknownHostException");

    // Delete all webhooks
    deleteEntity(w1Alert.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w2Alert.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w3Alert.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w4Alert.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w5Alert.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w6Alert.getId(), ADMIN_AUTH_HEADERS);
  }

  private AtomicBoolean testExpectedStatus(UUID id, SubscriptionStatus.Status expectedStatus)
      throws HttpResponseException {
    SubscriptionStatus status = getStatus(id, Response.Status.OK.getStatusCode());
    LOG.info("webhook status {}", status.getStatus());
    return new AtomicBoolean(status.getStatus() == expectedStatus);
  }

  /**
   * Before a test for every entity resource, create a webhook subscription. At the end of the test, ensure all events
   * are delivered over web subscription comparing it with number of events stored in the system.
   */
  public void startWebhookSubscription(boolean enabled) throws IOException {
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/healthy";
    Webhook webhook = getWebhook(baseUri);
    CreateEventSubscription genericWebhookActionRequest = createRequest("healthy").withSubscriptionConfig(webhook);
    createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);
  }

  /**
   * At the end of the test, ensure all events are delivered over web subscription comparing it with number of events
   * stored in the system.
   */
  public void validateWebhookEvents() throws HttpResponseException {
    // Check the healthy callback server received all the change events
    WebhookCallbackResource.EventDetails details = webhookCallbackResource.getEventDetails("healthy");
    assertNotNull(details);
    ConcurrentLinkedQueue<ChangeEvent> callbackEvents = details.getEvents();
    assertNotNull(callbackEvents);
    assertNotNull(callbackEvents.peek());
    waitAndCheckForEvents("*", "*", "*", callbackEvents.peek().getTimestamp(), callbackEvents, 40);
    assertAlertStatusSuccessWithName("healthy");
  }

  /** At the end of the test, ensure all events are delivered for the combination of entity and eventTypes */
  public void validateWebhookEntityEvents(String entity) throws HttpResponseException {
    // Check the healthy callback server received all the change events
    // For the entity all the webhooks registered for created events have the right number of events
    List<ChangeEvent> callbackEvents =
        webhookCallbackResource.getEntityCallbackEvents(EventType.ENTITY_CREATED, entity);
    assertTrue(callbackEvents.size() > 0);
    long timestamp = callbackEvents.get(0).getTimestamp();
    waitAndCheckForEvents(entity, null, null, timestamp, callbackEvents, 30);

    // For the entity all the webhooks registered for updated events have the right number of events
    callbackEvents = webhookCallbackResource.getEntityCallbackEvents(EventType.ENTITY_UPDATED, entity);
    // Use previous date if no update events
    timestamp = callbackEvents.size() > 0 ? callbackEvents.get(0).getTimestamp() : timestamp;
    waitAndCheckForEvents(null, entity, null, timestamp, callbackEvents, 30);

    // TODO add delete event support
  }

  public void waitAndCheckForEvents(
      String entityCreated,
      String entityUpdated,
      String entityDeleted,
      long timestamp,
      Collection<ChangeEvent> callbackEvents,
      int iteration)
      throws HttpResponseException {
    List<ChangeEvent> expected =
        getChangeEvents(entityCreated, entityUpdated, entityDeleted, timestamp, ADMIN_AUTH_HEADERS).getData();
    Awaitility.await()
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(iteration * 100L))
        .untilTrue(receivedAllEvents(expected, callbackEvents));
    if (expected.size() != callbackEvents.size()) { // Failed to receive all the events
      expected.forEach(
          c1 ->
              LOG.info(
                  "expected {}:{}:{}:{}", c1.getTimestamp(), c1.getEventType(), c1.getEntityType(), c1.getEntityId()));
      callbackEvents.forEach(
          c1 ->
              LOG.info(
                  "received {}:{}:{}:{}", c1.getTimestamp(), c1.getEventType(), c1.getEntityType(), c1.getEntityId()));
    }
    assertEquals(expected.size(), callbackEvents.size());
  }

  public void assertAlertStatusSuccessWithId(UUID alertId) throws HttpResponseException {
    SubscriptionStatus status = getStatus(alertId, Response.Status.OK.getStatusCode());
    assertEquals(SubscriptionStatus.Status.ACTIVE, status.getStatus());
    assertNull(status.getLastFailedAt());
  }

  public void assertAlertStatusSuccessWithName(String alertName) throws HttpResponseException {
    EventSubscription alert = getEntityByName(alertName, null, "", ADMIN_AUTH_HEADERS);
    testExpectedStatus(alert.getId(), ACTIVE);
  }

  public void assertAlertStatus(UUID alertId, SubscriptionStatus.Status status, Integer statusCode, String failedReason)
      throws HttpResponseException {
    SubscriptionStatus actionStatus = getStatus(alertId, Response.Status.OK.getStatusCode());
    assertEquals(status, actionStatus.getStatus());
    assertEquals(statusCode, actionStatus.getLastFailedStatusCode());
    assertEquals(failedReason, actionStatus.getLastFailedReason());
  }

  private SubscriptionStatus getStatus(UUID alertId, int statusCode) throws HttpResponseException {
    WebTarget target = getResource(String.format("%s/%s/status", collectionName, alertId));
    return TestUtils.getWithResponse(target, SubscriptionStatus.class, ADMIN_AUTH_HEADERS, statusCode);
  }

  private static AtomicBoolean receivedAllEvents(List<ChangeEvent> expected, Collection<ChangeEvent> callbackEvents) {
    LOG.info("expected size {} callback events size {}", expected.size(), callbackEvents.size());
    return new AtomicBoolean(expected.size() == callbackEvents.size());
  }

  /** Start webhook subscription for given entity and various event types */
  public void startWebhookEntitySubscriptions(String entity) throws IOException {
    String alertName = EventType.ENTITY_CREATED + "_" + entity;
    // Alert Action
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/filterBased";
    String uri = baseUri + "/" + EventType.ENTITY_CREATED + "/" + entity;

    // Alert Action
    Webhook genericWebhook = getWebhook(uri); // Callback response 1 second slower
    CreateEventSubscription genericWebhookActionRequest =
        createRequest(alertName).withSubscriptionConfig(genericWebhook);
    genericWebhookActionRequest.setFilteringRules(
        new FilteringRules()
            .withResources(List.of(entity))
            .withRules(
                List.of(
                    new EventFilterRule()
                        .withName("EventTypeCreated")
                        .withCondition("matchAnyEventType('entityCreated')")
                        .withEffect(INCLUDE))));
    createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);

    // Create webhook with endpoint api/v1/test/webhook/entityUpdated/<entity> to receive entityUpdated events
    alertName = EventType.ENTITY_UPDATED + "_" + entity;
    uri = baseUri + "/" + EventType.ENTITY_UPDATED + "/" + entity;

    Webhook genericWebhook2 = getWebhook(uri); // Callback response 1 second slower
    CreateEventSubscription genericWebhookActionRequest2 =
        createRequest(alertName).withSubscriptionConfig(genericWebhook2);
    genericWebhookActionRequest2.setFilteringRules(
        new FilteringRules()
            .withResources(List.of(entity))
            .withRules(
                List.of(
                    new EventFilterRule()
                        .withName("EventTypeUpdated")
                        .withCondition("matchAnyEventType('entityUpdated')")
                        .withEffect(INCLUDE))));
    createAndCheckEntity(genericWebhookActionRequest2, ADMIN_AUTH_HEADERS);

    // TODO entity deleted events
  }

  @Override
  public CreateEventSubscription createRequest(String name) {
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/ignore";
    return new CreateEventSubscription()
        .withName(name)
        .withFilteringRules(PASS_ALL_FILTERING)
        .withSubscriptionType(CreateEventSubscription.SubscriptionType.GENERIC_WEBHOOK)
        .withSubscriptionConfig(getWebhook(uri))
        .withEnabled(true)
        .withBatchSize(10);
  }

  @Override
  public void validateCreatedEntity(
      EventSubscription createdEntity, CreateEventSubscription createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), createdEntity.getName());
    assertEquals(createRequest.getFilteringRules(), createdEntity.getFilteringRules());
    assertEquals(createRequest.getSubscriptionType(), createdEntity.getSubscriptionType());
  }

  @Override
  public void compareEntities(EventSubscription expected, EventSubscription updated, Map<String, String> authHeaders) {}

  @Override
  public EventSubscription validateGetWithDifferentFields(EventSubscription entity, boolean byName) {
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}

  public Webhook getWebhook(String uri) {
    return new Webhook().withEndpoint(URI.create(uri)).withSecretKey("webhookTest");
  }

  public WebhookCallbackResource.EventDetails waitForFirstEvent(String endpoint, int iteration) {
    Awaitility.await()
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(iteration * 100L))
        .untilFalse(hasEventOccurred(endpoint));
    WebhookCallbackResource.EventDetails details = webhookCallbackResource.getEventDetails(endpoint);
    LOG.info("Returning for endpoint {} eventDetails {}", endpoint, details);
    return details;
  }

  private AtomicBoolean hasEventOccurred(String endpoint) {
    WebhookCallbackResource.EventDetails details = webhookCallbackResource.getEventDetails(endpoint);
    return new AtomicBoolean(details != null && details.getEvents() != null && details.getEvents().size() <= 0);
  }
}
