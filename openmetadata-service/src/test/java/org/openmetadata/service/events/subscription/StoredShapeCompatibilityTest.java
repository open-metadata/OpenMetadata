package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.networknt.schema.Error;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.CopyForOlderServers;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/**
 * Everything this release writes where a server of the previous release reads must parse there.
 * Every stored alerting shape of that release declares additionalProperties false and its mapper
 * rejects unknown fields, so its own schemas, copied under compat/, are the judge. The previous
 * release's classes cannot be on this classpath: they have the same names as the current ones.
 */
class StoredShapeCompatibilityTest {

  private static final String PREVIOUS_RELEASE = "classpath:compat/json/schema/";
  private static final SchemaRegistry REGISTRY =
      SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_7);

  private final EventSubscriptionDAO subscriptionDao = mock(EventSubscriptionDAO.class);
  private final EventSubscription alert = storedAlert();

  @Test
  void jobDataCopyParsesInThePreviousRelease() {
    Map<String, Object> jobData = CopyForOlderServers.dataFor(alert, Map.of()).getWrappedMap();

    assertEquals(List.of(AbstractEventConsumer.ALERT_INFO_KEY), List.copyOf(jobData.keySet()));
    assertValid("events/eventSubscription.json", (String) jobData.get("alertInfoKey"));
  }

  // An alert with several sources stays stored after a rollback, and that release must parse it:
  // a list of sources and one more rule are all it sees.
  @Test
  void multiSourceRowParsesInThePreviousRelease() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
    AlertFilteringInput schemaChanged =
        new AlertFilteringInput()
            .withActions(
                List.of(
                    new ArgumentsInput().withName("GetTableSchemaChanges"),
                    new ArgumentsInput().withName("GetTopicSchemaChanges")));
    EventSubscription severalSources =
        storedAlert()
            .withAlertType(CreateEventSubscription.AlertType.OBSERVABILITY)
            .withInput(schemaChanged)
            .withFilteringRules(
                AlertUtil.validateAndBuildFilteringConditions(
                    List.of("table", "topic"),
                    CreateEventSubscription.AlertType.OBSERVABILITY,
                    schemaChanged));

    assertValid("events/eventSubscription.json", JsonUtils.pojoToJson(severalSources));
  }

  @Test
  void positionWrittenWhenAnAlertIsScheduledParsesInThePreviousRelease() {
    withTheDao(() -> AlertRecord.start(alert));

    assertValid("events/eventSubscriptionOffset.json", insertedUnder(LedgerKeys.POSITION));
  }

  @Test
  void positionAndCountersWrittenByACommitParseInThePreviousRelease() {
    when(subscriptionDao.compareAndSetSubscriberExtension(
            anyString(), eq(LedgerKeys.POSITION), anyString(), anyString()))
        .thenReturn(1);
    when(subscriptionDao.insertSubscriberExtensionIfAbsent(
            anyString(), eq(LedgerKeys.COUNTERS), anyString(), anyString()))
        .thenReturn(1);
    AlertLedger ledger = ledgerAt(7);
    ledger.readUpTo(9L, 0L);
    ledger.eventsRead(2);
    ledger.channelOutcomes(1, 1);

    withTheDao(ledger::commit);

    ArgumentCaptor<String> position = ArgumentCaptor.forClass(String.class);
    verify(subscriptionDao)
        .compareAndSetSubscriberExtension(
            anyString(), eq(LedgerKeys.POSITION), position.capture(), anyString());
    assertValid("events/eventSubscriptionOffset.json", position.getValue());
    assertValid("events/alertMetrics.json", insertedUnder(LedgerKeys.COUNTERS));
  }

  @Test
  void failureRowParsesInThePreviousRelease() {
    when(subscriptionDao.getSubscriberExtension(anyString(), eq(LedgerKeys.POSITION)))
        .thenReturn(positionAt(7));
    FailedEvent failure =
        new FailedEvent()
            .withFailingSubscriptionId(alert.getDestinations().getFirst().getId())
            .withChangeEvent(tableCreated())
            .withRetriesLeft(3)
            .withReason("Webhook delivery failed with HTTP 500; Slack delivery failed")
            .withTimestamp(1L);
    AlertLedger ledger = ledgerAt(7);
    ledger.failure("eventSubscription.failedEvent-x", JsonUtils.pojoToJson(failure), "SUBSCRIBER");

    withTheDao(ledger::commit);

    ArgumentCaptor<String> row = ArgumentCaptor.forClass(String.class);
    verify(subscriptionDao).upsertFailedEvent(anyString(), anyString(), row.capture(), any());
    assertValid("events/failedEvent.json", row.getValue());
  }

  private void withTheDao(Runnable write) {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.eventSubscriptionDAO()).thenReturn(subscriptionDao);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      write.run();
    }
  }

  private String insertedUnder(String key) {
    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(subscriptionDao)
        .insertSubscriberExtensionIfAbsent(anyString(), eq(key), anyString(), json.capture());
    return json.getValue();
  }

  private AlertLedger ledgerAt(long offset) {
    return new AlertLedger(alert, Map.of(LedgerKeys.POSITION, positionAt(offset)));
  }

  private static String positionAt(long offset) {
    return String.format(
        "{\"currentOffset\":%d,\"startingOffset\":1,\"startingTimestamp\":1,\"timestamp\":1}",
        offset);
  }

  private static void assertValid(String schemaOfThePreviousRelease, String written) {
    List<Error> errors =
        REGISTRY
            .getSchema(SchemaLocation.of(PREVIOUS_RELEASE + schemaOfThePreviousRelease))
            .validate(JsonUtils.readTree(written))
            .stream()
            .filter(error -> !isAboutADestinationsConfig(error))
            .toList();
    assertTrue(errors.isEmpty(), schemaOfThePreviousRelease + " rejects it: " + errors);
  }

  // The previous release reads a destination's config as an untyped object. Its schema lists the
  // webhook shape and a free-form map under oneOf, and a webhook is valid as both, so even an
  // alert that release wrote itself fails there. Nothing in this release changes that shape.
  private static boolean isAboutADestinationsConfig(Error error) {
    return error.getInstanceLocation().toString().matches("/destinations/\\d+/config.*");
  }

  private static EventSubscription storedAlert() {
    SubscriptionDestination webhook =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withEnabled(true)
            .withTimeout(10)
            .withReadTimeout(12)
            .withConfig(new Webhook().withEndpoint(URI.create("https://hooks.example.com/a")));
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("orders-changed")
        .withFullyQualifiedName("orders-changed")
        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
        .withFilteringRules(new FilteringRules().withResources(List.of("table")))
        .withEnabled(true)
        .withBatchSize(100)
        .withPollInterval(60)
        .withRetries(3)
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin")
        .withDestinations(List.of(webhook));
  }

  private static ChangeEvent tableCreated() {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_CREATED)
        .withEntityType("table")
        .withEntityId(UUID.randomUUID())
        .withUserName("admin")
        .withTimestamp(1L);
  }
}
