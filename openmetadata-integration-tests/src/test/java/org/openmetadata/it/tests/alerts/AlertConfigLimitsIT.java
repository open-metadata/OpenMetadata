package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.it.util.ApiAssertions.assertBadRequest;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.AlertLimits;

/** An alert can be saved only within its bounds, and one already stored past them stays editable. */
@ExtendWith(TestNamespaceExtension.class)
class AlertConfigLimitsIT {

  private static final String ENDPOINT = "http://localhost:9/hook/";
  private static final String DESCRIBE =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"edited\"}]";

  @Test
  void aNewAlertWithMoreDestinationsThanTheLimitIsRefused(TestNamespace ns) {
    CreateEventSubscription tooMany =
        request(ns, "too_many_destinations", destinations(AlertLimits.MAX_DESTINATIONS + 1));

    assertBadRequest(
        () -> SdkClients.adminClient().eventSubscriptions().create(tooMany),
        "51 destinations were accepted");
  }

  @Test
  void aNewAlertWithABatchSizePastTheLimitIsRefused(TestNamespace ns) {
    CreateEventSubscription tooLarge =
        request(ns, "too_large_batch", destinations(1))
            .withBatchSize(AlertLimits.MAX_BATCH_SIZE + 1);

    assertBadRequest(
        () -> SdkClients.adminClient().eventSubscriptions().create(tooLarge),
        "a batch size of 1001 was accepted");
  }

  @Test
  void aPatchCannotGrowAnAlertPastTheLimits(TestNamespace ns) {
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns, "grows_too_far", null, destinations(AlertLimits.MAX_DESTINATIONS));
    String oneMore =
        "[{\"op\":\"add\",\"path\":\"/destinations/-\",\"value\":"
            + JsonUtils.pojoToJson(destination(AlertLimits.MAX_DESTINATIONS))
            + "}]";
    String largerBatch =
        "[{\"op\":\"replace\",\"path\":\"/batchSize\",\"value\":"
            + (AlertLimits.MAX_BATCH_SIZE + 1)
            + "}]";

    assertBadRequest(() -> patch(alert, oneMore), "a 51st destination was added");
    assertBadRequest(() -> patch(alert, largerBatch), "batchSize was raised to 1001");
  }

  // As an alert saved before the limit existed would be: it can still be described.
  @Test
  void anAlertStoredPastTheLimitsCanStillBeEdited(TestNamespace ns) {
    EventSubscription alert =
        AlertFixtures.tableAlert(ns, "stored_past_limits", null, destinations(1));
    List<SubscriptionDestination> sixty = destinations(60);
    AlertFixtures.writeBehindTheServer(
        alert.withDestinations(sixty).withBatchSize(AlertLimits.MAX_BATCH_SIZE + 500));

    assertDoesNotThrow(() -> patch(alert, DESCRIBE));
    EventSubscription edited = AlertFixtures.stored(alert.getId());
    assertEquals("edited", edited.getDescription());
    assertEquals(60, edited.getDestinations().size());
  }

  private static void patch(EventSubscription alert, String patch) {
    SdkClients.adminClient().eventSubscriptions().patch(alert.getId(), JsonUtils.readTree(patch));
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
    return AlertFixtures.external(WEBHOOK, ENDPOINT + index).withId(UUID.randomUUID());
  }
}
