package org.openmetadata.service.resources.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.validateEntityReferences;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.events.CreateAlert;
import org.openmetadata.schema.api.events.CreateAlertAction;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.entity.alerts.AlertActionStatus;
import org.openmetadata.schema.entity.alerts.AlertFilterRule;
import org.openmetadata.schema.entity.alerts.TriggerConfig;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.alerts.AlertResource;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AlertResourceTest extends EntityResourceTest<Alert, CreateAlert> {
  public static final TriggerConfig ALL_EVENTS_FILTER =
      new TriggerConfig().withType(TriggerConfig.AlertTriggerType.ALL_DATA_ASSETS);

  private final AlertActionResourceTest alertActionResourceTest;
  private EntityReference alert_action_ref;

  public AlertResourceTest() {
    super(Entity.ALERT, Alert.class, AlertResource.AlertList.class, "alerts", AlertResource.FIELDS);
    supportedNameCharacters = supportedNameCharacters.replace(" ", ""); // Space not supported
    supportsSoftDelete = false;
    supportsFieldsQueryParam = false;
    supportsEmptyDescription = true;
    alertActionResourceTest = new AlertActionResourceTest();
  }

  @BeforeEach
  public void setupAlerts() throws IOException {
    CreateAlertAction alertAction =
        alertActionResourceTest.createRequest(String.format("genericAlert_%s", UUID.randomUUID()));
    AlertAction alert_action = alertActionResourceTest.createAndCheckEntity(alertAction, ADMIN_AUTH_HEADERS);
    alert_action_ref = alert_action.getEntityReference();
  }

  @Test
  void post_alertActionWithEnabledStateChange(TestInfo test) throws IOException {
    //
    // Create alert with AlertAction in disabled state. It will not start webhook publisher
    //
    String webhookName = getEntityName(test);
    LOG.info("creating webhook in disabled state");
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/" + webhookName;
    Webhook genericWebhook = getWebhook(webhookName, uri);
    CreateAlertAction genericWebhookActionRequest =
        alertActionResourceTest
            .createRequest(webhookName, AlertAction.AlertActionType.GENERIC_WEBHOOK, genericWebhook, false)
            .withBatchSize(10);
    AlertAction genericWebhookAction =
        alertActionResourceTest.createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);
    Alert alert =
        createAlert(
            webhookName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(genericWebhookAction.getEntityReference()));

    // For the DISABLED Action Publisher are not available so it will have no status
    AlertActionStatus status =
        getStatus(alert.getId(), genericWebhookAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.DISABLED, status.getStatus());
    WebhookCallbackResource.EventDetails details = webhookCallbackResource.getEventDetails(webhookName);
    assertNull(details);
    //
    // Now enable the webhook
    //
    LOG.info("Enabling webhook Action");
    ChangeDescription change = getChangeDescription(genericWebhookAction.getVersion());
    fieldUpdated(change, "enabled", false, true);
    fieldUpdated(change, "batchSize", 10, 50);
    genericWebhookActionRequest.withEnabled(true).withBatchSize(50);

    genericWebhookAction =
        alertActionResourceTest.updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);
    AlertActionStatus status2 =
        getStatus(alert.getId(), genericWebhookAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.ACTIVE, status2.getStatus());

    // Ensure the call back notification has started
    details = waitForFirstEvent(webhookName, 25);
    assertEquals(1, details.getEvents().size());
    AlertActionStatus successDetails =
        getStatus(alert.getId(), genericWebhookAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.ACTIVE, successDetails.getStatus());
    assertNull(successDetails.getFailureDetails());
    //
    // Disable the webhook and ensure notification is disabled
    //
    LOG.info("Disabling webhook");
    genericWebhookActionRequest.withEnabled(false);
    change = getChangeDescription(genericWebhookAction.getVersion());
    fieldUpdated(change, "enabled", true, false);

    // Disabled webhook state is DISABLED
    genericWebhookAction =
        alertActionResourceTest.updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);
    AlertActionStatus status3 =
        getStatus(alert.getId(), genericWebhookAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.DISABLED, status3.getStatus());

    int iterations = 0;
    while (iterations < 10) {
      Awaitility.await().atLeast(Duration.ofMillis(100L)).untilTrue(new AtomicBoolean(true));
      iterations++;
      assertEquals(1, details.getEvents().size()); // Event counter remains the same
    }

    alertActionResourceTest.deleteEntity(genericWebhookAction.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(alert.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateEndpointURL(TestInfo test) throws IOException {
    String webhookName = getEntityName(test);
    LOG.info("creating webhook in disabled state");
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/" + webhookName;
    Webhook genericWebhook = getWebhook(webhookName, uri).withEndpoint(URI.create("http://invalidUnknowHost"));
    CreateAlertAction genericWebhookActionRequest =
        alertActionResourceTest
            .createRequest(webhookName, AlertAction.AlertActionType.GENERIC_WEBHOOK, genericWebhook, true)
            .withBatchSize(10);
    AlertAction genericWebhookAction =
        alertActionResourceTest.createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);

    Alert alert =
        createAlert(
            webhookName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(genericWebhookAction.getEntityReference()));

    // Wait for webhook to be marked as failed
    Awaitility.await()
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(100 * 100L))
        .untilTrue(hasWebHookFailed(alert.getId(), genericWebhookAction.getId()));

    AlertActionStatus status =
        getStatus(alert.getId(), genericWebhookAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.FAILED, status.getStatus());

    // Now change the webhook URL to a valid URL and ensure callbacks resume
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/" + test.getDisplayName();
    Webhook genericWebhook2 = getWebhook(webhookName, uri).withEndpoint(URI.create(baseUri));
    genericWebhookActionRequest = genericWebhookActionRequest.withAlertActionConfig(genericWebhook2);
    ChangeDescription change = getChangeDescription(genericWebhookAction.getVersion());
    fieldUpdated(change, "alertActionConfig", genericWebhook, genericWebhook2);

    genericWebhookAction =
        alertActionResourceTest.updateAndCheckEntity(
            genericWebhookActionRequest,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS,
            TestUtils.UpdateType.MINOR_UPDATE,
            change);

    AlertActionStatus status3 =
        getStatus(alert.getId(), genericWebhookAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.ACTIVE, status3.getStatus());
    assertNull(status3.getFailureDetails());

    alertActionResourceTest.deleteEntity(genericWebhookAction.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(alert.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  @Override
  protected void post_delete_entityWithOwner_200(TestInfo test) throws IOException {
    if (!supportsOwner) {
      return;
    }

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    Team team = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Entity with user as owner is created successfully. Owner should be able to delete the dentity
    Alert entity1 = createAndCheckEntity(createRequest(getEntityName(test, 1), "", "", USER1_REF), ADMIN_AUTH_HEADERS);
    deleteEntity(entity1.getId(), true, true, authHeaders(USER1.getName()));
    assertEntityDeleted(entity1.getId(), true);

    // Entity with team as owner is created successfully
    setupAlerts();
    Alert entity2 =
        createAndCheckEntity(
            createRequest(getEntityName(test, 2), "", "", team.getEntityReference()), ADMIN_AUTH_HEADERS);

    // As ADMIN delete the team and ensure the entity still exists but with owner as deleted
    teamResourceTest.deleteEntity(team.getId(), ADMIN_AUTH_HEADERS);
    entity2 = getEntity(entity2.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
    assertTrue(entity2.getOwner().getDeleted());
  }

  @Test
  void put_updateAlertUpdateFields(TestInfo test) throws IOException {
    //
    String alertName = "filterUpdate";
    // Alert Action
    String endpoint =
        "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/counter/" + test.getDisplayName();
    Webhook genericWebhook = getWebhook(alertName, endpoint);
    CreateAlertAction genericWebhookActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, genericWebhook, true)
            .withBatchSize(10);
    AlertAction genericWebhookAction =
        alertActionResourceTest.createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);

    // Alert
    TriggerConfig triggerConfig =
        new TriggerConfig().withType(TriggerConfig.AlertTriggerType.ALL_DATA_ASSETS).withEntities(new HashSet<>());
    AlertFilterRule rule1 =
        new AlertFilterRule()
            .withName("EventTypeCreated")
            .withCondition("matchAnyEventType('entityCreated')")
            .withEffect(AlertFilterRule.Effect.INCLUDE);

    AlertFilterRule rule2 =
        new AlertFilterRule()
            .withName("EventTypeCreated")
            .withCondition("matchAnyEventType('entityCreated', 'entityUpdated', 'entityDeleted')")
            .withEffect(AlertFilterRule.Effect.INCLUDE);

    AlertFilterRule rule3 =
        new AlertFilterRule()
            .withName("EventTypeCreated")
            .withCondition("matchAnyEventType('entityUpdated', 'entityDeleted')")
            .withEffect(AlertFilterRule.Effect.INCLUDE);

    AlertFilterRule rule4 =
        new AlertFilterRule()
            .withName("EventTypeCreated")
            .withCondition("matchAnyEventType('entityUpdated')")
            .withEffect(AlertFilterRule.Effect.INCLUDE);

    // Rule 1
    CreateAlert createAlertRequest =
        createRequest(alertName)
            .withTriggerConfig(triggerConfig)
            .withFilteringRules(List.of(rule1))
            .withAlertActions(List.of(genericWebhookAction.getEntityReference()))
            .withEnabled(true);

    Alert createdAlert = createAndCheckEntity(createAlertRequest, ADMIN_AUTH_HEADERS);

    // Rule 2
    ChangeDescription change = getChangeDescription(createdAlert.getVersion());
    fieldUpdated(change, "filteringRules", List.of(rule1), List.of(rule2));
    createAlertRequest.withFilteringRules(List.of(rule2));

    createdAlert =
        updateAndCheckEntity(
            createAlertRequest, Response.Status.OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);

    // Rule 3
    change = getChangeDescription(createdAlert.getVersion());
    fieldUpdated(change, "filteringRules", List.of(rule2), List.of(rule3));
    createAlertRequest.withFilteringRules(List.of(rule3));

    createdAlert =
        updateAndCheckEntity(
            createAlertRequest, Response.Status.OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);

    // Rule 4
    change = getChangeDescription(createdAlert.getVersion());
    fieldUpdated(change, "filteringRules", List.of(rule3), List.of(rule4));
    createAlertRequest.withFilteringRules(List.of(rule4));

    createdAlert =
        updateAndCheckEntity(
            createAlertRequest, Response.Status.OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);

    // Delete Action and Alert
    alertActionResourceTest.deleteEntity(genericWebhookAction.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(createdAlert.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDifferentTypesOfAlerts() throws IOException {
    // Create multiple webhooks each with different type of response to callback

    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook";

    // SlowServer
    String alertName = "slowServer";
    // Alert Action
    Webhook w1 = getWebhook(alertName, baseUri + "/simulate/slowServer"); // Callback response 1 second slower
    CreateAlertAction w1ActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, w1, true)
            .withBatchSize(10);
    AlertAction w1Action = alertActionResourceTest.createAndCheckEntity(w1ActionRequest, ADMIN_AUTH_HEADERS);
    Alert w1Alert =
        createAlert(alertName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(w1Action.getEntityReference()));

    // CallbackTimeout
    alertName = "callbackTimeout";
    Webhook w2 = getWebhook("callbackTimeout", baseUri + "/simulate/timeout"); // Callback response 12 seconds slower
    CreateAlertAction w2ActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, w2, true)
            .withBatchSize(10);
    AlertAction w2Action = alertActionResourceTest.createAndCheckEntity(w2ActionRequest, ADMIN_AUTH_HEADERS);
    Alert w2Alert =
        createAlert(alertName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(w2Action.getEntityReference()));

    // callbackResponse300
    alertName = "callbackResponse300";
    Webhook w3 = getWebhook("callbackResponse300", baseUri + "/simulate/300"); // 3xx response
    CreateAlertAction w3ActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, w3, true)
            .withBatchSize(10);
    AlertAction w3Action = alertActionResourceTest.createAndCheckEntity(w3ActionRequest, ADMIN_AUTH_HEADERS);
    Alert w3Alert =
        createAlert(alertName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(w3Action.getEntityReference()));

    // callbackResponse400
    alertName = "callbackResponse400";
    Webhook w4 = getWebhook("callbackResponse400", baseUri + "/simulate/400"); // 4xx response
    CreateAlertAction w4ActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, w4, true)
            .withBatchSize(10);
    AlertAction w4Action = alertActionResourceTest.createAndCheckEntity(w4ActionRequest, ADMIN_AUTH_HEADERS);
    Alert w4Alert =
        createAlert(alertName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(w4Action.getEntityReference()));

    // callbackResponse500
    alertName = "callbackResponse500";
    Webhook w5 = getWebhook("callbackResponse500", baseUri + "/simulate/500"); // 5xx response
    CreateAlertAction w5ActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, w5, true)
            .withBatchSize(10);
    AlertAction w5Action = alertActionResourceTest.createAndCheckEntity(w5ActionRequest, ADMIN_AUTH_HEADERS);
    Alert w5Alert =
        createAlert(alertName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(w5Action.getEntityReference()));

    // invalidEndpoint
    alertName = "invalidEndpoint";
    Webhook w6 = getWebhook("invalidEndpoint", "http://invalidUnknownHost"); // Invalid URL
    CreateAlertAction w6ActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, w6, true)
            .withBatchSize(10);
    AlertAction w6Action = alertActionResourceTest.createAndCheckEntity(w6ActionRequest, ADMIN_AUTH_HEADERS);
    Alert w6Alert =
        createAlert(alertName, ALL_EVENTS_FILTER, new ArrayList<>(), List.of(w6Action.getEntityReference()));

    // Now check state of webhooks created
    WebhookCallbackResource.EventDetails details = waitForFirstEvent("simulate-slowServer", 25);
    ConcurrentLinkedQueue<ChangeEvent> callbackEvents = details.getEvents();
    assertNotNull(callbackEvents.peek());

    waitAndCheckForEvents("*", "*", "*", callbackEvents.peek().getTimestamp(), callbackEvents, 30);

    // Check all webhook status
    assertAlertStatusSuccessWithId(w1Alert.getId(), w1Action.getId());
    assertAlertStatus(w3Alert.getId(), w3Action.getId(), AlertActionStatus.Status.FAILED, 301, "Moved Permanently");
    assertAlertStatus(w4Alert.getId(), w4Action.getId(), AlertActionStatus.Status.AWAITING_RETRY, 400, "Bad Request");
    assertAlertStatus(
        w5Alert.getId(), w5Action.getId(), AlertActionStatus.Status.AWAITING_RETRY, 500, "Internal Server Error");
    assertAlertStatus(w6Alert.getId(), w6Action.getId(), AlertActionStatus.Status.FAILED, 400, "UnknownHostException");

    // Delete all webhooks
    alertActionResourceTest.deleteEntity(w1Action.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w1Alert.getId(), ADMIN_AUTH_HEADERS);
    alertActionResourceTest.deleteEntity(w2Action.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w2Alert.getId(), ADMIN_AUTH_HEADERS);
    alertActionResourceTest.deleteEntity(w3Action.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w3Alert.getId(), ADMIN_AUTH_HEADERS);
    alertActionResourceTest.deleteEntity(w4Action.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w4Alert.getId(), ADMIN_AUTH_HEADERS);
    alertActionResourceTest.deleteEntity(w5Action.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w5Alert.getId(), ADMIN_AUTH_HEADERS);
    alertActionResourceTest.deleteEntity(w6Action.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(w6Alert.getId(), ADMIN_AUTH_HEADERS);
  }

  private AtomicBoolean hasWebHookFailed(UUID alertId, UUID alertActionId) throws HttpResponseException {
    AlertActionStatus status = getStatus(alertId, alertActionId, Response.Status.OK.getStatusCode());
    LOG.info("webhook status {}", status.getStatus());
    return new AtomicBoolean(status.getStatus() == AlertActionStatus.Status.FAILED);
  }

  /**
   * Before a test for every entity resource, create a webhook subscription. At the end of the test, ensure all events
   * are delivered over web subscription comparing it with number of events stored in the system.
   */
  public void startWebhookSubscription(boolean enabled) throws IOException {
    String baseUri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/healthy";
    Webhook webhook = getWebhook("healthy", baseUri);
    CreateAlertAction alertAction =
        alertActionResourceTest.createRequest("healthy", AlertAction.AlertActionType.GENERIC_WEBHOOK, webhook, enabled);
    AlertAction action = alertActionResourceTest.createAndCheckEntity(alertAction, ADMIN_AUTH_HEADERS);
    createAlert("healthy", ALL_EVENTS_FILTER, new ArrayList<>(), List.of(action.getEntityReference()));
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
    assertAlertStatusSuccessWithName("healthy", "healthy");
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

  public void assertAlertStatusSuccessWithId(UUID alertId, UUID actionId) throws HttpResponseException {
    AlertActionStatus status = getStatus(alertId, actionId, Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.ACTIVE, status.getStatus());
    assertNull(status.getFailureDetails());
  }

  public void assertAlertStatusSuccessWithName(String alertName, String alertActionName) throws HttpResponseException {
    Alert alert = getEntityByName(alertName, null, "", ADMIN_AUTH_HEADERS);
    AlertAction alertAction = alertActionResourceTest.getEntityByName(alertActionName, null, "", ADMIN_AUTH_HEADERS);
    AlertActionStatus status = getStatus(alert.getId(), alertAction.getId(), Response.Status.OK.getStatusCode());
    assertEquals(AlertActionStatus.Status.ACTIVE, status.getStatus());
    assertNull(status.getFailureDetails());
  }

  public void assertAlertStatus(
      UUID alertId, UUID actionId, AlertActionStatus.Status status, Integer statusCode, String failedReason)
      throws HttpResponseException {
    AlertActionStatus actionStatus = getStatus(alertId, actionId, Response.Status.OK.getStatusCode());
    assertEquals(status, actionStatus.getStatus());
    assertEquals(statusCode, actionStatus.getFailureDetails().getLastFailedStatusCode());
    assertEquals(failedReason, actionStatus.getFailureDetails().getLastFailedReason());
  }

  private AlertActionStatus getStatus(UUID alertId, UUID alertActionId, int statusCode) throws HttpResponseException {
    WebTarget target = getResource(String.format("%s/%s/status/%s", collectionName, alertId, alertActionId));
    getResource(String.format("%s/%s/status/%s", collectionName, alertId, alertActionId));
    return TestUtils.getWithResponse(target, AlertActionStatus.class, ADMIN_AUTH_HEADERS, statusCode);
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
    Webhook genericWebhook = getWebhook(alertName, uri);
    CreateAlertAction genericWebhookActionRequest =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, genericWebhook, true)
            .withBatchSize(10);
    AlertAction genericWebhookAction =
        alertActionResourceTest.createAndCheckEntity(genericWebhookActionRequest, ADMIN_AUTH_HEADERS);

    // Alert
    TriggerConfig triggerConfig =
        new TriggerConfig()
            .withType(TriggerConfig.AlertTriggerType.SPECIFIC_DATA_ASSET)
            .withEntities(new HashSet<>(List.of(entity)));
    AlertFilterRule rule =
        new AlertFilterRule()
            .withName("EventTypeCreated")
            .withCondition("matchAnyEventType('entityCreated')")
            .withEffect(AlertFilterRule.Effect.INCLUDE);

    createAlert(alertName, triggerConfig, List.of(rule), List.of(genericWebhookAction.getEntityReference()));

    // Create webhook with endpoint api/v1/test/webhook/entityUpdated/<entity> to receive entityUpdated events
    alertName = EventType.ENTITY_UPDATED + "_" + entity;
    uri = baseUri + "/" + EventType.ENTITY_UPDATED + "/" + entity;

    Webhook genericWebhook2 = getWebhook(alertName, uri);
    CreateAlertAction genericWebhookActionRequest2 =
        alertActionResourceTest
            .createRequest(alertName, AlertAction.AlertActionType.GENERIC_WEBHOOK, genericWebhook2, true)
            .withBatchSize(10);
    AlertAction genericWebhookAction2 =
        alertActionResourceTest.createAndCheckEntity(genericWebhookActionRequest2, ADMIN_AUTH_HEADERS);

    // Alert
    TriggerConfig triggerConfig2 =
        new TriggerConfig()
            .withType(TriggerConfig.AlertTriggerType.SPECIFIC_DATA_ASSET)
            .withEntities(new HashSet<>(List.of(entity)));
    AlertFilterRule rule2 =
        new AlertFilterRule()
            .withName("EventTypeUpdated")
            .withCondition("matchAnyEventType('entityUpdated')")
            .withEffect(AlertFilterRule.Effect.INCLUDE);
    createAlert(alertName, triggerConfig2, List.of(rule2), List.of(genericWebhookAction2.getEntityReference()));

    // TODO entity deleted events
  }

  public Alert createAlert(
      String name, TriggerConfig triggerConfig, List<AlertFilterRule> rules, List<EntityReference> alertAction)
      throws IOException {
    CreateAlert alert =
        new CreateAlert()
            .withName(name)
            .withTriggerConfig(triggerConfig)
            .withFilteringRules(rules)
            .withAlertActions(alertAction)
            .withEnabled(true);
    return createAndCheckEntity(alert, ADMIN_AUTH_HEADERS);
  }

  @Override
  public CreateAlert createRequest(String name) {
    return new CreateAlert()
        .withName(name)
        .withTriggerConfig(ALL_EVENTS_FILTER)
        .withFilteringRules(new ArrayList<>())
        .withAlertActions(List.of(alert_action_ref))
        .withEnabled(true);
  }

  @Override
  public void validateCreatedEntity(Alert createdEntity, CreateAlert createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), createdEntity.getName());
    assertEquals(createRequest.getTriggerConfig(), createdEntity.getTriggerConfig());
    validateEntityReferences(createdEntity.getAlertActions(), false);
  }

  @Override
  public void compareEntities(Alert expected, Alert updated, Map<String, String> authHeaders) {}

  @Override
  public Alert validateGetWithDifferentFields(Alert entity, boolean byName) {
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}

  public Webhook getWebhook(String name, String uri) {
    return new Webhook()
        .withName(name)
        .withDescription("Alert Action Webhook")
        .withEndpoint(URI.create(uri))
        .withSecretKey("")
        .withSecretKey("webhookTest");
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
