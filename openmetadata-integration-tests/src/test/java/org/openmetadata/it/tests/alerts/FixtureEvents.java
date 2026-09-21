package org.openmetadata.it.tests.alerts;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Literal change events, so a fixture never changes because a generated class gained a default. */
final class FixtureEvents {

  private static final Path TABLE_EVENTS =
      Path.of("src", "test", "resources", "alerts", "table-events.json");

  private FixtureEvents() {}

  /** A table created, the same table described again, and a topic created. */
  static List<String> tableEvents() {
    List<String> events = new ArrayList<>();
    try {
      for (JsonNode event : JsonUtils.readTree(Files.readString(TABLE_EVENTS))) {
        events.add(event.toString());
      }
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return events;
  }

  static void insert(List<String> events) {
    events.forEach(event -> Entity.getCollectionDAO().changeEventDAO().insert(event));
  }
}
