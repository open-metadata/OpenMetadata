package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
    Map<String, Object> emailConfig =
        Map.of("emailAddress", List.of("test@example.com"), "subject", "Test Alert");

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
}
