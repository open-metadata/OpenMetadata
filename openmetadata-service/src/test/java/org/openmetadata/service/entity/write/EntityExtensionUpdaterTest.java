package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.EntityExtensionUpdater;

class EntityExtensionUpdaterTest {
  private final List<JsonNode> removed = new ArrayList<>();
  private final List<JsonNode> stored = new ArrayList<>();

  @Test
  void identicalObjectsKeepTheirIdentityAndSkipPersistence() {
    final Object original = Map.of("note", "same");
    final var session = session(original, original);
    updater(UnaryOperator.identity()).update(session, false, false, false);
    assertSame(original, session.getUpdated().getExtension());
    assertNoWrites(session);
  }

  @Test
  void equalJsonFromDifferentRepresentationsDoesNotRewriteRows() {
    final var session = session(Map.of("note", "same"), JsonUtils.readTree("{\"note\":\"same\"}"));
    updater(UnaryOperator.identity()).update(session, false, false, false);
    assertEquals(Map.of("note", "same"), session.getUpdated().getExtension());
    assertNoWrites(session);
  }

  @Test
  void emptyPropertiesRetainNullNormalizationWithoutWrites() {
    final var session = session(null, Map.of());
    updater(UnaryOperator.identity()).update(session, false, false, false);
    assertNull(session.getUpdated().getExtension());
    assertNoWrites(session);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void putPreservesCuratedPropertiesForBotsAndOmittedValues(boolean bot) {
    final Object original = Map.of("note", "curated");
    final var session = session(original, bot ? Map.of("note", "bot") : null);
    updater(UnaryOperator.identity()).update(session, true, bot, false);
    assertSame(original, session.getUpdated().getExtension());
    assertNoWrites(session);
  }

  @Test
  void patchCanRemoveAllProperties() {
    final var session = session(Map.of("note", "original"), null);
    updater(UnaryOperator.identity()).update(session, false, true, false);
    assertEquals(List.of(JsonUtils.readTree("{\"note\":\"original\"}")), removed);
    assertEquals(List.of(JsonUtils.valueToTree(null)), stored);
    assertEquals(
        "extension", session.getChangeDescription().getFieldsDeleted().getFirst().getName());
    assertEquals(
        "[{\"note\":\"original\"}]",
        session.getChangeDescription().getFieldsDeleted().getFirst().getOldValue());
    assertFalse(
        session.isEntityChanged(),
        "Collection deltas drive versioning without changing the scalar flag");
  }

  @Test
  void changesRecordRequestedValuesAndStoreTransformedValues() {
    final var session =
        session(
            Map.of("updated", "before", "deleted", "old"),
            Map.of("updated", "requested", "added", "new"));
    updater(
            value -> {
              final ObjectNode fields = (ObjectNode) JsonUtils.valueToTree(value);
              fields
                  .fieldNames()
                  .forEachRemaining(
                      key -> fields.put(key, fields.get(key).asText().toUpperCase(Locale.ROOT)));
              return fields;
            })
        .update(session, false, false, false);
    assertEquals(
        JsonUtils.readTree("{\"updated\":\"REQUESTED\",\"added\":\"NEW\"}"), stored.getFirst());
    assertEquals(JsonUtils.valueToTree(session.getOriginal().getExtension()), removed.getFirst());
    final var change = session.getChangeDescription();
    assertEquals("extension.updated", change.getFieldsUpdated().getFirst().getName());
    assertEquals("\"requested\"", change.getFieldsUpdated().getFirst().getNewValue());
    assertEquals("[{\"added\":\"new\"}]", change.getFieldsAdded().getFirst().getNewValue());
    assertEquals("[{\"deleted\":\"old\"}]", change.getFieldsDeleted().getFirst().getOldValue());
    assertTrue(session.isEntityChanged());
  }

  @Test
  void consolidationReplaysHistoricalValuesWithoutRevalidation() {
    final var session = session(Map.of("note", "current"), Map.of("note", "historical"));
    updater(
            value -> {
              throw new IllegalArgumentException("Historical value no longer satisfies the schema");
            })
        .update(session, false, false, true);
    assertEquals(JsonUtils.readTree("{\"note\":\"historical\"}"), stored.getFirst());
    assertEquals(
        "\"historical\"",
        session.getChangeDescription().getFieldsUpdated().getFirst().getNewValue());
  }

  @Test
  void invalidChangesFailBeforeAnyPropertyIsWritten() {
    final var session = session(Map.of("note", "current"), Map.of("note", "invalid"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            updater(
                    value -> {
                      throw new IllegalArgumentException("Invalid custom property");
                    })
                .update(session, false, false, false));
    assertTrue(removed.isEmpty());
    assertTrue(stored.isEmpty());
  }

  @Test
  void nonObjectTransformationKeepsTheRequestedValue() {
    final var session = session(null, Map.of("note", "new"));
    updater(value -> null).update(session, false, false, false);
    assertEquals(JsonUtils.readTree("{\"note\":\"new\"}"), stored.getFirst());
  }

  @Test
  void nullPropertyValuesRemainDistinctFromMissingProperties() {
    final var session = session(JsonUtils.readTree("{\"note\":null}"), Map.of());
    updater(UnaryOperator.identity()).update(session, false, false, false);
    assertNull(session.getUpdated().getExtension());
    assertEquals(
        "[{\"note\":null}]",
        session.getChangeDescription().getFieldsDeleted().getFirst().getOldValue());
  }

  @Test
  void nestedPatchSelectionStillControlsScalarChangeRecording() {
    final var session =
        session(Map.of("first", "old", "second", "old"), Map.of("first", "new", "second", "new"));
    session.setPatchedFields(Set.of("extension.first"));
    updater(UnaryOperator.identity()).update(session, false, false, false);
    assertEquals(1, session.getChangeDescription().getFieldsUpdated().size());
    assertEquals(
        "extension.first", session.getChangeDescription().getFieldsUpdated().getFirst().getName());
    assertEquals(JsonUtils.readTree("{\"first\":\"new\",\"second\":\"new\"}"), stored.getFirst());
  }

  private EntityExtensionUpdater<Table> updater(UnaryOperator<Object> validate) {
    return new EntityExtensionUpdater<>(
        entity -> removed.add(JsonUtils.valueToTree(entity.getExtension())),
        entity -> stored.add(JsonUtils.valueToTree(entity.getExtension())),
        validate);
  }

  private Session session(Object original, Object updated) {
    return new Session(new Table().withExtension(original), new Table().withExtension(updated));
  }

  private void assertNoWrites(Session session) {
    assertTrue(removed.isEmpty());
    assertTrue(stored.isEmpty());
    assertFalse(EntityChangeRecorder.hasChanges(session.getChangeDescription()));
    assertFalse(session.isEntityChanged());
  }

  private static final class Session extends MutationState<Table>
      implements EntityExtensionUpdater.Session<Table> {
    private Session(Table original, Table updated) {
      super(original, updated);
      setChangeDescription(new ChangeDescription());
    }

    @Override
    public <K> boolean recordChange(String field, K original, K updated) {
      if (!PatchFieldSelection.shouldCompare(getPatchedFields(), field)) {
        return false;
      }
      setEntityChanged(true);
      EntityChangeRecorder.recordValue(getChangeDescription(), field, original, updated, false);
      return true;
    }
  }
}
