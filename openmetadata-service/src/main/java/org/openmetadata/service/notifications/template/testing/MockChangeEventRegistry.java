package org.openmetadata.service.notifications.template.testing;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;

/**
 * Registry for entity fixture builders and event scenario appliers.
 * Provides DSL-like API for registering mock generation strategies.
 */
public final class MockChangeEventRegistry {

  /**
   * Functional interface for building entity fixture data from loaded JSON.
   */
  @FunctionalInterface
  public interface EntityFixtureBuilder {
    void build(Map<String, Object> entity);
  }

  /**
   * Functional interface for applying event scenario data to ChangeEvents.
   */
  @FunctionalInterface
  public interface EntityFixtureEventApplier {
    void apply(ChangeEvent event, Map<String, Object> entity);
  }

  /**
   * Represents a test scenario for notification template testing.
   * Used as a key to look up event scenario appliers in the registry.
   */
  public sealed interface Scenario
      permits MockChangeEventRegistry.EntityScenario, MockChangeEventRegistry.NeutralScenario {
    String resource();

    Optional<EventType> eventType();
  }

  /**
   * Scenario for testing with a specific eventType (e.g., entityUpdated).
   */
  public record EntityScenario(String resource, EventType type) implements Scenario {
    @Override
    public Optional<EventType> eventType() {
      return Optional.of(type);
    }
  }

  /**
   * Scenario for testing without eventType (neutral mode).
   * Tests only entity field access, not event-specific logic.
   */
  public record NeutralScenario(String resource) implements Scenario {
    @Override
    public Optional<EventType> eventType() {
      return Optional.empty();
    }
  }

  private final Map<String, EntityFixtureBuilder> builders = new HashMap<>();
  private final Map<Scenario, EntityFixtureEventApplier> appliers = new HashMap<>();
  private final EntityFixtureLoader fixtures;

  public MockChangeEventRegistry(EntityFixtureLoader fixtures) {
    this.fixtures = fixtures;
  }

  /**
   * Get builder for a resource using convention-based loading.
   * Automatically loads from {resource}/base.json if not explicitly registered.
   * Falls back to generic fixture if resource-specific fixture not found.
   * Uses lazy loading with automatic caching.
   *
   * @param resource Resource type (e.g., "table", "dashboard")
   * @return Builder for the resource
   */
  public EntityFixtureBuilder builder(String resource) {
    return builders.computeIfAbsent(
        resource, r -> entity -> entity.putAll(fixtures.loadBaseFixture(r)));
  }

  /**
   * Get applier for a scenario using convention-based loading.
   * Automatically loads from {resource}/scenarios/{eventType}.json if not explicitly registered.
   * Gracefully handles missing scenario fixtures (uses base entity only).
   * Uses lazy loading with automatic caching.
   *
   * @param scenario Scenario containing resource and optional event type
   * @return Applier for the scenario
   */
  public EntityFixtureEventApplier scenarioApplier(Scenario scenario) {
    return appliers.computeIfAbsent(
        scenario,
        s -> {
          if (s.eventType().isEmpty()) {
            // Neutral scenario - no fixture loading needed
            return (event, entity) -> {};
          }

          String eventTypeValue = s.eventType().get().value();

          return (event, entity) -> {
            Map<String, Object> scenarioData =
                fixtures.loadScenarioFixture(s.resource(), eventTypeValue);
            applyScenario(event, scenarioData);
          };
        });
  }

  /**
   * Apply scenario fixture to ChangeEvent.
   * Gracefully handles empty scenarios (when fixture not found).
   */
  private void applyScenario(ChangeEvent event, Map<String, Object> scenario) {
    if (scenario.isEmpty()) {
      // No scenario fixture found - skip scenario application
      return;
    }

    String eventTypeStr = (String) scenario.get("eventType");
    event
        .withEventType(EventType.fromValue(eventTypeStr))
        .withPreviousVersion((Double) scenario.get("previousVersion"))
        .withCurrentVersion((Double) scenario.get("currentVersion"));

    @SuppressWarnings("unchecked")
    Map<String, Object> cdMap = (Map<String, Object>) scenario.get("changeDescription");
    if (cdMap != null) {
      ChangeDescription cd = buildChangeDescription(cdMap);
      event.withChangeDescription(cd);
    }
  }

  /**
   * Build ChangeDescription from fixture map.
   */
  @SuppressWarnings("unchecked")
  private ChangeDescription buildChangeDescription(Map<String, Object> cdMap) {
    ChangeDescription cd =
        new ChangeDescription().withPreviousVersion((Double) cdMap.get("previousVersion"));

    List<Map<String, String>> added = (List<Map<String, String>>) cdMap.get("fieldsAdded");
    if (added != null) {
      cd.withFieldsAdded(
          added.stream()
              .map(m -> new FieldChange().withName(m.get("name")).withNewValue(m.get("newValue")))
              .collect(Collectors.toList()));
    }

    List<Map<String, String>> updated = (List<Map<String, String>>) cdMap.get("fieldsUpdated");
    if (updated != null) {
      cd.withFieldsUpdated(
          updated.stream()
              .map(
                  m ->
                      new FieldChange()
                          .withName(m.get("name"))
                          .withOldValue(m.get("oldValue"))
                          .withNewValue(m.get("newValue")))
              .collect(Collectors.toList()));
    }

    List<Map<String, String>> deleted = (List<Map<String, String>>) cdMap.get("fieldsDeleted");
    if (deleted != null) {
      cd.withFieldsDeleted(
          deleted.stream()
              .map(m -> new FieldChange().withName(m.get("name")).withOldValue(m.get("oldValue")))
              .collect(Collectors.toList()));
    }

    return cd;
  }
}
