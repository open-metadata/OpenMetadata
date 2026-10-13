package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertCatalogSource;
import org.openmetadata.schema.entity.events.AlertSourceKind;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;

/**
 * What an alert can watch and filter on: every definition's condition is pinned, everything any
 * release offered still builds, and a catalog that cannot be read stops the server from starting.
 */
class AlertCatalogTest {

  private static final Path ALERTS = Path.of("src", "test", "resources", "alerts");
  private static final String SHIPPED_ENTRIES = "alert-catalog-shipped-entries.json";
  private static final String TWICE =
      "{\"name\":\"filterByOwner\",\"condition\":\"matchAnyOwnerName(${ownerNameList})\"}";
  // The entity behind tag categories has been called classification for years, so an alert on
  // this source cannot fire. It is listed so that the test stops the next one, not this one.
  private static final List<String> OFFERED_BEFORE_THIS_TEST_EXISTED_WITH_NO_ENTITY_TYPE =
      List.of("tagCategory");

  // The condition of a definition is what every saved alert that uses it was compiled from, and
  // what a rolled-back server evaluates. Changing one is a decision, so it is made in two places.
  @Test
  void conditionOfEveryDefinitionIsPinned() {
    Map<String, String> pinned =
        Map.ofEntries(
            Map.entry("filterBySource", "matchAnySource(${sourceList})"),
            Map.entry("filterByOwnerName", "matchAnyOwnerName(${ownerNameList})"),
            Map.entry("filterByFqn", "matchAnyEntityFqn(${fqnList})"),
            Map.entry("filterByEntityId", "matchAnyEntityId(${entityIdList})"),
            Map.entry("filterByEventType", "matchAnyEventType(${eventTypeList})"),
            Map.entry("filterByUpdaterName", "matchUpdatedBy(${updateByUserList})"),
            Map.entry("filterByFieldChange", "matchAnyFieldChange(${fieldChangeList})"),
            Map.entry("filterByDomain", "matchAnyDomain(${domainList})"),
            Map.entry("filterByMentionedName", "matchConversationUser(${userList})"),
            Map.entry(
                "filterByGeneralMetadataEvents", "matchAnyFieldChange({'description', 'tags'})"),
            Map.entry("filterByUpdaterIsBot", "isBot()"),
            Map.entry("filterByOwner", "matchAnyOwnerName(${ownerNameList})"),
            Map.entry(
                "filterByTableNameTestCaseBelongsTo",
                "filterByTableNameTestCaseBelongsTo(${tableNameList})"),
            Map.entry(
                "filterByEntityName", "filterByEntityNameDataContractBelongsTo(${entityNameList})"),
            Map.entry(
                "GetTableSchemaChanges", "matchAnyFieldChange({'columns','dataModel','joins'})"),
            Map.entry(
                "GetTableMetricsUpdates", "matchAnyFieldChange({'customMetrics', 'profile'})"),
            Map.entry("GetTopicSchemaChanges", "matchAnyFieldChange({'messageSchema'})"),
            Map.entry("GetContainerSchemaChanges", "matchAnyFieldChange({'parent','children'})"),
            Map.entry("GetPipelineStatusUpdates", "matchPipelineState(${pipelineStateList})"),
            Map.entry(
                "GetIngestionPipelineStatusUpdates",
                "matchIngestionPipelineState(${ingestionPipelineStateList})"),
            Map.entry("GetTestCaseStatusUpdates", "matchTestResult(${testResultList})"),
            Map.entry(
                "GetTestCaseStatusUpdatesUnderSuite",
                "getTestCaseStatusIfInTestSuite(${testStatusList}, ${testSuiteList})"),
            Map.entry("GetTestSuiteStatusUpdates", "matchTestResult(${testResultList})"),
            Map.entry(
                "GetDataContractStatusUpdates", "matchDataContractStatus(${contractStatusList})"),
            Map.entry(
                "GetTestCaseSchemaChanges",
                "matchAnyFieldChange({'testDefinition','parameterValues','description'})"),
            Map.entry(
                "GetTestSuiteSchemaChanges",
                "matchAnyFieldChange({'connection','pipelines','description'})"));

    Map<String, String> inTheCatalog = new TreeMap<>();
    AlertCatalog.load()
        .definitions()
        .forEach(definition -> inTheCatalog.put(definition.getName(), definition.getCondition()));

    assertEquals(new TreeMap<>(pinned), inTheCatalog);
  }

  // An alert saved by any release since 1.3.0 names only what that release offered. The fixture
  // lists all of it, read once from the catalog files of every release tag up to 2.0.
  @Test
  void everyShippedDefinitionStillBuilds() throws IOException {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
    JsonNode shipped = JsonUtils.readTree(Files.readString(ALERTS.resolve(SHIPPED_ENTRIES)));
    assertTrue(shipped.size() > 200, "the fixture of shipped entries is missing or cut short");

    for (JsonNode entry : shipped) {
      AlertType alertType = AlertType.fromValue(entry.get("alertType").asText());
      String source = entry.get("source").asText();
      assertDoesNotThrow(
          () ->
              AlertUtil.rebuildStoredFilteringConditions(
                  List.of(source), alertType, selectionOf(alertType, source, entry)),
          entry.toString());
    }
  }

  @Test
  void whatWasRemovedBuildsForSavedAlertsOnly() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
    AlertFilteringInput removedTrigger =
        new AlertFilteringInput()
            .withActions(List.of(new ArgumentsInput().withName("GetTestSuiteSchemaChanges")));

