package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.NotificationFilterOperation;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for EventSubscription entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds event subscription-specific tests
 * for webhook destinations and filtering rules.
 *
 * <p>Migrated from: org.openmetadata.service.resources.events.EventSubscriptionResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class EventSubscriptionResourceIT
    extends BaseEntityIT<EventSubscription, CreateEventSubscription> {

  // EventSubscription has special requirements
  {
    supportsFieldsQueryParam = false;
    supportsEtag = false;
    supportsTags = false;
    supportsFollowers = false;
    supportsOwners = false;
    supportsSoftDelete = false; // EventSubscription uses hard delete
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSearchIndex = false; // EventSubscription doesn't have a search index
    supportsListAllVersionsByTimestamp = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateEventSubscription createMinimalRequest(TestNamespace ns) {
    return new CreateEventSubscription()
        .withName(ns.prefix("eventsub"))
        .withDescription("Test event subscription created by integration test")
        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
        .withResources(List.of("all"))
        .withEnabled(false)
        .withDestinations(getWebhookDestination(ns));
  }

  @Override
  protected CreateEventSubscription createRequest(String name, TestNamespace ns) {
    return new CreateEventSubscription()
        .withName(name)
        .withDescription("Test event subscription")
        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
        .withResources(List.of("all"))
        .withEnabled(false)
        .withDestinations(getWebhookDestination(ns));
  }

  private List<SubscriptionDestination> getWebhookDestination(TestNamespace ns) {
    Webhook webhook =
        new Webhook()
            .withEndpoint(java.net.URI.create("http://localhost:8585/api/v1/test/webhook/test"));

    return List.of(
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(webhook));
  }

  @Override
  protected EventSubscription createEntity(CreateEventSubscription createRequest) {
    return SdkClients.adminClient().eventSubscriptions().create(createRequest);
  }

  @Override
  protected EventSubscription getEntity(String id) {
    return SdkClients.adminClient().eventSubscriptions().get(id);
  }

  @Override
  protected EventSubscription getEntityByName(String fqn) {
    return SdkClients.adminClient().eventSubscriptions().getByName(fqn);
  }

  @Override
  protected EventSubscription patchEntity(String id, EventSubscription entity) {
    return SdkClients.adminClient().eventSubscriptions().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().eventSubscriptions().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().eventSubscriptions().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().eventSubscriptions().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "eventsubscription";
  }

  @Override
  protected void validateCreatedEntity(
      EventSubscription entity, CreateEventSubscription createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertNotNull(entity.getDestinations());
  }

  @Override
  protected ListResponse<EventSubscription> listEntities(ListParams params) {
    return SdkClients.adminClient().eventSubscriptions().list(params);
  }

  @Override
  protected EventSubscription getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().eventSubscriptions().get(id, fields);
  }

  @Override
  protected EventSubscription getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().eventSubscriptions().getByName(fqn, fields);
  }

  @Override
  protected EventSubscription getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().eventSubscriptions().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().eventSubscriptions().getVersionList(id);
  }

  @Override
  protected EventSubscription getVersion(UUID id, Double version) {
    return SdkClients.adminClient().eventSubscriptions().getVersion(id.toString(), version);
  }

  // ===================================================================
  // EVENT SUBSCRIPTION-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_eventSubscriptionDisabled_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_disabled"))
            .withDescription("Disabled subscription")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertFalse(subscription.getEnabled());
  }

  @Test
  void put_eventSubscriptionDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_update_desc"))
            .withDescription("Initial description")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertEquals("Initial description", subscription.getDescription());

    // Update description
    subscription.setDescription("Updated description");
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_eventSubscriptionNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String subName = ns.prefix("unique_sub");
    CreateEventSubscription request1 =
        new CreateEventSubscription()
            .withName(subName)
            .withDescription("First subscription")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription sub1 = createEntity(request1);
    assertNotNull(sub1);

    // Attempt to create duplicate
    CreateEventSubscription request2 =
        new CreateEventSubscription()
            .withName(subName)
            .withDescription("Duplicate subscription")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate event subscription should fail");
  }

  @Test
  void test_eventSubscriptionWithResources_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_filter"))
            .withDescription("Subscription with filtering")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getFilteringRules());
  }

  @Test
  void test_slackDestination_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("slack_sub"))
            .withDescription("Slack subscription")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getSlackDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(1, subscription.getDestinations().size());
    assertEquals(
        SubscriptionDestination.SubscriptionType.SLACK,
        subscription.getDestinations().get(0).getType());
  }

  @Test
  void test_msTeamsDestination_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("msteams_sub"))
            .withDescription("MS Teams subscription")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getMSTeamsDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(1, subscription.getDestinations().size());
    assertEquals(
        SubscriptionDestination.SubscriptionType.MS_TEAMS,
        subscription.getDestinations().get(0).getType());
  }

  @Test
  void test_emailDestination_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("email_sub"))
            .withDescription("Email subscription")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getEmailDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(1, subscription.getDestinations().size());
    assertEquals(
        SubscriptionDestination.SubscriptionType.EMAIL,
        subscription.getDestinations().get(0).getType());
  }

  @Test
  void test_observabilityAlertType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Observability alerts support only ONE specific resource type
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("observability_sub"))
            .withDescription("Observability subscription")
            .withAlertType(CreateEventSubscription.AlertType.OBSERVABILITY)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(CreateEventSubscription.AlertType.OBSERVABILITY, subscription.getAlertType());
  }

  @Test
  void test_activityFeedAlertType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("activityfeed_sub"))
            .withDescription("Activity Feed subscription")
            .withAlertType(CreateEventSubscription.AlertType.ACTIVITY_FEED)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(CreateEventSubscription.AlertType.ACTIVITY_FEED, subscription.getAlertType());
  }

  @Test
  void test_eventFilteringByEventType(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByEventType =
        new ArgumentsInput()
            .withName("filterByEventType")
            .withArguments(
                List.of(
                    new Argument()
                        .withName("eventTypeList")
                        .withInput(List.of(EventType.ENTITY_CREATED.value()))));

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("event_filter_sub"))
            .withDescription("Subscription with event type filtering")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(filterByEventType)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getInput());
    assertNotNull(subscription.getInput().getFilters());
    assertFalse(subscription.getInput().getFilters().isEmpty());
  }

  @Test
  void test_batchSizeConfiguration(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("batch_sub"))
            .withDescription("Subscription with batch size")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withBatchSize(50)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(50, subscription.getBatchSize());
  }

  @Test
  void test_pollIntervalConfiguration(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("poll_sub"))
            .withDescription("Subscription with poll interval")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withPollInterval(5)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(5, subscription.getPollInterval());
  }

  @Test
  void test_retriesConfiguration(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("retry_sub"))
            .withDescription("Subscription with retries")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withRetries(3)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(3, subscription.getRetries());
  }

  @Test
  void test_filterByOwnerName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByOwner =
        createFilterByOwnerArgumentsInput(List.of("admin"), ArgumentsInput.Effect.INCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("owner_filter_sub"))
            .withDescription("Subscription with owner filtering")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(filterByOwner)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getInput());
    assertNotNull(subscription.getInput().getFilters());
    assertEquals(1, subscription.getInput().getFilters().size());
  }

  @Test
  void test_filterByDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByDomain =
        createFilterByDomainArgumentsInput(List.of("Engineering"), ArgumentsInput.Effect.INCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("domain_filter_sub"))
            .withDescription("Subscription with domain filtering")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(filterByDomain)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getInput());
    assertNotNull(subscription.getInput().getFilters());
    assertEquals(1, subscription.getInput().getFilters().size());
  }

  @Test
  void test_filterByFqn(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByFqn =
        createFilterByFqnArgumentsInput(
            List.of("sample_data.ecommerce_db.shopify.dim_customer"),
            ArgumentsInput.Effect.INCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("fqn_filter_sub"))
            .withDescription("Subscription with FQN filtering")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(filterByFqn)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getInput());
    assertNotNull(subscription.getInput().getFilters());
    assertEquals(1, subscription.getInput().getFilters().size());
  }

  @Test
  void test_excludeFilters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput excludeFilter =
        createFilterByFqnArgumentsInput(
            List.of("sample_data.ecommerce_db.shopify.dim_customer"),
            ArgumentsInput.Effect.EXCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("exclude_filter_sub"))
            .withDescription("Subscription with exclude filtering")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(excludeFilter)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getInput());
    assertNotNull(subscription.getInput().getFilters());
    assertEquals(
        ArgumentsInput.Effect.EXCLUDE, subscription.getInput().getFilters().get(0).getEffect());
  }

  @Test
  void test_multipleFilters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByOwner =
        createFilterByOwnerArgumentsInput(List.of("admin"), ArgumentsInput.Effect.INCLUDE);
    ArgumentsInput filterByDomain =
        createFilterByDomainArgumentsInput(List.of("Engineering"), ArgumentsInput.Effect.INCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("multi_filter_sub"))
            .withDescription("Subscription with multiple filters")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(
                new AlertFilteringInput().withFilters(List.of(filterByOwner, filterByDomain)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getInput());
    assertNotNull(subscription.getInput().getFilters());
    assertEquals(2, subscription.getInput().getFilters().size());
  }

  @Test
  void test_tableResourceFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("table_resource_sub"))
            .withDescription("Subscription for table resource")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getFilteringRules());
    assertEquals(List.of("table"), subscription.getFilteringRules().getResources());
  }

  @Test
  void test_topicResourceFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("topic_resource_sub"))
            .withDescription("Subscription for topic resource")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("topic"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getFilteringRules());
    assertEquals(List.of("topic"), subscription.getFilteringRules().getResources());
  }

  @Test
  void test_ingestionPipelineResourceFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("pipeline_resource_sub"))
            .withDescription("Subscription for ingestion pipeline resource")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("ingestionPipeline"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getFilteringRules());
    assertEquals(List.of("ingestionPipeline"), subscription.getFilteringRules().getResources());
  }

  @Test
  void test_updateBatchSize(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("update_batch_sub"))
            .withDescription("Subscription to update batch size")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withBatchSize(10)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertEquals(10, subscription.getBatchSize());

    subscription.setBatchSize(25);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertEquals(25, updated.getBatchSize());
  }

  @Test
  void test_updateRetries(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("update_retry_sub"))
            .withDescription("Subscription to update retries")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withRetries(0)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertEquals(0, subscription.getRetries());

    subscription.setRetries(3);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertEquals(3, updated.getRetries());
  }

  @Test
  void test_updateDestination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("update_dest_sub"))
            .withDescription("Subscription to update destination")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertEquals(
        SubscriptionDestination.SubscriptionType.WEBHOOK,
        subscription.getDestinations().get(0).getType());

    subscription.setDestinations(getSlackDestination(ns));
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertEquals(
        SubscriptionDestination.SubscriptionType.SLACK, updated.getDestinations().get(0).getType());
  }

  @Test
  void test_enableDisableSubscription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("enable_disable_sub"))
            .withDescription("Subscription to test enable/disable")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertFalse(subscription.getEnabled());

    subscription.setEnabled(true);
    EventSubscription enabled = patchEntity(subscription.getId().toString(), subscription);
    assertTrue(enabled.getEnabled());

    enabled.setEnabled(false);
    EventSubscription disabled = patchEntity(enabled.getId().toString(), enabled);
    assertFalse(disabled.getEnabled());
  }

  @Test
  void test_invalidAlertTypeThrowsException(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test that creating event subscription with empty name fails
    assertThrows(
        Exception.class,
        () -> {
          CreateEventSubscription request =
              new CreateEventSubscription()
                  .withName("") // Empty name should fail
                  .withDescription("Invalid - empty name")
                  .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
                  .withResources(List.of("table"))
                  .withEnabled(false)
                  .withDestinations(getWebhookDestination(ns));

          createEntity(request);
        });
  }

  @Test
  void test_listEventSubscriptions(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request1 =
        new CreateEventSubscription()
            .withName(ns.prefix("list_sub_1"))
            .withDescription("List test 1")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    CreateEventSubscription request2 =
        new CreateEventSubscription()
            .withName(ns.prefix("list_sub_2"))
            .withDescription("List test 2")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription sub1 = createEntity(request1);
    EventSubscription sub2 = createEntity(request2);

    ListParams params = new ListParams();
    ListResponse<EventSubscription> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 2);
  }

  @Test
  void test_getByInvalidId_throwsException(TestNamespace ns) {
    UUID invalidId = UUID.randomUUID();
    assertThrows(OpenMetadataException.class, () -> getEntity(invalidId.toString()));
  }

  @Test
  void test_updateEndpointURL(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("update_endpoint_sub"))
            .withDescription("Subscription to update endpoint")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription.getDestinations());
    assertEquals(1, subscription.getDestinations().size());

    Webhook updatedWebhook =
        new Webhook().withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/updated"));

    List<SubscriptionDestination> updatedDestination =
        List.of(
            new SubscriptionDestination()
                .withId(subscription.getDestinations().get(0).getId())
                .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                .withConfig(updatedWebhook));

    subscription.setDestinations(updatedDestination);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertNotNull(updated.getDestinations());
    assertEquals(1, updated.getDestinations().size());
  }

  @Test
  void test_updateAlertFilteringRules(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filter1 =
        new ArgumentsInput()
            .withName("filterByEventType")
            .withArguments(
                List.of(
                    new Argument()
                        .withName("eventTypeList")
                        .withInput(List.of(EventType.ENTITY_CREATED.value()))));

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("update_filter_sub"))
            .withDescription("Subscription to update filters")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(filter1)));

    EventSubscription subscription = createEntity(request);
    assertEquals(1, subscription.getInput().getFilters().size());

    ArgumentsInput filter2 =
        new ArgumentsInput()
            .withName("filterByEventType")
            .withArguments(
                List.of(
                    new Argument()
                        .withName("eventTypeList")
                        .withInput(
                            List.of(
                                EventType.ENTITY_CREATED.value(),
                                EventType.ENTITY_UPDATED.value(),
                                EventType.ENTITY_DELETED.value()))));

    subscription.setInput(new AlertFilteringInput().withFilters(List.of(filter2)));
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertEquals(1, updated.getInput().getFilters().size());
  }

  @Test
  void test_createAndFetchEventSubscription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("fetch_test_sub"))
            .withDescription("Subscription for fetch testing")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withBatchSize(10)
            .withRetries(0)
            .withPollInterval(1)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription created = createEntity(request);
    assertNotNull(created);

    EventSubscription fetchedById = getEntity(created.getId().toString());
    assertNotNull(fetchedById);
    assertEquals(created.getName(), fetchedById.getName());

    EventSubscription fetchedByName = getEntityByName(created.getFullyQualifiedName());
    assertNotNull(fetchedByName);
    assertEquals(created.getName(), fetchedByName.getName());
    assertEquals(created.getId(), fetchedByName.getId());
  }

  @Test
  void test_deleteEventSubscription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("delete_test_sub"))
            .withDescription("Subscription for delete testing")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription created = createEntity(request);
    String id = created.getId().toString();

    deleteEntity(id);

    assertThrows(OpenMetadataException.class, () -> getEntity(id));
  }

  @Test
  void test_filterByOwnerNameExclude(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput excludeOwner =
        createFilterByOwnerArgumentsInput(List.of("admin"), ArgumentsInput.Effect.EXCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("exclude_owner_sub"))
            .withDescription("Subscription with owner exclude filter")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(excludeOwner)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(
        ArgumentsInput.Effect.EXCLUDE, subscription.getInput().getFilters().get(0).getEffect());
  }

  @Test
  void test_filterByDomainExclude(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput excludeDomain =
        createFilterByDomainArgumentsInput(List.of("Engineering"), ArgumentsInput.Effect.EXCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("exclude_domain_sub"))
            .withDescription("Subscription with domain exclude filter")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(excludeDomain)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(
        ArgumentsInput.Effect.EXCLUDE, subscription.getInput().getFilters().get(0).getEffect());
  }

  @Test
  void test_multipleResourceTypesRejected(TestNamespace ns) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("multi_resource_sub"))
            .withDescription("Subscription for multiple resource types")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table", "topic", "dashboard"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Multiple resources are not supported - only one resource can be specified");
  }

  @Test
  void test_updatePollInterval(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("update_poll_sub"))
            .withDescription("Subscription to update poll interval")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withPollInterval(1)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    assertEquals(1, subscription.getPollInterval());

    subscription.setPollInterval(10);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);
    assertEquals(10, updated.getPollInterval());
  }

  @Test
  void test_combinedOwnerAndDomainFilters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByOwner =
        createFilterByOwnerArgumentsInput(List.of("admin"), ArgumentsInput.Effect.INCLUDE);
    ArgumentsInput filterByDomain =
        createFilterByDomainArgumentsInput(List.of("Engineering"), ArgumentsInput.Effect.INCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("combined_filter_sub"))
            .withDescription("Subscription with combined owner and domain filters")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(
                new AlertFilteringInput().withFilters(List.of(filterByOwner, filterByDomain)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(2, subscription.getInput().getFilters().size());
  }

  @Test
  void test_filterByFqnWithMultipleValues(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ArgumentsInput filterByFqn =
        createFilterByFqnArgumentsInput(
            List.of(
                "sample_data.ecommerce_db.shopify.dim_customer",
                "sample_data.ecommerce_db.shopify.fact_order"),
            ArgumentsInput.Effect.INCLUDE);

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("multi_fqn_filter_sub"))
            .withDescription("Subscription with multiple FQN filters")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withInput(new AlertFilteringInput().withFilters(List.of(filterByFqn)));

    EventSubscription subscription = createEntity(request);
    assertNotNull(subscription);
    assertEquals(1, subscription.getInput().getFilters().size());
  }

  @Test
  @org.junit.jupiter.api.Disabled("EventSubscription resource does not support restore operation")
  void test_deleteAndRestoreSubscription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("delete_restore_sub"))
            .withDescription("Test delete and restore")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request);
    String id = subscription.getId().toString();

    deleteEntity(id);

    assertThrows(OpenMetadataException.class, () -> getEntity(id));

    restoreEntity(id);
    EventSubscription restored = getEntityIncludeDeleted(id);
    assertNotNull(restored);
  }

  @Test
  void test_createSubscriptionWithUserTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate createTemplate =
        new CreateNotificationTemplate()
            .withName(ns.prefix("user_template"))
            .withDescription("User notification template")
            .withTemplateSubject("Notification Subject")
            .withTemplateBody("<div>Custom template content</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate userTemplate =
        client.notificationTemplates().create(createTemplate);

    org.openmetadata.schema.type.EntityReference templateRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(userTemplate.getId())
            .withType("notificationTemplate");

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_with_template"))
            .withDescription("Subscription with notification template")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(templateRef);

    EventSubscription subscription = createEntity(createSub);

    assertNotNull(subscription.getNotificationTemplate());
    assertEquals(userTemplate.getId(), subscription.getNotificationTemplate().getId());

    EventSubscription fetched = getEntity(subscription.getId().toString());
    assertNotNull(fetched.getNotificationTemplate());
    assertEquals(userTemplate.getId(), fetched.getNotificationTemplate().getId());

    deleteEntity(subscription.getId().toString());
    client.notificationTemplates().delete(userTemplate.getId().toString());
  }

  @Test
  void test_createSubscriptionWithoutTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_without_template"))
            .withDescription("Subscription without template")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(createSub);

    assertNull(subscription.getNotificationTemplate());

    deleteEntity(subscription.getId().toString());
  }

  @Test
  void test_rejectSystemTemplateOnCreate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    org.openmetadata.schema.entity.events.NotificationTemplate systemTemplate =
        getSystemTemplate(client);

    if (systemTemplate == null) {
      return;
    }

    assertEquals(org.openmetadata.schema.type.ProviderType.SYSTEM, systemTemplate.getProvider());

    org.openmetadata.schema.type.EntityReference systemTemplateRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(systemTemplate.getId())
            .withType("notificationTemplate");

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_system_template"))
            .withDescription("Subscription with system template - should fail")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(systemTemplateRef);

    assertThrows(
        Exception.class,
        () -> createEntity(createSub),
        "System templates cannot be assigned to EventSubscriptions");
  }

  @Test
  void test_updateSubscriptionAddTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_add_template"))
            .withDescription("Subscription to add template")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(createSub);
    assertNull(subscription.getNotificationTemplate());

    CreateNotificationTemplate createTemplate =
        new CreateNotificationTemplate()
            .withName(ns.prefix("template_to_add"))
            .withDescription("Template to add to subscription")
            .withTemplateSubject("Added Template Subject")
            .withTemplateBody("<div>Added template</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template =
        client.notificationTemplates().create(createTemplate);

    org.openmetadata.schema.type.EntityReference templateRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template.getId())
            .withType("notificationTemplate");

    subscription.setNotificationTemplate(templateRef);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);

    assertNotNull(updated.getNotificationTemplate());
    assertEquals(template.getId(), updated.getNotificationTemplate().getId());

    EventSubscription fetched = getEntity(subscription.getId().toString());
    assertNotNull(fetched.getNotificationTemplate());
    assertEquals(template.getId(), fetched.getNotificationTemplate().getId());

    deleteEntity(subscription.getId().toString());
    client.notificationTemplates().delete(template.getId().toString());
  }

  @Test
  void test_updateSubscriptionChangeTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate createTemplate1 =
        new CreateNotificationTemplate()
            .withName(ns.prefix("template1"))
            .withDescription("First template")
            .withTemplateSubject("Template 1 Subject")
            .withTemplateBody("<div>Template 1</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template1 =
        client.notificationTemplates().create(createTemplate1);

    CreateNotificationTemplate createTemplate2 =
        new CreateNotificationTemplate()
            .withName(ns.prefix("template2"))
            .withDescription("Second template")
            .withTemplateSubject("Template 2 Subject")
            .withTemplateBody("<div>Template 2</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template2 =
        client.notificationTemplates().create(createTemplate2);

    org.openmetadata.schema.type.EntityReference template1Ref =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template1.getId())
            .withType("notificationTemplate");

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_change_template"))
            .withDescription("Subscription to change template")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(template1Ref);

    EventSubscription subscription = createEntity(createSub);
    assertEquals(template1.getId(), subscription.getNotificationTemplate().getId());

    org.openmetadata.schema.type.EntityReference template2Ref =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template2.getId())
            .withType("notificationTemplate");

    subscription.setNotificationTemplate(template2Ref);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);

    assertEquals(template2.getId(), updated.getNotificationTemplate().getId());

    deleteEntity(subscription.getId().toString());
    client.notificationTemplates().delete(template1.getId().toString());
    client.notificationTemplates().delete(template2.getId().toString());
  }

  @Test
  void test_updateSubscriptionRemoveTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate createTemplate =
        new CreateNotificationTemplate()
            .withName(ns.prefix("template_to_remove"))
            .withDescription("Template to be removed")
            .withTemplateSubject("To Be Removed Subject")
            .withTemplateBody("<div>Will be removed</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template =
        client.notificationTemplates().create(createTemplate);

    org.openmetadata.schema.type.EntityReference templateRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template.getId())
            .withType("notificationTemplate");

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_remove_template"))
            .withDescription("Subscription to remove template")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(templateRef);

    EventSubscription subscription = createEntity(createSub);
    assertNotNull(subscription.getNotificationTemplate());

    subscription.setNotificationTemplate(null);
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription);

    assertNull(updated.getNotificationTemplate());

    deleteEntity(subscription.getId().toString());
    client.notificationTemplates().delete(template.getId().toString());
  }

  @Test
  void test_rejectSystemTemplateOnUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_system_update"))
            .withDescription("Subscription for system template update test")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(createSub);

    org.openmetadata.schema.entity.events.NotificationTemplate systemTemplate =
        getSystemTemplate(client);

    if (systemTemplate == null) {
      deleteEntity(subscription.getId().toString());
      return;
    }

    assertEquals(org.openmetadata.schema.type.ProviderType.SYSTEM, systemTemplate.getProvider());

    org.openmetadata.schema.type.EntityReference systemTemplateRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(systemTemplate.getId())
            .withType("notificationTemplate");

    subscription.setNotificationTemplate(systemTemplateRef);
    assertThrows(
        Exception.class,
        () -> patchEntity(subscription.getId().toString(), subscription),
        "System templates cannot be assigned to EventSubscriptions");

    deleteEntity(subscription.getId().toString());
  }

  @Test
  void test_deleteSubscriptionPreservesTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate createTemplate =
        new CreateNotificationTemplate()
            .withName(ns.prefix("template_preserved"))
            .withDescription("Template that should survive")
            .withTemplateSubject("Preserved Template Subject")
            .withTemplateBody("<div>Should survive</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template =
        client.notificationTemplates().create(createTemplate);

    org.openmetadata.schema.type.EntityReference templateRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template.getId())
            .withType("notificationTemplate");

    CreateEventSubscription createSub =
        new CreateEventSubscription()
            .withName(ns.prefix("sub_to_delete"))
            .withDescription("Subscription to delete")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(templateRef);

    EventSubscription subscription = createEntity(createSub);

    deleteEntity(subscription.getId().toString());

    org.openmetadata.schema.entity.events.NotificationTemplate templateAfterDelete =
        client.notificationTemplates().get(template.getId().toString());
    assertNotNull(templateAfterDelete, "Template should exist after subscription deletion");

    ListParams params =
        new ListParams().addFilter("notificationTemplate", template.getId().toString());
    ListResponse<EventSubscription> subscriptions = listEntities(params);
    assertTrue(subscriptions.getData().isEmpty(), "No subscriptions should reference template");

    client.notificationTemplates().delete(template.getId().toString());
  }

  @Test
  void test_querySubscriptionsByTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate createTemplate1 =
        new CreateNotificationTemplate()
            .withName(ns.prefix("query_template1"))
            .withDescription("Template 1 for query test")
            .withTemplateSubject("Query Template 1 Subject")
            .withTemplateBody("<div>Template 1 for query</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template1 =
        client.notificationTemplates().create(createTemplate1);

    CreateNotificationTemplate createTemplate2 =
        new CreateNotificationTemplate()
            .withName(ns.prefix("query_template2"))
            .withDescription("Template 2 for query test")
            .withTemplateSubject("Query Template 2 Subject")
            .withTemplateBody("<div>Template 2 for query</div>");

    org.openmetadata.schema.entity.events.NotificationTemplate template2 =
        client.notificationTemplates().create(createTemplate2);

    org.openmetadata.schema.type.EntityReference template1Ref =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template1.getId())
            .withType("notificationTemplate");

    org.openmetadata.schema.type.EntityReference template2Ref =
        new org.openmetadata.schema.type.EntityReference()
            .withId(template2.getId())
            .withType("notificationTemplate");

    CreateEventSubscription createSub1 =
        new CreateEventSubscription()
            .withName(ns.prefix("query_sub1"))
            .withDescription("Query subscription 1")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(template1Ref);

    EventSubscription sub1 = createEntity(createSub1);

    CreateEventSubscription createSub2 =
        new CreateEventSubscription()
            .withName(ns.prefix("query_sub2"))
            .withDescription("Query subscription 2")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(template1Ref);

    EventSubscription sub2 = createEntity(createSub2);

    CreateEventSubscription createSub3 =
        new CreateEventSubscription()
            .withName(ns.prefix("query_sub3"))
            .withDescription("Query subscription 3")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns))
            .withNotificationTemplate(template2Ref);

    EventSubscription sub3 = createEntity(createSub3);

    CreateEventSubscription createSub4 =
        new CreateEventSubscription()
            .withName(ns.prefix("query_sub4"))
            .withDescription("Query subscription 4")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription sub4 = createEntity(createSub4);

    ListParams params1 =
        new ListParams().addFilter("notificationTemplate", template1.getId().toString());
    ListResponse<EventSubscription> results1 = listEntities(params1);

    assertTrue(
        results1.getData().size() >= 2, "Should find at least 2 subscriptions with template1");
    long countWithTemplate1 =
        results1.getData().stream()
            .filter(
                s ->
                    s.getNotificationTemplate() != null
                        && s.getNotificationTemplate().getId().equals(template1.getId()))
            .count();
    assertTrue(
        countWithTemplate1 >= 2, "Should have at least 2 results with template1 in this namespace");

    ListParams params2 =
        new ListParams().addFilter("notificationTemplate", template2.getId().toString());
    ListResponse<EventSubscription> results2 = listEntities(params2);

    assertTrue(
        results2.getData().size() >= 1, "Should find at least 1 subscription with template2");

    deleteEntity(sub1.getId().toString());
    deleteEntity(sub2.getId().toString());
    deleteEntity(sub3.getId().toString());
    deleteEntity(sub4.getId().toString());
    client.notificationTemplates().delete(template1.getId().toString());
    client.notificationTemplates().delete(template2.getId().toString());
  }

  // ===================================================================
  // HELPER METHODS FOR CREATING DIFFERENT DESTINATION TYPES
  // ===================================================================

  private List<SubscriptionDestination> getSlackDestination(TestNamespace ns) {
    Webhook webhook =
        new Webhook()
            .withEndpoint(URI.create("http://localhost:8585/api/v1/test/slack/test"))
            .withReceivers(new HashSet<>())
            .withSecretKey("slackTest");

    return List.of(
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.SLACK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(webhook));
  }

  private List<SubscriptionDestination> getMSTeamsDestination(TestNamespace ns) {
    Webhook webhook =
        new Webhook()
            .withEndpoint(URI.create("http://localhost:8585/api/v1/test/msteams/test"))
            .withReceivers(new HashSet<>())
            .withSecretKey("msTeamsTest");

    return List.of(
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.MS_TEAMS)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(webhook));
  }

  private List<SubscriptionDestination> getEmailDestination(TestNamespace ns) {
    Map<String, Object> emailConfig = Map.of("receivers", List.of("test@example.com"));

    return List.of(
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.EMAIL)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(emailConfig));
  }

  private ArgumentsInput createFilterByOwnerArgumentsInput(
      List<String> ownerName, ArgumentsInput.Effect effect) {
    Argument ownerArgument = new Argument().withName("ownerNameList").withInput(ownerName);

    return new ArgumentsInput()
        .withName(NotificationFilterOperation.FILTER_BY_OWNER_NAME.value())
        .withEffect(effect)
        .withArguments(List.of(ownerArgument))
        .withPrefixCondition(ArgumentsInput.PrefixCondition.AND);
  }

  private ArgumentsInput createFilterByDomainArgumentsInput(
      List<String> domainName, ArgumentsInput.Effect effect) {
    Argument domainArgument = new Argument().withName("domainList").withInput(domainName);

    return new ArgumentsInput()
        .withName(NotificationFilterOperation.FILTER_BY_DOMAIN.value())
        .withEffect(effect)
        .withArguments(List.of(domainArgument))
        .withPrefixCondition(ArgumentsInput.PrefixCondition.AND);
  }

  private ArgumentsInput createFilterByFqnArgumentsInput(
      List<String> fqnList, ArgumentsInput.Effect effect) {
    Argument fqnArgument = new Argument().withName("fqnList").withInput(fqnList);

    return new ArgumentsInput()
        .withName(NotificationFilterOperation.FILTER_BY_FQN.value())
        .withEffect(effect)
        .withArguments(List.of(fqnArgument))
        .withPrefixCondition(ArgumentsInput.PrefixCondition.AND);
  }

  private org.openmetadata.schema.entity.events.NotificationTemplate getSystemTemplate(
      OpenMetadataClient client) {
    try {
      return client.notificationTemplates().getByName("system-notification-entity-default");
    } catch (Exception e) {
      return null;
    }
  }
}
