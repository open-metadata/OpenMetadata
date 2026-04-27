package org.openmetadata.service.migration.utils.v1130;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.migration.api.MigrationTestCase;
import org.openmetadata.service.migration.api.TestResult;

public class MigrationTest implements MigrationTestCase {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Pattern SAFE_IDENTIFIER = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*$");
  private static final String[] APP_TABLES = {"installed_apps", "apps_marketplace"};

  static {
    for (String table : APP_TABLES) {
      if (!SAFE_IDENTIFIER.matcher(table).matches()) {
        throw new IllegalArgumentException("Invalid table name in APP_TABLES: " + table);
      }
    }
  }

  private final Map<String, Map<String, Boolean>> previewValues = new HashMap<>();

  @Override
  public List<TestResult> validateBefore(Handle handle) {
    List<TestResult> results = new ArrayList<>();
    for (String table : APP_TABLES) {
      results.add(validatePreviewFieldExists(handle, table));
    }
    return results;
  }

  @Override
  public List<TestResult> validateAfter(Handle handle) {
    List<TestResult> results = new ArrayList<>();
    for (String table : APP_TABLES) {
      results.add(validateEnabledFieldCorrect(handle, table));
    }
    return results;
  }

  private TestResult validatePreviewFieldExists(Handle handle, String table) {
    String testName = table + ": preview field exists";
    try {
      List<String> rows =
          handle.createQuery("SELECT json FROM " + table).mapTo(String.class).list();
      if (rows.isEmpty()) {
        return TestResult.pass(testName + " (no rows)");
      }
      Map<String, Boolean> tablePreview = new HashMap<>();
      for (String jsonStr : rows) {
        JsonNode node = MAPPER.readTree(jsonStr);
        String name = node.has("name") ? node.get("name").asText() : "unknown";
        if (!node.has("preview")) {
          return TestResult.fail(testName, "App '" + name + "' missing 'preview' field");
        }
        tablePreview.put(name, node.get("preview").asBoolean());
      }
      previewValues.put(table, tablePreview);
      return TestResult.pass(testName);
    } catch (Exception e) {
      return TestResult.fail(testName, e.getMessage());
    }
  }

  private TestResult validateEnabledFieldCorrect(Handle handle, String table) {
    String testName = table + ": enabled field has correct value";
    try {
      List<String> rows =
          handle.createQuery("SELECT json FROM " + table).mapTo(String.class).list();
      if (rows.isEmpty()) {
        return TestResult.pass(testName + " (no rows)");
      }
      Map<String, Boolean> savedPreview = previewValues.getOrDefault(table, Map.of());
      for (String jsonStr : rows) {
        JsonNode node = MAPPER.readTree(jsonStr);
        String name = node.has("name") ? node.get("name").asText() : "unknown";
        if (!node.has("enabled")) {
          return TestResult.fail(testName, "App '" + name + "' missing 'enabled' field");
        }
        if (!node.get("enabled").isBoolean()) {
          return TestResult.fail(testName, "App '" + name + "': 'enabled' is not a boolean");
        }
        boolean enabled = node.get("enabled").asBoolean();
        if (savedPreview.containsKey(name)) {
          boolean expectedEnabled = !savedPreview.get(name);
          if (enabled != expectedEnabled) {
            return TestResult.fail(
                testName,
                String.format(
                    "App '%s': expected enabled=%s (preview was %s) but got enabled=%s",
                    name, expectedEnabled, savedPreview.get(name), enabled));
          }
        }
      }
      return TestResult.pass(testName);
    } catch (Exception e) {
      return TestResult.fail(testName, e.getMessage());
    }
  }
}
