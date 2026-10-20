package org.openmetadata.service.alerting.definition;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertCapabilities;
import org.openmetadata.schema.api.events.AlertCapabilitiesRequest;
import org.openmetadata.schema.api.events.AlertConditionCapability;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.AlertSourceCapability;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertSourceKind;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.utils.JsonUtils;

/** What the form is told about a selection: the same rules the save applies, before the save. */
class SourceCapabilitiesTest {

  // The table the form held before the catalog said it: what each source left out.
  private static final Set<SubscriptionCategory> FORMER_DEFAULT_EXCLUDES =
      EnumSet.of(SubscriptionCategory.ASSIGNEES, SubscriptionCategory.MENTIONS);
  private static final Map<String, Set<SubscriptionCategory>> FORMER_EXCLUDES =
      Map.of(
          "task",
          EnumSet.of(
              SubscriptionCategory.FOLLOWERS,
              SubscriptionCategory.ADMINS,
              SubscriptionCategory.USERS,
              SubscriptionCategory.TEAMS),
          "conversation",
          EnumSet.of(
              SubscriptionCategory.FOLLOWERS,
              SubscriptionCategory.ADMINS,
              SubscriptionCategory.USERS,
              SubscriptionCategory.TEAMS,
              SubscriptionCategory.ASSIGNEES),
          "announcement",
          EnumSet.of(SubscriptionCategory.ASSIGNEES));

