package org.openmetadata.service.notifications.template.testing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Loads entity fixture JSON files from classpath with caching.
 * Encapsulates all knowledge about fixture file paths and structure.
 * Provides fallback to generic fixtures when specific fixtures aren't found.
 */
public class EntityFixtureLoader {
  private static final String FIXTURES_BASE_PATH = "json/data/notifications/fixtures/";
  private static final String BASE_FIXTURE_PATH_FORMAT = FIXTURES_BASE_PATH + "%s/base.json";
  private static final String SCENARIO_FIXTURE_PATH_FORMAT =
      FIXTURES_BASE_PATH + "%s/scenarios/%s.json";

  private final Map<String, Map<String, Object>> cache = new ConcurrentHashMap<>();
  private final ObjectMapper json = new ObjectMapper();

  /**
   * Generic base fixture with EntityInterface fields.
   * Used as fallback when resource-specific fixture doesn't exist.
   */
  private static final Map<String, Object> GENERIC_BASE_FIXTURE =
      Map.of(
          "id", UUID.randomUUID().toString(),
          "name", "generic_entity",
          "displayName", "Generic Entity",
          "fullyQualifiedName", "generic.entity",
          "description", "Generic entity for notification template testing",
          "version", 1.0,
          "updatedAt", System.currentTimeMillis(),
          "updatedBy", "admin",
          "deleted", false);

  /**
   * Load base entity fixture for a resource.
   * Convention: {FIXTURES_BASE_PATH}/{resource}/base.json
   * Falls back to GENERIC_BASE_FIXTURE if resource-specific fixture not found.
   *
   * @param resource Resource type (e.g., "table", "dashboard")
   * @return Entity fixture data as map (resource-specific or generic fallback)
   */
  public Map<String, Object> loadBaseFixture(String resource) {
    String path = String.format(BASE_FIXTURE_PATH_FORMAT, resource);
    Map<String, Object> fixture = load(path);

    if (fixture.isEmpty()) {
      return GENERIC_BASE_FIXTURE;
    }

    return fixture;
  }

  /**
   * Load scenario fixture for a resource and event type.
   * Convention: {FIXTURES_BASE_PATH}/{resource}/scenarios/{eventType}.json
   * Returns empty map if scenario fixture not found (caller will use base entity only).
   *
   * @param resource Resource type (e.g., "table", "dashboard")
   * @param eventType Event type (e.g., "entityCreated", "entityUpdated")
   * @return Scenario fixture data as map (empty if not found)
   */
  public Map<String, Object> loadScenarioFixture(String resource, String eventType) {
    String path = String.format(SCENARIO_FIXTURE_PATH_FORMAT, resource, eventType);
    Map<String, Object> fixture = load(path);

    if (fixture.isEmpty()) {
      return Map.of();
    }

    return fixture;
  }

  /**
   * Load a JSON file from classpath with caching.
   * Generic method for loading any JSON file by full path.
   *
   * @param path Full classpath path to the JSON file
   * @return Map representation of the JSON file, or empty map if not found
   */
  private Map<String, Object> load(String path) {
    return cache.computeIfAbsent(path, this::loadFromClasspath);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> loadFromClasspath(String path) {
    try (InputStream is = getClass().getClassLoader().getResourceAsStream(path)) {
      if (is == null) {
        return Map.of(); // Return empty for missing files
      }
      return json.readValue(is, Map.class);
    } catch (IOException e) {
      throw new UncheckedIOException(
          String.format(
              "Failed to parse JSON file at classpath location: %s. "
                  + "Verify the file contains valid JSON syntax.",
              path),
          e);
    }
  }
}