    assertDoesNotThrow(
        () ->
            AlertUtil.rebuildStoredFilteringConditions(
                List.of("testSuite"), AlertType.OBSERVABILITY, removedTrigger));
    assertThrows(
        BadRequestException.class,
        () ->
            AlertUtil.validateAndBuildFilteringConditions(
                List.of("testSuite"), AlertType.OBSERVABILITY, removedTrigger));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AlertUtil.validateAndBuildFilteringConditions(
                List.of("location"), AlertType.NOTIFICATION, null));
  }

  @Test
  void noDuplicateDefinitionNames() {
    AlertCatalogException refused =
        assertThrows(
            AlertCatalogException.class,
            () -> AlertCatalog.parse("broken.json", catalogWith(TWICE, TWICE, "[]")));

    assertEquals(
        "Alert catalog broken.json, filter filterByOwner: is defined twice", refused.getMessage());
  }

  @Test
  void sourceNamingWhatIsNotDefinedIsRefusedByName() {
    String source = "[{\"name\":\"table\",\"kind\":\"entity\",\"filters\":[\"filterLongGone\"]}]";

    AlertCatalogException refused =
        assertThrows(
            AlertCatalogException.class,
            () -> AlertCatalog.parse("broken.json", catalogWith(TWICE, null, source)));

    assertEquals(
        "Alert catalog broken.json, Notification source table: names the filter filterLongGone,"
            + " which is not defined",
        refused.getMessage());
  }

  @Test
  void sourceOfferingRecipientsOutsideThePlatformIsRefused() {
    String source =
        "[{\"name\":\"table\",\"kind\":\"entity\",\"recipientCategories\":[\"External\"]}]";

    AlertCatalogException refused =
        assertThrows(
            AlertCatalogException.class,
            () -> AlertCatalog.parse("broken.json", catalogWith(TWICE, null, source)));

    assertEquals(
        "Alert catalog broken.json, Notification source table: offers External recipients, which"
            + " only a destination configures",
        refused.getMessage());
  }

  // A source of this kind stands for the change events of one entity type, so a name no entity
  // type has can never fire.
  @Test
  void everyEntitySourceHasARepository() throws IllegalAccessException {
    Set<String> entityTypes = entityTypeNames();
    AlertCatalog catalog = AlertCatalog.load();
    List<String> withoutOne = new ArrayList<>();
    for (AlertType alertType : List.of(AlertType.NOTIFICATION, AlertType.OBSERVABILITY)) {
      catalog.sourcesOf(alertType).stream()
          .filter(source -> source.getKind() == AlertSourceKind.ENTITY)
          .filter(source -> !Boolean.TRUE.equals(source.getRemoved()))
          .map(AlertCatalogSource::getName)
          .filter(name -> !entityTypes.contains(name))
          .forEach(withoutOne::add);
    }

    assertEquals(OFFERED_BEFORE_THIS_TEST_EXISTED_WITH_NO_ENTITY_TYPE, withoutOne);
  }

  @Test
  void brokenCatalogStopsStartup() {
    EventSubscriptionResource resource =
        mock(EventSubscriptionResource.class, Mockito.CALLS_REAL_METHODS);
    try (MockedStatic<AlertCatalog> catalog = mockStatic(AlertCatalog.class)) {
      catalog
          .when(AlertCatalog::load)
          .thenThrow(
              new AlertCatalogException("AlertCatalog.json", "trigger x", "has no condition"));

      AlertCatalogException stopped =
          assertThrows(AlertCatalogException.class, () -> resource.initialize(null));

      assertEquals(
          "Alert catalog AlertCatalog.json, trigger x: has no condition", stopped.getMessage());
    }
  }

  private static AlertFilteringInput selectionOf(
      AlertType alertType, String source, JsonNode entry) {
    String name = entry.get("name").asText();
    boolean isFilter = "filter".equals(entry.get("kind").asText());
    FilterResourceDescriptor descriptor =
        EventsSubscriptionRegistry.getBuildableDescriptor(alertType, source);
    EventFilterRule definition =
        (isFilter ? descriptor.getSupportedFilters() : descriptor.getSupportedActions())
            .stream()
                .filter(rule -> name.equals(rule.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("not in the catalog: " + entry));
    List<Argument> arguments = new ArrayList<>();
    for (String argument : listOrEmpty(definition.getArguments())) {
      arguments.add(new Argument().withName(argument).withInput(List.of("fixture")));
    }
    ArgumentsInput chosen = new ArgumentsInput().withName(name).withArguments(arguments);
    return isFilter
        ? new AlertFilteringInput().withFilters(List.of(chosen))
        : new AlertFilteringInput().withActions(List.of(chosen));
  }

  private static Set<String> entityTypeNames() throws IllegalAccessException {
    Set<String> names = new TreeSet<>();
    for (Field constant : Entity.class.getFields()) {
      if (Modifier.isStatic(constant.getModifiers()) && constant.getType() == String.class) {
        names.add((String) constant.get(null));
      }
    }
    return names;
  }

  private static String catalogWith(String firstFilter, String secondFilter, String sources) {
    String filters = secondFilter == null ? firstFilter : firstFilter + "," + secondFilter;
    return "{\"filters\":["
        + filters
        + "],\"triggers\":[],\"recipientCategories\":[\"Owners\"],\"notificationSources\":"
        + sources
        + ",\"observabilitySources\":[]}";
  }
}
