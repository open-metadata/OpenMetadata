package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.sdk.client.OpenMetadataClient;
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
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateEventSubscription createMinimalRequest(
      TestNamespace ns, OpenMetadataClient client) {
    return new CreateEventSubscription()
        .withName(ns.prefix("eventsub"))
        .withDescription("Test event subscription created by integration test")
        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
        .withResources(List.of("all"))
        .withEnabled(false)
        .withDestinations(getWebhookDestination(ns));
  }

  @Override
  protected CreateEventSubscription createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
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
  protected EventSubscription createEntity(
      CreateEventSubscription createRequest, OpenMetadataClient client) {
    return client.eventSubscriptions().create(createRequest);
  }

  @Override
  protected EventSubscription getEntity(String id, OpenMetadataClient client) {
    return client.eventSubscriptions().get(id);
  }

  @Override
  protected EventSubscription getEntityByName(String fqn, OpenMetadataClient client) {
    return client.eventSubscriptions().getByName(fqn);
  }

  @Override
  protected EventSubscription patchEntity(
      String id, EventSubscription entity, OpenMetadataClient client) {
    return client.eventSubscriptions().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.eventSubscriptions().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.eventSubscriptions().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.eventSubscriptions().delete(id, params);
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
  protected ListResponse<EventSubscription> listEntities(
      ListParams params, OpenMetadataClient client) {
    return client.eventSubscriptions().list(params);
  }

  @Override
  protected EventSubscription getEntityWithFields(
      String id, String fields, OpenMetadataClient client) {
    return client.eventSubscriptions().get(id, fields);
  }

  @Override
  protected EventSubscription getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.eventSubscriptions().getByName(fqn, fields);
  }

  @Override
  protected EventSubscription getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.eventSubscriptions().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.eventSubscriptions().getVersionList(id);
  }

  @Override
  protected EventSubscription getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.eventSubscriptions().getVersion(id.toString(), version);
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

    EventSubscription subscription = createEntity(request, client);
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

    EventSubscription subscription = createEntity(request, client);
    assertEquals("Initial description", subscription.getDescription());

    // Update description
    subscription.setDescription("Updated description");
    EventSubscription updated = patchEntity(subscription.getId().toString(), subscription, client);
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

    EventSubscription sub1 = createEntity(request1, client);
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
        () -> createEntity(request2, client),
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
            .withResources(List.of("table", "topic"))
            .withEnabled(false)
            .withDestinations(getWebhookDestination(ns));

    EventSubscription subscription = createEntity(request, client);
    assertNotNull(subscription);
    // Resources are part of the subscription's filtering configuration
    assertNotNull(subscription.getFilteringRules());
  }
}