  @BeforeAll
  static void loadCatalog() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
  }

  @Test
  void nothingSelectedListsEverySourceWithItsKind() {
    AlertCapabilities capabilities = of(AlertType.NOTIFICATION, List.of(), null);

    assertEquals(28, capabilities.getSources().size(), "every offered source, and none removed");
    assertEquals(AlertSourceKind.ALL, source(capabilities, "all").getKind());
    assertEquals(AlertSourceKind.ACTIVITY, source(capabilities, "conversation").getKind());
    assertEquals(AlertSourceKind.ENTITY, source(capabilities, "table").getKind());
    assertTrue(capabilities.getSources().stream().allMatch(AlertSourceCapability::getCanJoin));
  }

  @Test
  void sourceThatWouldBreakARuleSaysWhy() {
    AlertCapabilities capabilities = of(AlertType.NOTIFICATION, List.of("table"), null);

    assertTrue(source(capabilities, "table").getSelected());
    assertTrue(source(capabilities, "topic").getCanJoin());
    assertFalse(source(capabilities, "conversation").getCanJoin());
    assertTrue(source(capabilities, "conversation").getReason().contains("different kinds"));
    assertTrue(source(capabilities, "all").getReason().contains("already watches everything"));
  }

  @Test
  void filtersAreWhatEverySourceSupportsAndTriggersSayWhichSourcesTheyApplyTo() {
    AlertCapabilities capabilities =
        of(AlertType.OBSERVABILITY, List.of("testCase", "table"), null);

    assertFalse(names(capabilities.getFilters()).contains("filterByTableNameTestCaseBelongsTo"));
    assertTrue(names(capabilities.getFilters()).contains("filterByOwner"));
    assertEquals(List.of("table"), trigger(capabilities, "GetTableSchemaChanges").getSources());
    assertEquals(
        List.of("testCase"), trigger(capabilities, "GetTestCaseStatusUpdates").getSources());
    assertTrue(capabilities.getContainerEntities().contains("databaseService"));
  }

  // Each source names the name filter after its own assets; together they share no such name.
  @Test
  void filterTheSourcesNameDifferentlyTakesTheCatalogsOwnName() {
    for (List<String> picked : bothOrders("pipeline", "ingestionPipeline")) {
      EventFilterRule byName = filter(of(AlertType.OBSERVABILITY, picked, null), "filterByFqn");

      assertEquals("Entity FQN", byName.getDisplayName(), picked.toString());
      assertEquals("Event Filtering By Entity FQN", byName.getDescription(), picked.toString());
    }
  }

  @Test
  void filterEverySourceNamesAlikeKeepsThatName() {
    EventFilterRule byBot =
        filter(
            of(AlertType.OBSERVABILITY, List.of("pipeline", "ingestionPipeline"), null),
            "filterByUpdaterIsBot");

    assertEquals("Update is Bot", byBot.getDisplayName());
    assertEquals("Event Filtering By Updater is Bot", byBot.getDescription());
  }

  @Test
  void oneSourceKeepsItsOwnNames() {
    assertEquals(
        "Pipeline Name",
        filter(of(AlertType.OBSERVABILITY, List.of("pipeline"), null), "filterByFqn")
            .getDisplayName());
  }

  // A source's filters keep the order it lists them in; several follow the first by name.
  @Test
  void filtersKeepTheOrderTheirSourceListsThem() {
    assertEquals(
        List.of("filterByFqn", "filterByOwner", "filterByDomain", "filterByUpdaterIsBot"),
        names(of(AlertType.OBSERVABILITY, List.of("testSuite"), null).getFilters()));
    assertEquals(
        List.of("filterByFqn", "filterByDomain", "filterByOwner", "filterByUpdaterIsBot"),
        names(of(AlertType.OBSERVABILITY, List.of("testSuite", "table"), null).getFilters()));
  }

  // Test suites list their filters in another order than tables; neither order leaks out.
  @Test
  void answerIsTheSameWhateverOrderTheSourcesWerePickedIn() {
    List<List<String>> orders = bothOrders("testSuite", "table");
    AlertCapabilities one = of(AlertType.OBSERVABILITY, orders.get(0), null);
    AlertCapabilities other = of(AlertType.OBSERVABILITY, orders.get(1), null);

    assertEquals(JsonUtils.pojoToJson(one.getFilters()), JsonUtils.pojoToJson(other.getFilters()));
    assertEquals(
        JsonUtils.pojoToJson(one.getTriggers()), JsonUtils.pojoToJson(other.getTriggers()));
  }

  // An alert saved with a source the catalog retired still opens and shows what it holds.
  @Test
  void retiredSourceOfASavedAlertIsDescribed() {
    AlertCapabilities capabilities = of(AlertType.NOTIFICATION, List.of("location"), null);

    assertTrue(names(capabilities.getFilters()).contains("filterByOwnerName"));
  }

  @Test
  void invalidSelectionIsRefusedByTheRuleItBreaks() {
    assertThrows(
        BadRequestException.class,
        () -> of(AlertType.NOTIFICATION, List.of("table", "conversation"), null));
    assertThrows(BadRequestException.class, () -> of(AlertType.CUSTOM, List.of("table"), null));
  }

  @Test
  void sourceNoChosenTriggerAppliesToIsWarnedAbout() {
    AlertFilteringInput onlyTheTableTrigger =
        new AlertFilteringInput()
            .withActions(List.of(new ArgumentsInput().withName("GetTableSchemaChanges")));

    AlertCapabilities capabilities =
        of(AlertType.OBSERVABILITY, List.of("table", "topic"), onlyTheTableTrigger);

    assertNull(source(capabilities, "table").getWarning());
    assertEquals(
        "No chosen trigger applies to this source, so none of its events match.",
        source(capabilities, "topic").getWarning());
  }

  @Test
  void sourceThatNeverEmitsTheChosenEventTypesIsWarnedAbout() {
    AlertFilteringInput onlyMentions =
        new AlertFilteringInput()
            .withFilters(
                List.of(
                    new ArgumentsInput()
                        .withName("filterByEventType")
                        .withArguments(
                            List.of(
                                new Argument()
                                    .withName("eventTypeList")
                                    .withInput(List.of("noSuchEventType"))))));

    AlertCapabilities capabilities =
        of(AlertType.NOTIFICATION, List.of("table", "topic"), onlyMentions);

    assertEquals(
        "This source never emits any of the chosen event types.",
        source(capabilities, "table").getWarning());
  }

  @Test
  void recipientCategoriesMatchTheFormerUiTable() {
    for (AlertType alertType : List.of(AlertType.NOTIFICATION, AlertType.OBSERVABILITY)) {
      List<List<String>> selections = new ArrayList<>();
      selections.add(List.of());
      of(alertType, List.of(), null)
          .getSources()
          .forEach(source -> selections.add(List.of(source.getName())));
      if (alertType == AlertType.NOTIFICATION) {
        selections.add(List.of("task", "conversation"));
        selections.add(List.of("announcement", "task", "conversation"));
      }
      for (List<String> selected : selections) {
        assertEquals(
            formerlyOffered(selected),
            Set.copyOf(of(alertType, selected, null).getRecipientCategories()),
            alertType + " " + selected);
      }
    }
  }

  // A category was offered unless every selected source left it out.
  private static Set<SubscriptionCategory> formerlyOffered(List<String> selected) {
    List<Set<SubscriptionCategory>> excludes =
        (selected.isEmpty() ? List.of("") : selected)
            .stream()
                .map(source -> FORMER_EXCLUDES.getOrDefault(source, FORMER_DEFAULT_EXCLUDES))
                .toList();
    Set<SubscriptionCategory> offered =
        EnumSet.complementOf(EnumSet.of(SubscriptionCategory.EXTERNAL));
    offered.removeIf(category -> excludes.stream().allMatch(left -> left.contains(category)));
    return offered;
  }

  private static AlertCapabilities of(
      AlertType alertType, List<String> sources, AlertFilteringInput input) {
    return SourceCapabilities.of(
        new AlertCapabilitiesRequest()
            .withAlertType(alertType)
            .withSources(sources)
            .withInput(input));
  }

  private static List<List<String>> bothOrders(String first, String second) {
    return List.of(List.of(first, second), List.of(second, first));
  }

  private static EventFilterRule filter(AlertCapabilities capabilities, String name) {
    return capabilities.getFilters().stream()
        .map(AlertConditionCapability::getCondition)
        .filter(filter -> name.equals(filter.getName()))
        .findFirst()
        .orElseThrow();
  }

  private static AlertSourceCapability source(AlertCapabilities capabilities, String name) {
    return capabilities.getSources().stream()
        .filter(source -> name.equals(source.getName()))
        .findFirst()
        .orElseThrow();
  }

  private static AlertConditionCapability trigger(AlertCapabilities capabilities, String name) {
    return capabilities.getTriggers().stream()
        .filter(trigger -> name.equals(trigger.getCondition().getName()))
        .findFirst()
        .orElseThrow();
  }

  private static List<String> names(List<AlertConditionCapability> conditions) {
    return conditions.stream().map(condition -> condition.getCondition().getName()).toList();
  }
}
