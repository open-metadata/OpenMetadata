package org.openmetadata.service.alerting.definition;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
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
import org.openmetadata.service.Entity;

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
  void oneSourceKeepsItsOwnNames() {
    assertEquals(
        "Pipeline Name",
        filter(of(AlertType.OBSERVABILITY, List.of("pipeline"), null), "filterByFqn")
            .getDisplayName());
  }

  // No source renames it, so it reads the same alone, shared, and in either kind of alert.
  @Test
  void botFilterHasOneName() {
    for (AlertCapabilities capabilities :
        List.of(
            of(AlertType.OBSERVABILITY, List.of("pipeline"), null),
            of(AlertType.OBSERVABILITY, List.of("pipeline", "ingestionPipeline"), null),
            of(AlertType.NOTIFICATION, List.of("table"), null))) {
      assertEquals("Update is Bot", filter(capabilities, "filterByUpdaterIsBot").getDisplayName());
    }
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

  // An activity source lists its own: a conversation reaches the owners of what it is about.
  @Test
  void entitySourceOffersOnlyTheOwnersAndFollowersItsTypeHolds() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      for (String type : List.of(Entity.GLOSSARY_TERM, Entity.CONVERSATION)) {
        entity.when(() -> Entity.hasEntityRepository(type)).thenReturn(true);
        entity.when(() -> Entity.entityHasField(type, Entity.FIELD_FOLLOWERS)).thenReturn(false);
      }
      entity
          .when(() -> Entity.entityHasField(Entity.GLOSSARY_TERM, Entity.FIELD_OWNERS))
          .thenReturn(true);
      entity
          .when(() -> Entity.entityHasField(Entity.CONVERSATION, Entity.FIELD_OWNERS))
          .thenReturn(false);

      assertEquals(
          List.of(
              SubscriptionCategory.USERS,
              SubscriptionCategory.TEAMS,
              SubscriptionCategory.ADMINS,
              SubscriptionCategory.OWNERS),
          of(AlertType.NOTIFICATION, List.of(Entity.GLOSSARY_TERM), null).getRecipientCategories());
      assertEquals(
          List.of(SubscriptionCategory.OWNERS, SubscriptionCategory.MENTIONS),
          of(AlertType.NOTIFICATION, List.of(Entity.CONVERSATION), null).getRecipientCategories());
    }
  }

  // Downstream delivery starts from what they cover, so it reaches the followers of those assets.
  @Test
  void entitySourceOffersTheFollowersDownstreamDeliveryReaches() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      for (String type : List.of(Entity.TEST_SUITE, Entity.DATA_CONTRACT)) {
        entity.when(() -> Entity.hasEntityRepository(type)).thenReturn(true);
        entity.when(() -> Entity.entityHasField(type, Entity.FIELD_OWNERS)).thenReturn(true);
        entity.when(() -> Entity.entityHasField(type, Entity.FIELD_FOLLOWERS)).thenReturn(false);

        assertEquals(
            EventsSubscriptionRegistry.defaultRecipientCategories(),
            of(AlertType.OBSERVABILITY, List.of(type), null).getRecipientCategories(),
            type);
      }
    }
  }

  @Test
  void recipientsAreWhatTheSourcesOffer() {
    assertEquals(
        List.of(SubscriptionCategory.ASSIGNEES, SubscriptionCategory.MENTIONS),
        of(AlertType.NOTIFICATION, List.of("task"), null).getRecipientCategories());
    assertEquals(
        List.of(
            SubscriptionCategory.ASSIGNEES,
            SubscriptionCategory.OWNERS,
            SubscriptionCategory.MENTIONS),
        of(AlertType.NOTIFICATION, List.of("task", "conversation"), null).getRecipientCategories());
  }

  @Test
  void nothingSelectedOffersTheDefaultRecipients() {
    assertEquals(
        EventsSubscriptionRegistry.defaultRecipientCategories(),
        of(AlertType.NOTIFICATION, List.of(), null).getRecipientCategories());
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
