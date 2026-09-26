package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.FilteringRules;

/** Which sources combine, and what a broken rule says: a 400 that names what is wrong. */
class SeveralSourcesTest {

  @BeforeAll
  static void loadCatalog() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
  }

  @Test
  void sourcesOfOneKindCombine() {
    assertDoesNotThrow(() -> build(AlertType.NOTIFICATION, List.of("table", "topic"), null));
    assertDoesNotThrow(() -> build(AlertType.NOTIFICATION, List.of("conversation", "task"), null));
  }

  @Test
  void entityPlusActivityIsRefusedNamingBothKinds() {
    BadRequestException refused =
        refusal(AlertType.NOTIFICATION, List.of("table", "conversation"), null);

    assertEquals(
        "Sources of different kinds cannot be combined: table is an entity source, conversation is"
            + " an activity source. They share no filters; use one alert for each kind.",
        refused.getMessage());
  }

  @Test
  void wildcardStandsAlone() {
    assertTrue(
        refusal(AlertType.NOTIFICATION, List.of("all", "table"), null)
            .getMessage()
            .startsWith("The source 'all' already watches everything"));
  }

  @Test
  void unknownAndMissingSourcesAreNamed() {
    assertEquals(
        "'spreadsheet' is not a source of Notification alerts.",
        refusal(AlertType.NOTIFICATION, List.of("table", "spreadsheet"), null).getMessage());
    assertEquals(
        "An alert needs at least one source.",
        refusal(AlertType.OBSERVABILITY, List.of(), null).getMessage());
  }

  // Letter case is ignored for these checks, so this is one source, and one source is today's text.
  @Test
  void duplicatesCountOnce() {
    FilteringRules stored = build(AlertType.OBSERVABILITY, List.of("table", "Table"), null);

    assertEquals(List.of(), stored.getActions());
  }

  @Test
  void filterOneSourceLacksIsRefusedNamingThatSource() {
    AlertFilteringInput byTableOfTheTest =
        new AlertFilteringInput()
            .withFilters(List.of(chosen("filterByTableNameTestCaseBelongsTo", "tableNameList")));

    BadRequestException refused =
        refusal(AlertType.OBSERVABILITY, List.of("testCase", "table"), byTableOfTheTest);

    assertEquals(
        "Filter 'filterByTableNameTestCaseBelongsTo' is not supported by: table. A filter applies"
            + " to every event, so every source of the alert must support it.",
        refused.getMessage());
  }

  @Test
  void triggerNoSourceSupportsIsRefused() {
    AlertFilteringInput pipelineFailed =
        new AlertFilteringInput()
            .withActions(List.of(chosen("GetPipelineStatusUpdates", "pipelineStateList")));

    assertEquals(
        "Trigger 'GetPipelineStatusUpdates' is not supported by any source of the alert.",
        refusal(AlertType.OBSERVABILITY, List.of("table", "topic"), pipelineFailed).getMessage());
  }

  // Topic has no trigger here, so it has no branch: its events answer no, and the save succeeds.
  @Test
  void sourceWithoutATriggerHasNoBranchAndAnExcludedTriggerIsNegatedInItsGroup() {
    AlertFilteringInput schemaDidNotChange =
        new AlertFilteringInput()
            .withActions(
                List.of(
                    new ArgumentsInput()
                        .withName("GetTableSchemaChanges")
                        .withEffect(ArgumentsInput.Effect.EXCLUDE)));

    FilteringRules stored =
        build(AlertType.OBSERVABILITY, List.of("table", "topic"), schemaDidNotChange);

    assertEquals(
        "(matchAnySource({'table'}) && (!matchAnyFieldChange({'columns','dataModel','joins'})))",
        stored.getActions().getFirst().getCondition());
  }

  // The text is checked against no event when it is saved, and must hold up there.
  @Test
  void groupedTextIsValidConditionText() {
    AlertFilteringInput schemaChanged =
        new AlertFilteringInput()
            .withActions(List.of(new ArgumentsInput().withName("GetTableSchemaChanges")));
    FilteringRules stored =
        build(AlertType.OBSERVABILITY, List.of("table", "topic"), schemaChanged);

    assertDoesNotThrow(
        () ->
            AlertUtil.validateExpression(
                AlertUtil.buildCompleteCondition(stored.getActions()), Boolean.class));
  }

  private static FilteringRules build(
      AlertType alertType, List<String> sources, AlertFilteringInput input) {
    return AlertUtil.validateAndBuildFilteringConditions(sources, alertType, input);
  }

  private static BadRequestException refusal(
      AlertType alertType, List<String> sources, AlertFilteringInput input) {
    return assertThrows(BadRequestException.class, () -> build(alertType, sources, input));
  }

  private static ArgumentsInput chosen(String name, String argument) {
    return new ArgumentsInput()
        .withName(name)
        .withEffect(ArgumentsInput.Effect.INCLUDE)
        .withArguments(List.of(new Argument().withName(argument).withInput(List.of("fixture"))));
  }
}
