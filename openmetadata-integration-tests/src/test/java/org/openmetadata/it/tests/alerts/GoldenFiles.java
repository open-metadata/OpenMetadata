package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Compares what a dispatch run produced with a checked-in file. Values that differ from run to
 * run (generated ids, the test namespace, the receiver's port, wall-clock times) are replaced by
 * stable tokens first. Run with {@code -Dgolden.generate=true} to rewrite the files.
 */
final class GoldenFiles {

  private static final Path DIRECTORY = Path.of("src", "test", "resources", "golden", "dispatch");
  private static final String GENERATE_PROPERTY = "golden.generate";
  private static final String TIME_TOKEN = "<time>";
  private static final Set<String> WALL_CLOCK_FIELDS =
      Set.of("timestamp", "lastSuccessfulAt", "lastFailedAt", "nextAttempt", "updatedAt");
  private static final ObjectMapper MAPPER =
      new ObjectMapper()
          .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
          .enable(SerializationFeature.INDENT_OUTPUT);

  private final Map<String, String> tokens = new LinkedHashMap<>();

  /** Longer values are registered first by callers when one value contains another. */
  GoldenFiles token(String runtimeValue, String stableName) {
    tokens.put(runtimeValue, "<" + stableName + ">");
    return this;
  }

  void assertMatches(String fileName, Object actual) throws IOException {
    String normalised = render(normalise(MAPPER.valueToTree(actual)));
    Path file = DIRECTORY.resolve(fileName + ".json");
    if (Boolean.getBoolean(GENERATE_PROPERTY)) {
      Files.createDirectories(DIRECTORY);
      Files.writeString(file, normalised, StandardCharsets.UTF_8);
    }
    assertTrue(Files.exists(file), "Missing golden file " + file + "; run with -Dgolden.generate");
    assertEquals(Files.readString(file, StandardCharsets.UTF_8), normalised, fileName);
  }

  /** Bodies are JSON carried as text, so they are parsed before they are normalised. */
  JsonNode parse(String json) throws IOException {
    return MAPPER.readTree(json);
  }

  private static String render(JsonNode node) throws IOException {
    return MAPPER.writeValueAsString(MAPPER.treeToValue(node, Object.class)) + "\n";
  }

  private JsonNode normalise(JsonNode node) {
    JsonNode result = node;
    if (node.isObject()) {
      result = normaliseObject((ObjectNode) node);
    } else if (node.isArray()) {
      result = normaliseArray((ArrayNode) node);
    } else if (node.isTextual()) {
      result = new TextNode(withTokens(node.asText()));
    }
    return result;
  }

  private JsonNode normaliseObject(ObjectNode object) {
    ObjectNode result = MAPPER.createObjectNode();
    object
        .fields()
        .forEachRemaining(
            field -> {
              boolean wallClock =
                  WALL_CLOCK_FIELDS.contains(field.getKey()) && field.getValue().isNumber();
              result.set(
                  field.getKey(),
                  wallClock ? new TextNode(TIME_TOKEN) : normalise(field.getValue()));
            });
    return result;
  }

  private JsonNode normaliseArray(ArrayNode array) {
    ArrayNode result = MAPPER.createArrayNode();
    array.forEach(element -> result.add(normalise(element)));
    return result;
  }

  private String withTokens(String text) {
    String result = text;
    for (Map.Entry<String, String> token : sortedByLength()) {
      result = result.replace(token.getKey(), token.getValue());
    }
    return result;
  }

  private Iterable<Map.Entry<String, String>> sortedByLength() {
    return tokens.entrySet().stream()
        .sorted(
            Comparator.comparingInt((Map.Entry<String, String> e) -> e.getKey().length())
                .reversed())
        .toList();
  }
}
