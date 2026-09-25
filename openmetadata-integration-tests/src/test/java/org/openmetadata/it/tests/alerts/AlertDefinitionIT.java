package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import org.openmetadata.schema.api.events.AlertCapabilities;
import org.openmetadata.schema.api.events.AlertCapabilitiesRequest;
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
  // What the form sends for an alert without selections: it keeps the rules and adds empty lists.
  private static final String FORM_SAVE_WITHOUT_SELECTIONS =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"saved in the form\"},"
          + "{\"op\":\"add\",\"path\":\"/input\",\"value\":{\"actions\":[],\"filters\":[]}}]";
  private static final EventFilterRule WRITTEN =
      new EventFilterRule()
          .withName("writtenByHand")
          .withEffect(ArgumentsInput.Effect.INCLUDE)
          .withCondition("matchAnyEventType({'entityCreated'})");

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
  void handWrittenNotificationRulesSurviveFormSaves(TestNamespace ns) {
    CreateEventSubscription request = tableAlert(ns, "hand_written_notification");
    EventSubscription alert = handWritten(create(request));

    for (int save = 0; save < 2; save++) {
      put(request.withDescription("put " + save));
      patch(alert, FORM_SAVE_WITHOUT_SELECTIONS);

      assertEquals(
          List.of(WRITTEN), AlertFixtures.stored(alert.getId()).getFilteringRules().getRules());
    }
  }

  @Test
  void formSelectionsTurnAHandWrittenAlertIntoACompiledOne(TestNamespace ns) {
    EventSubscription alert = handWritten(create(tableAlert(ns, "converted_by_the_form")));
    String chooseAnOwner =
        "[{\"op\":\"add\",\"path\":\"/input\",\"value\":{\"actions\":[],\"filters\":"
            + JsonUtils.pojoToJson(List.of(selection("filterByOwnerName", "alice")))
            + "}}]";

    patch(alert, chooseAnOwner);

    assertEquals(
        List.of("matchAnyOwnerName({'alice'})"),
        AlertFixtures.stored(alert.getId()).getFilteringRules().getRules().stream()
            .map(EventFilterRule::getCondition)
            .toList());
  }

  // Rules written by hand name the one resource they were written for.
  @Test
  void customAlertNeedsExactlyOneResource(TestNamespace ns) {
    CreateEventSubscription none =
        tableAlert(ns, "custom_no_resource")
            .withAlertType(AlertType.CUSTOM)
            .withResources(List.of());
    CreateEventSubscription two =
        tableAlert(ns, "custom_two_resources")
            .withAlertType(AlertType.CUSTOM)
            .withResources(List.of("table", "topic"));
    CreateEventSubscription one =
        tableAlert(ns, "custom_one_resource").withAlertType(AlertType.CUSTOM);
    EventSubscription created = create(one);

    assertTrue(messageOfTheRefusal(() -> create(none)).contains("One resource can be specified"));
    assertTrue(messageOfTheRefusal(() -> create(two)).contains("One resource can be specified"));
    assertRejected(
        () ->
            patch(
                created,
                "[{\"op\":\"add\",\"path\":\"/filteringRules/resources/-\",\"value\":\"topic\"}]"));
  }

  @Test
  void definitionChangeIsValidated(TestNamespace ns) {
    CreateEventSubscription request = tableAlert(ns, "validated_change");
    EventSubscription alert = create(request);
    String filterNoSourceHas =
        "[{\"op\":\"add\",\"path\":\"/input\",\"value\":{\"filters\":"
            + "[{\"name\":\"filterNoSourceHas\",\"effect\":\"include\",\"arguments\":[]}]}}]";

    assertRejected(() -> put(request.withResources(List.of("table", "conversation"))));
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

  @Test
  void twoCompatibleSourcesAreCreated(TestNamespace ns) {
    EventSubscription alert =
        create(tableAlert(ns, "tables_and_topics").withResources(List.of("table", "topic")));

    assertEquals(List.of("table", "topic"), alert.getFilteringRules().getResources());
    put(
        tableAlert(ns, "tables_and_topics")
            .withResources(List.of("table", "topic", "pipeline"))
            .withDescription("and pipelines"));
    assertEquals(
        List.of("table", "topic", "pipeline"),
        AlertFixtures.stored(alert.getId()).getFilteringRules().getResources());
  }

  @Test
  void entityPlusActivityIs400(TestNamespace ns) {
    String refused =
        messageOfTheRefusal(
            () ->
                create(
                    tableAlert(ns, "two_kinds").withResources(List.of("table", "conversation"))));

    assertTrue(refused.contains("table is an entity source"), refused);
    assertTrue(refused.contains("conversation is an activity source"), refused);
  }

  @Test
  void filterUnsupportedBySourceIs400WithSourceNames(TestNamespace ns) {
    CreateEventSubscription request =
        tableAlert(ns, "filter_one_source_lacks")
            .withResources(List.of("conversation", "task", "announcement"))
            .withInput(
                new AlertFilteringInput()
                    .withFilters(List.of(selection("filterByMentionedName", "alice"))));

    String refused = messageOfTheRefusal(() -> create(request));

    assertTrue(
        refused.contains("'filterByMentionedName' is not supported by: announcement"), refused);
  }

  @Test
  void triggerNoSourceSupportsIs400(TestNamespace ns) {
    CreateEventSubscription request =
        tableAlert(ns, "trigger_nobody_supports")
            .withAlertType(AlertType.OBSERVABILITY)
            .withResources(List.of("table", "topic"))
            .withInput(
                new AlertFilteringInput()
                    .withActions(
                        List.of(new ArgumentsInput().withName("GetContainerSchemaChanges"))));

    String refused = messageOfTheRefusal(() -> create(request));

    assertTrue(
        refused.contains("'GetContainerSchemaChanges' is not supported by any source"), refused);
  }

  // Topic can never match with only the table trigger chosen. That is a warning, not an error.
  @Test
  void uncoveredSourceSavesAndCapabilitiesWarn(TestNamespace ns) {
    AlertFilteringInput onlyTheTableTrigger =
        new AlertFilteringInput()
            .withActions(List.of(new ArgumentsInput().withName("GetTableSchemaChanges")));
    EventSubscription alert =
        create(
            tableAlert(ns, "uncovered_source")
                .withAlertType(AlertType.OBSERVABILITY)
                .withResources(List.of("table", "topic"))
                .withInput(onlyTheTableTrigger));

    AlertCapabilities capabilities =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                ALERTS_PATH + "/capabilities",
                new AlertCapabilitiesRequest()
                    .withAlertType(AlertType.OBSERVABILITY)
                    .withSources(List.of("table", "topic"))
                    .withInput(onlyTheTableTrigger),
                AlertCapabilities.class);

    assertEquals(1, alert.getFilteringRules().getActions().size());
    String warning =
        capabilities.getSources().stream()
            .filter(source -> "topic".equals(source.getName()))
            .findFirst()
            .orElseThrow()
            .getWarning();
    assertEquals("No chosen trigger applies to this source, so none of its events match.", warning);
  }

  // Destinations were checked by the REST resource on POST and PUT only, so a PATCH could store
  // one that no channel can deliver to.
  @Test
  void patchedInvalidDestinationIs400(TestNamespace ns) {
    EventSubscription alert = create(tableAlert(ns, "patched_invalid_destination"));

    String message =
        messageOfTheRefusal(
            () ->
                patch(
                    alert,
                    "[{\"op\":\"replace\",\"path\":\"/destinations/0/config/endpoint\","
                        + "\"value\":\"ftp://not-a-webhook.example.com\"}]"));

    assertTrue(message.contains("Invalid webhook endpoint URL"), message);
  }

  // A destination saved under older rules must not stop its alert from being edited.
  @Test
  void renameOfAlertWithStaleDestinationSucceeds(TestNamespace ns) {
    EventSubscription alert = withADestinationTodaysRulesReject(ns, "stale_destination_rename");

    patch(alert, "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"Renamed\"}]");

    assertEquals("Renamed", AlertFixtures.stored(alert.getId()).getDisplayName());
  }

  @Test
  void unchangedDestinationIsNotRevalidated(TestNamespace ns) {
    EventSubscription alert = withADestinationTodaysRulesReject(ns, "stale_destination_put");
    CreateEventSubscription sameDestinations =
        tableAlert(ns, "stale_destination_put")
            .withDescription("edited by put")
            .withDestinations(alert.getDestinations());

    put(sameDestinations);

    assertEquals("edited by put", AlertFixtures.stored(alert.getId()).getDescription());
    assertRejected(
        () ->
            patch(
                alert,
                "[{\"op\":\"replace\",\"path\":\"/destinations/0/config/endpoint\","
                    + "\"value\":\"ftp://still-not-a-webhook.example.com\"}]"));
  }

  @Test
  void registeredChannelIsAccepted(TestNamespace ns) {
    CreateEventSubscription request = tableAlert(ns, "channel_registered");
    request.getDestinations().getFirst().withChannel("Webhook");

    EventSubscription created = create(request);

    EventSubscription stored = AlertFixtures.stored(created.getId());
    assertEquals("Webhook", stored.getDestinations().getFirst().getChannel());
  }

  @Test
  void unregisteredChannelIs400(TestNamespace ns) {
    CreateEventSubscription request = tableAlert(ns, "channel_unregistered");
    request.getDestinations().getFirst().withChannel("not.registered.here");
    EventSubscription plain = create(tableAlert(ns, "channel_unregistered_by_patch"));

    String message = messageOfTheRefusal(() -> create(request));

    assertTrue(message.contains("No channel not.registered.here is registered"), message);
    assertRejected(
        () ->
            patch(
                plain,
                "[{\"op\":\"add\",\"path\":\"/destinations/0/channel\","
                    + "\"value\":\"not.registered.here\"}]"));
  }

  // A client that does not know the field leaves it out, and the alert is delivered by its type.
  @Test
  void saveLeavingChannelOutSucceeds(TestNamespace ns) {
    CreateEventSubscription request = tableAlert(ns, "channel_left_out");
    request.getDestinations().getFirst().withChannel("Webhook");
    EventSubscription created = create(request);

    put(tableAlert(ns, "channel_left_out").withDescription("saved without the field"));

    EventSubscription stored = AlertFixtures.stored(created.getId());
    assertEquals("saved without the field", stored.getDescription());
    assertNull(stored.getDestinations().getFirst().getChannel());
  }

  private static EventSubscription withADestinationTodaysRulesReject(
      TestNamespace ns, String name) {
    EventSubscription alert = create(tableAlert(ns, name));
    alert
        .getDestinations()
        .getFirst()
        .withConfig(new Webhook().withEndpoint(URI.create("ftp://saved-long-ago.example.com")));
    return AlertFixtures.writeBehindTheServer(alert);
  }

  private static String messageOfTheRefusal(Runnable save) {
    OpenMetadataException rejected = assertThrows(OpenMetadataException.class, save::run);
    assertEquals(400, rejected.getStatusCode());
    return String.valueOf(rejected.getMessage());
  }

  private static void assertRejected(Runnable save) {
    OpenMetadataException rejected = assertThrows(OpenMetadataException.class, save::run);
    assertEquals(400, rejected.getStatusCode());
  }

  // As an earlier release or a direct API client left it: rules, and no selections behind them.
  private static EventSubscription handWritten(EventSubscription alert) {
    alert.getFilteringRules().setRules(new ArrayList<>(List.of(WRITTEN)));
    return AlertFixtures.writeBehindTheServer(alert);
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
