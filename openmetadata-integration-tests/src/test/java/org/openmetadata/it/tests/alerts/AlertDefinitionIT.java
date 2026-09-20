package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Saving an alert validates what the save changes. What was stored long ago, under older rules or
 * by an upgrade, never stops an alert from being renamed or switched back on.
 */
@ExtendWith(TestNamespaceExtension.class)
class AlertDefinitionIT {

  private static final String ALERTS_PATH = "/v1/events/subscriptions";
  // What the form sends for a description edit: it rebuilds the selections on every save.
  private static final String UI_DESCRIPTION_SAVE =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"edited in the form\"},"
          + "{\"op\":\"add\",\"path\":\"/input/actions\",\"value\":[]}]";

  @Test
  void migratedMentionAlertIsEditableByPutAndPatch(TestNamespace ns) {
    CreateEventSubscription request = mentionAlert(ns, "migrated_mentions");
    EventSubscription alert = upgradedAsTheMigrationDoes(create(request));

    put(request.withResources(List.of("conversation", "task")).withDescription("edited by put"));
    patch(alert, "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"edited by patch\"}]");
    patch(alert, "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":false}]");
    patch(alert, "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":true}]");

    EventSubscription afterwards = AlertFixtures.stored(alert.getId());
    assertEquals("edited by patch", afterwards.getDescription());
    assertTrue(afterwards.getEnabled());
    assertEquals(List.of("conversation", "task"), afterwards.getFilteringRules().getResources());
    assertEquals(1, afterwards.getFilteringRules().getRules().size(), "the stored text is kept");
  }

  @Test
  void uiDescriptionSaveOfAlertWithoutActionsSucceeds(TestNamespace ns) {
    EventSubscription alert =
        upgradedAsTheMigrationDoes(create(mentionAlert(ns, "saved_from_the_form")));

    patch(alert, UI_DESCRIPTION_SAVE);

    assertEquals("edited in the form", AlertFixtures.stored(alert.getId()).getDescription());
  }

  @Test
  void patchOfCustomAlertKeepsItsRules(TestNamespace ns) {
    CreateEventSubscription request =
        tableAlert(ns, "custom_rules").withAlertType(AlertType.CUSTOM);
    EventSubscription alert = create(request);
    EventFilterRule written =
        new EventFilterRule()
            .withName("writtenByHand")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withCondition("matchAnyEventType({'entityCreated'})");
    alert.getFilteringRules().setRules(new ArrayList<>(List.of(written)));
    AlertFixtures.writeBehindTheServer(alert);

    patch(alert, "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"patched\"}]");
    assertEquals(
        List.of(written), AlertFixtures.stored(alert.getId()).getFilteringRules().getRules());

    put(request.withDescription("and put"));
    assertEquals(
        List.of(written), AlertFixtures.stored(alert.getId()).getFilteringRules().getRules());
  }

  @Test
  void definitionChangeIsValidated(TestNamespace ns) {
    CreateEventSubscription request = tableAlert(ns, "validated_change");
    EventSubscription alert = create(request);
    String filterNoSourceHas =
        "[{\"op\":\"add\",\"path\":\"/input\",\"value\":{\"filters\":"
            + "[{\"name\":\"filterNoSourceHas\",\"effect\":\"include\",\"arguments\":[]}]}}]";

    assertRejected(() -> put(request.withResources(List.of("table", "topic"))));
    assertRejected(() -> patch(alert, filterNoSourceHas));
  }

  // The first edit leaves an outdated selection in place, the second replaces it. Both land in one
  // version, and only the definition that results may be judged.
  @Test
  void editsMergedInTheSessionWindowValidateTheFinalDefinition(TestNamespace ns) {
    EventSubscription alert = create(tableAlert(ns, "merged_edits"));
    alert.setInput(
        new AlertFilteringInput().withFilters(List.of(selection("filterLongGone", "x"))));
    AlertFixtures.writeBehindTheServer(alert);
    String replaceTheOutdatedFilter =
        "[{\"op\":\"replace\",\"path\":\"/input/filters\",\"value\":"
            + JsonUtils.pojoToJson(List.of(selection("filterByOwnerName", "alice")))
            + "}]";

    patch(alert, "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"first edit\"}]");
    patch(alert, replaceTheOutdatedFilter);

    EventSubscription afterwards = AlertFixtures.stored(alert.getId());
    assertEquals(
        "matchAnyOwnerName({'alice'})",
        afterwards.getFilteringRules().getRules().getFirst().getCondition());
  }

  @Test
  void putWithUnchangedDefinitionKeepsStoredText(TestNamespace ns) {
    CreateEventSubscription request =
        tableAlert(ns, "unchanged_definition")
            .withInput(
                new AlertFilteringInput()
                    .withFilters(List.of(selection("filterByOwnerName", "alice"))));
    EventSubscription alert = create(request);
    String storedText = JsonUtils.pojoToJson(alert.getFilteringRules());

    put(request.withDescription("only the description"));

    EventSubscription afterwards = AlertFixtures.stored(alert.getId());
    assertEquals(storedText, JsonUtils.pojoToJson(afterwards.getFilteringRules()));
    assertEquals("only the description", afterwards.getDescription());
  }

  private static void assertRejected(Runnable save) {
    OpenMetadataException rejected = assertThrows(OpenMetadataException.class, save::run);
    assertEquals(400, rejected.getStatusCode());
  }

  // The 2.0 upgrade adds "task" beside "conversation" straight in the stored row.
  private static EventSubscription upgradedAsTheMigrationDoes(EventSubscription alert) {
    alert.getFilteringRules().setResources(new ArrayList<>(List.of("conversation", "task")));
    return AlertFixtures.writeBehindTheServer(alert);
  }

  private static EventSubscription create(CreateEventSubscription request) {
    return AlertFixtures.stored(
        SdkClients.adminClient().eventSubscriptions().create(request).getId());
  }

  private static void put(CreateEventSubscription request) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, ALERTS_PATH, request, EventSubscription.class);
  }

  private static void patch(EventSubscription alert, String jsonPatch) {
    SdkClients.adminClient()
        .eventSubscriptions()
        .patch(alert.getId(), JsonUtils.readTree(jsonPatch));
  }

  private static CreateEventSubscription mentionAlert(TestNamespace ns, String name) {
    return tableAlert(ns, name)
        .withResources(List.of("conversation"))
        .withInput(
            new AlertFilteringInput()
                .withFilters(List.of(selection("filterByMentionedName", "alice"))));
  }

  private static CreateEventSubscription tableAlert(TestNamespace ns, String name) {
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withType(WEBHOOK)
            .withCategory(EXTERNAL)
            .withConfig(new Webhook().withEndpoint(URI.create("http://localhost:9/unused")));
    return new CreateEventSubscription()
        .withName(ns.prefix(name))
        .withAlertType(AlertType.NOTIFICATION)
        .withResources(List.of("table"))
        .withEnabled(true)
        .withPollInterval(86400)
        .withDestinations(List.of(destination));
  }

  private static ArgumentsInput selection(String filter, String value) {
    String argument =
        switch (filter) {
          case "filterByMentionedName" -> "userList";
          default -> "ownerNameList";
        };
    return new ArgumentsInput()
        .withName(filter)
        .withEffect(ArgumentsInput.Effect.INCLUDE)
        .withArguments(List.of(new Argument().withName(argument).withInput(List.of(value))));
  }
}
