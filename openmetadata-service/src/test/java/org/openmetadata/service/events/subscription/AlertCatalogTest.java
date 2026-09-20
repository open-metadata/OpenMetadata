package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
 * What the server tells clients an alert can watch and filter on. The golden files were written
 * from the catalog as it was before it moved to one format, so a difference is a change clients
 * see. Regenerate them with -Dgolden.generate=true only for a named change.
 */
class AlertCatalogTest {

  private static final Path GOLDEN = Path.of("src", "test", "resources", "golden", "catalog");
  private static final Path COMPAT = Path.of("src", "test", "resources", "compat");
  private static final String SHIPPED_ENTRIES = "alert-catalog-shipped-entries.json";
  private static final Pattern FUNCTION_CALL = Pattern.compile("([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
  private static final String TWICE =
      "{\"name\":\"filterByOwner\",\"condition\":\"matchAnyOwnerName(${ownerNameList})\"}";
  // The entity behind tag categories has been called classification for years, so an alert on
  // this source cannot fire. It is listed so that the test stops the next one, not this one.
  private static final List<String> OFFERED_BEFORE_THIS_TEST_EXISTED_WITH_NO_ENTITY_TYPE =
      List.of("tagCategory");

  @Test
  void servedCatalogIsUnchanged() throws IOException {
    assertMatchesGolden(
        "notification.json", EventSubscriptionResource.getNotificationsFilterDescriptors());
    assertMatchesGolden(
        "observability.json", EventSubscriptionResource.getObservabilityFilterDescriptors());
  }

  // An alert saved by any release since 1.3.0 names only what that release offered. The fixture
  // lists all of it; scripts/alerting/check_alert_catalog_against_releases.py writes it.
  @Test
  void everyShippedDefinitionStillBuilds() throws IOException {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
    JsonNode shipped = JsonUtils.readTree(Files.readString(COMPAT.resolve(SHIPPED_ENTRIES)));
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

  // Stored text is what a server of the previous release evaluates after a rollback.
  @Test
  void templatesUseOnlyPreviousReleaseFunctions() throws IOException {
    Set<String> previousReleaseHas =
        new TreeSet<>(Files.readAllLines(COMPAT.resolve("condition-functions.txt")));
    assertFalse(previousReleaseHas.isEmpty());

    for (EventFilterRule definition : AlertCatalog.load().definitions()) {
      Matcher called = FUNCTION_CALL.matcher(definition.getCondition());
      while (called.find()) {
        assertTrue(
            previousReleaseHas.contains(called.group(1)),
            definition.getName() + " calls " + called.group(1));
      }
    }
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
        + "],\"triggers\":[],\"notificationSources\":"
        + sources
        + ",\"observabilitySources\":[]}";
  }

  private static void assertMatchesGolden(String file, List<FilterResourceDescriptor> served)
      throws IOException {
    assertFalse(served.isEmpty(), "the catalog was not loaded");
    String text = JsonUtils.pojoToJson(served, true) + System.lineSeparator();
    Path golden = GOLDEN.resolve(file);
    if (Boolean.getBoolean("golden.generate")) {
      Files.createDirectories(GOLDEN);
      Files.writeString(golden, text);
    }
    assertEquals(Files.readString(golden), text);
  }
}
