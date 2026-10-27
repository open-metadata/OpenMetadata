package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertLimits;
import org.openmetadata.service.jdbi3.EntityRepository;

/** An alert can be saved only within its bounds, and one already stored past them stays editable. */
@ExtendWith(TestNamespaceExtension.class)
class AlertConfigLimitsIT {

  private static final String ENDPOINT = "http://localhost:9/hook/";
  private static final String ALERTS_PATH = "/v1/events/subscriptions";
  private static final String DESCRIBE =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"edited\"}]";

  @Test
  void aNewAlertWithMoreDestinationsThanTheLimitIsRefused(TestNamespace ns) {
    CreateEventSubscription tooMany =
        request(ns, "too_many_destinations", destinations(AlertLimits.MAX_DESTINATIONS + 1));

    assertBadRequest(() -> SdkClients.adminClient().eventSubscriptions().create(tooMany));
  }

  @Test
  void aNewAlertWithABatchSizePastTheLimitIsRefused(TestNamespace ns) {
    CreateEventSubscription tooLarge =
        request(ns, "too_large_batch", destinations(1))
            .withBatchSize(AlertLimits.MAX_BATCH_SIZE + 1);

    assertBadRequest(() -> SdkClients.adminClient().eventSubscriptions().create(tooLarge));
  }

  @Test
  void aPatchCannotGrowAnAlertPastTheLimits(TestNamespace ns) {
    EventSubscription alert = create(ns, "grows_too_far", AlertLimits.MAX_DESTINATIONS);
    String oneMore =
        "[{\"op\":\"add\",\"path\":\"/destinations/-\",\"value\":"
            + JsonUtils.pojoToJson(destination(AlertLimits.MAX_DESTINATIONS))
            + "}]";
    String largerBatch =
        "[{\"op\":\"replace\",\"path\":\"/batchSize\",\"value\":"
            + (AlertLimits.MAX_BATCH_SIZE + 1)
            + "}]";

    assertBadRequest(() -> patch(alert, oneMore));
    assertBadRequest(() -> patch(alert, largerBatch));
  }

  // As an alert saved before the limit existed would be: it can still be described.
  @Test
  void anAlertStoredPastTheLimitsCanStillBeEdited(TestNamespace ns) {
    EventSubscription alert = create(ns, "stored_past_limits", 1);
    writeBehindTheServer(
        alert.withDestinations(destinations(60)).withBatchSize(AlertLimits.MAX_BATCH_SIZE + 500));

    assertDoesNotThrow(() -> patch(alert, DESCRIBE));
    EventSubscription edited = SdkClients.adminClient().eventSubscriptions().get(alert.getId());
    assertEquals("edited", edited.getDescription());
    assertEquals(60, edited.getDestinations().size());
  }

  // PUT sends the whole alert, so its unchanged destinations and batch size are sent again.
  @Test
  void anAlertStoredPastTheLimitsCanStillBePut(TestNamespace ns) {
    List<SubscriptionDestination> sixty = destinations(60);
    int largeBatch = AlertLimits.MAX_BATCH_SIZE + 500;
    CreateEventSubscription request = request(ns, "put_past_limits", destinations(1));
    EventSubscription alert = SdkClients.adminClient().eventSubscriptions().create(request);
    writeBehindTheServer(alert.withDestinations(sixty).withBatchSize(largeBatch));

    assertDoesNotThrow(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.PUT,
                    ALERTS_PATH,
                    request
                        .withDestinations(sixty)
                        .withBatchSize(largeBatch)
                        .withDescription("edited"),
                    EventSubscription.class));
    EventSubscription edited = SdkClients.adminClient().eventSubscriptions().get(alert.getId());
    assertEquals("edited", edited.getDescription());
    assertEquals(60, edited.getDestinations().size());
  }

  // A PUT that leaves out the destination ids gets new ones; the stored receivers are still kept.
  @Test
  void anAlertStoredPastTheReceiverLimitCanBePutWithoutDestinationIds(TestNamespace ns) {
    CreateEventSubscription request = request(ns, "put_without_ids", destinations(1));
    EventSubscription alert = SdkClients.adminClient().eventSubscriptions().create(request);
    SubscriptionDestination stored =
        destination(0)
            .withConfig(webhookWithReceivers(AlertLimits.MAX_RECEIVERS_PER_DESTINATION + 50));
    writeBehindTheServer(alert.withDestinations(List.of(stored)));
    SubscriptionDestination sentWithoutId =
        JsonUtils.deepCopy(stored, SubscriptionDestination.class).withId(null);

    assertDoesNotThrow(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.PUT,
                    ALERTS_PATH,
                    request.withDestinations(List.of(sentWithoutId)).withDescription("edited"),
                    EventSubscription.class));
    assertEquals(
        "edited",
        SdkClients.adminClient().eventSubscriptions().get(alert.getId()).getDescription());
  }

  @Test
  void aPatchCannotStopAnAlertFromReadingEvents(TestNamespace ns) {
    EventSubscription alert = create(ns, "reads_nothing", 1);

    assertBadRequest(
        () -> patch(alert, "[{\"op\":\"replace\",\"path\":\"/batchSize\",\"value\":0}]"));
  }

  private static void assertBadRequest(Executable request) {
    OpenMetadataException refused = assertThrows(OpenMetadataException.class, request);
    assertEquals(400, refused.getStatusCode(), refused.getMessage());
  }

  private static void writeBehindTheServer(EventSubscription alert) {
    Entity.getCollectionDAO().eventSubscriptionDAO().update(alert);
    EntityRepository.invalidateCacheForEntity(
        Entity.EVENT_SUBSCRIPTION, alert.getId(), alert.getFullyQualifiedName());
  }

  private static void patch(EventSubscription alert, String patch) {
    SdkClients.adminClient().eventSubscriptions().patch(alert.getId(), JsonUtils.readTree(patch));
  }

  private static EventSubscription create(TestNamespace ns, String name, int destinations) {
    return SdkClients.adminClient()
        .eventSubscriptions()
        .create(request(ns, name, destinations(destinations)));
  }

  private static CreateEventSubscription request(
      TestNamespace ns, String name, List<SubscriptionDestination> destinations) {
    return new CreateEventSubscription()
        .withName(ns.prefix(name))
        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
        .withResources(List.of(Entity.TABLE))
        .withEnabled(false)
        .withDestinations(destinations);
  }

  private static List<SubscriptionDestination> destinations(int count) {
    return new ArrayList<>(
        IntStream.range(0, count).mapToObj(AlertConfigLimitsIT::destination).toList());
  }

  private static SubscriptionDestination destination(int index) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(new Webhook().withEndpoint(URI.create(ENDPOINT + index)));
  }

  private static Webhook webhookWithReceivers(int receivers) {
    return new Webhook()
        .withEndpoint(URI.create(ENDPOINT + "main"))
        .withReceivers(
            IntStream.range(0, receivers)
                .mapToObj(index -> ENDPOINT + "receiver/" + index)
                .collect(Collectors.toSet()));
  }
}
