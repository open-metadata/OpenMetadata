package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
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

/** What the form is told about a selection: the same rules the save applies, before the save. */
class SourceCapabilitiesTest {

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

  private static AlertCapabilities of(
      AlertType alertType, List<String> sources, AlertFilteringInput input) {
    return SourceCapabilities.of(
        new AlertCapabilitiesRequest()
            .withAlertType(alertType)
            .withSources(sources)
            .withInput(input));
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
