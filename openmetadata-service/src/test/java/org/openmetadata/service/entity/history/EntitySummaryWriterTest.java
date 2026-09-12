package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntitySummaryWriter.Attribution;
import org.openmetadata.service.entity.history.EntitySummaryWriter.Update;
import org.openmetadata.service.exception.EntityNotFoundException;

class EntitySummaryWriterTest {
  private static final UUID ID = UUID.randomUUID();
  private static final String FQN = "service.database.schema.table";
  private static final String DESCRIPTION = "description";
  private static final String CHANGES = "changeDescription";
  private static final String SUMMARY = "changeSummary";
  private static final String ACTOR = "reviewer";
  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-09-11T10:00:00Z"), ZoneOffset.UTC);

  @Test
  void changesOnlyAttributionWhilePreservingUnmappedStoredFields() {
    final Fixture fixture = new Fixture();
    final ObjectNode before = fixture.row.deepCopy();
    fixture.writer.update(attribution(DESCRIPTION));
    final ObjectNode after = fixture.row.deepCopy();
    final var change = after.path(CHANGES).path(SUMMARY).path(DESCRIPTION);
    assertEquals(ACTOR, change.path("changedBy").asText());
    assertEquals(CLOCK.millis(), change.path("changedAt").asLong());
    assertEquals(ChangeSource.SUGGESTED.toString(), change.path("changeSource").asText());
    assertEquals(1.7, after.path(CHANGES).path("previousVersion").asDouble());
    after.remove(CHANGES);
    assertEquals(before, after);
    assertEquals(List.of(ID), fixture.invalidated);
  }

  @Test
  void keepsExistingChangesAndOtherFieldAttribution() {
    final Fixture fixture = new Fixture();
    fixture.row.set(
        CHANGES,
        JsonUtils.readTree(
            """
        {"fieldsUpdated":[{"name":"displayName","oldValue":"old","newValue":"new"}],
         "previousVersion":1.6,"changeSummary":{"columns.id.description":{"changedBy":"prior"}}}
        """));
    final var previous = fixture.row.path(CHANGES).deepCopy();
    fixture.writer.update(attribution(DESCRIPTION));
    assertEquals(previous.path("fieldsUpdated"), fixture.row.path(CHANGES).path("fieldsUpdated"));
    assertEquals(
        previous.path("previousVersion"), fixture.row.path(CHANGES).path("previousVersion"));
    assertEquals(
        previous.path(SUMMARY).path("columns.id.description"),
        fixture.row.path(CHANGES).path(SUMMARY).path("columns.id.description"));
  }

  @Test
  void absentAndNullVersionsRetainChangeDescriptionDefaults() {
    final Fixture fixture = new Fixture();
    fixture.row.remove("version");
    fixture.writer.update(attribution(DESCRIPTION));
    assertEquals(0.1, fixture.row.path(CHANGES).path("previousVersion").asDouble());
    fixture.row.putNull("version");
    fixture.row.putNull(CHANGES);
    fixture.writer.update(attribution(DESCRIPTION));
    assertFalse(fixture.row.path(CHANGES).hasNonNull("previousVersion"));
  }

  @Test
  void missingRowsKeepTheNotFoundContractWithoutWritesOrInvalidation() {
    final Fixture fixture = new Fixture();
    fixture.row = null;
    assertThrows(
        EntityNotFoundException.class, () -> fixture.writer.update(attribution(DESCRIPTION)));
    assertTrue(fixture.invalidated.isEmpty());
    assertEquals(0, fixture.writes);
  }

  @Test
  void aJsonNullRowRetainsTheNotFoundContract() {
    final EntitySummaryWriter writer =
        new EntitySummaryWriter(
            "table",
            new EntitySummaryWriter.Rows(
                id -> "null",
                stored -> {
                  throw new AssertionError("Unexpected write");
                }),
            new EntitySummaryWriter.Boundary(
                Runnable::run,
                stored -> {
                  throw new AssertionError("Unexpected invalidation");
                }),
            CLOCK);
    assertThrows(EntityNotFoundException.class, () -> writer.update(attribution(DESCRIPTION)));
  }

  @Test
  void failedWritesPropagateBeforeInvalidation() {
    final Fixture fixture = new Fixture();
    fixture.failWrite = true;
    final ObjectNode before = fixture.row.deepCopy();
    assertThrows(
        IllegalStateException.class, () -> fixture.writer.update(attribution(DESCRIPTION)));
    assertEquals(before, fixture.row);
    assertTrue(fixture.invalidated.isEmpty());
  }

  private static Attribution attribution(String field) {
    return new Attribution(ID, field, ChangeSource.SUGGESTED, ACTOR);
  }

  private static final class Fixture {
    private ObjectNode row =
        (ObjectNode)
            JsonUtils.readTree(
                """
        {"version":1.7,"description":"current", "columns":[{"name":"id","description":"current"}],
         "forwardCompatibleField":{"preserve":true}}
        """);
    private final List<UUID> invalidated = new ArrayList<>();
    private final EntitySummaryWriter writer;
    private boolean active;
    private boolean failWrite;
    private int writes;

    private Fixture() {
      row.put("id", ID.toString());
      row.put("fullyQualifiedName", FQN);
      writer =
          new EntitySummaryWriter(
              "table",
              new EntitySummaryWriter.Rows(this::read, this::write),
              new EntitySummaryWriter.Boundary(
                  work -> {
                    active = true;
                    try {
                      work.run();
                    } finally {
                      active = false;
                    }
                  },
                  stored -> invalidated.add(stored.id())),
              CLOCK);
    }

    private String read(UUID id) {
      assertTrue(active);
      assertEquals(ID, id);
      return row == null
          ? null
          : JsonUtils.pojoToJson(row.deepCopy().retain("fullyQualifiedName", "version", CHANGES));
    }

    private void write(Update stored) {
      assertTrue(active);
      assertEquals(ID, stored.id());
      assertEquals(FQN, stored.fullyQualifiedName());
      if (failWrite) throw new IllegalStateException("Row update failed");
      row.set(CHANGES, JsonUtils.readTree(stored.changeDescriptionJson()));
      writes++;
    }
  }
}
