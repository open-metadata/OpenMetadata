package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;

class ColumnValueUpdaterTest {
  private static final String PREFIX = "columns.\"name.with.dots\"";

  @Test
  void botPutKeepsHumanDescriptionsAndDisplayNames() {
    final Fixture fixture = new Fixture();
    final Column original =
        new Column().withDescription("Human text").withDisplayName("Human name");
    final Column updated =
        new Column().withDescription("Source text").withDisplayName("Source name");
    fixture.updater.updateDescription(fixture, PREFIX, original, updated);
    fixture.updater.updateDisplayName(fixture, PREFIX, original, updated);
    assertEquals(original.getDescription(), updated.getDescription());
    assertEquals(original.getDisplayName(), updated.getDisplayName());
    assertTrue(fixture.changes.isEmpty());
  }

  @ParameterizedTest
  @CsvSource(
      value = {"NULL", "''"},
      nullValues = "NULL")
  void forceSyncNeverBlanksAnExistingDescription(String incoming) {
    final Fixture fixture = new Fixture();
    fixture.override = true;
    final Column original = new Column().withDescription("Human text");
    final Column updated = new Column().withDescription(incoming);
    fixture.updater.updateDescription(fixture, PREFIX, original, updated);
    assertEquals("Human text", updated.getDescription());
    assertTrue(fixture.changes.isEmpty());
  }

  @Test
  void forceSyncMayReplaceDescriptionWhileKeepingTheDisplayName() {
    final Fixture fixture = new Fixture();
    fixture.override = true;
    final Column original =
        new Column().withDescription("Human text").withDisplayName("Human name");
    final Column updated =
        new Column().withDescription("Source text").withDisplayName("Source name");
    fixture.updater.updateDescription(fixture, PREFIX, original, updated);
    fixture.updater.updateDisplayName(fixture, PREFIX, original, updated);
    assertEquals("Source text", updated.getDescription());
    assertEquals("Human name", updated.getDisplayName());
    assertEquals(
        List.of(new Change(PREFIX + ".description", "Human text", "Source text")), fixture.changes);
  }

  @Test
  void humanPutAndBotPatchKeepTheirAbilityToClearValues() {
    final Fixture fixture = new Fixture();
    fixture.bot = false;
    final Column original =
        new Column().withDescription("Human text").withDisplayName("Human name");
    final Column updated = new Column();
    fixture.updater.updateDescription(fixture, PREFIX, original, updated);
    fixture.bot = true;
    fixture.put = false;
    fixture.updater.updateDisplayName(fixture, PREFIX, original, updated);
    assertEquals(
        List.of(
            new Change(PREFIX + ".description", "Human text", null),
            new Change(PREFIX + ".displayName", "Human name", null)),
        fixture.changes);
  }

  @Test
  void botsMayPopulatePreviouslyAbsentValues() {
    final Fixture fixture = new Fixture();
    final Column original = new Column();
    final Column updated =
        new Column().withDescription("Source text").withDisplayName("Source name");
    fixture.updater.updateDescription(fixture, PREFIX, original, updated);
    fixture.updater.updateDisplayName(fixture, PREFIX, original, updated);
    assertEquals(2, fixture.changes.size());
    assertEquals("Source text", updated.getDescription());
    assertEquals("Source name", updated.getDisplayName());
  }

  @ParameterizedTest
  @CsvSource(
      value = {"NULL,20,true", "20,NULL,false", "20,10,true", "20,30,false", "20,20,false"},
      nullValues = "NULL")
  void dataLengthKeepsItsExistingMajorVersionRules(
      Integer previous, Integer current, boolean major) {
    final Fixture fixture = new Fixture();
    assertEquals(
        major,
        fixture.updater.updateDataLength(
            fixture,
            PREFIX,
            new Column().withDataLength(previous),
            new Column().withDataLength(current)));
    assertEquals(
        Objects.equals(previous, current)
            ? List.of()
            : List.of(new Change(PREFIX + ".dataLength", previous, current)),
        fixture.changes);
  }

  @ParameterizedTest
  @CsvSource(
      value = {"NULL,20,false", "20,NULL,true", "20,10,true", "20,30,false", "20,20,false"},
      nullValues = "NULL")
  void precisionAndScaleKeepTheirExistingMajorVersionRules(
      Integer previous, Integer current, boolean major) {
    final Fixture fixture = new Fixture();
    final Column original = new Column().withPrecision(previous).withScale(previous);
    final Column updated = new Column().withPrecision(current).withScale(current);
    assertEquals(major, fixture.updater.updatePrecision(fixture, PREFIX, original, updated));
    assertEquals(major, fixture.updater.updateScale(fixture, PREFIX, original, updated));
    assertEquals(
        Objects.equals(previous, current)
            ? List.of()
            : List.of(
                new Change(PREFIX + ".precision", previous, current),
                new Change(PREFIX + ".scale", previous, current)),
        fixture.changes);
  }

  @Test
  void unselectedFieldsCannotCauseAMajorVersionChange() {
    final Fixture fixture = new Fixture();
    fixture.selected = false;
    final Column original = new Column().withDataLength(20).withPrecision(20).withScale(20);
    final Column updated = new Column().withDataLength(10).withPrecision(10).withScale(10);
    assertFalse(fixture.updater.updateDataLength(fixture, PREFIX, original, updated));
    assertFalse(fixture.updater.updatePrecision(fixture, PREFIX, original, updated));
    assertFalse(fixture.updater.updateScale(fixture, PREFIX, original, updated));
    assertTrue(fixture.changes.isEmpty());
  }

  @Test
  void constraintsRetainTheirTypedFieldValues() {
    final Fixture fixture = new Fixture();
    fixture.updater.updateConstraint(
        fixture, PREFIX, new Column(), new Column().withConstraint(ColumnConstraint.NOT_NULL));
    assertEquals(
        List.of(new Change(PREFIX + ".constraint", null, ColumnConstraint.NOT_NULL)),
        fixture.changes);
  }

  private record Change(String field, Object previous, Object current) {}

  private static final class Fixture implements ColumnValueUpdater.Session {
    private boolean put = true;
    private boolean bot = true;
    private boolean override;
    private boolean selected = true;
    private final List<Change> changes = new ArrayList<>();
    private final ColumnValueUpdater updater = new ColumnValueUpdater();

    @Override
    public boolean isPut() {
      return put;
    }

    @Override
    public boolean updatedByBot() {
      return bot;
    }

    @Override
    public boolean isOverrideMetadata() {
      return override;
    }

    @Override
    public <K> boolean recordChange(String field, K previous, K current) {
      final boolean changed = selected && !Objects.equals(previous, current);
      if (changed) {
        changes.add(new Change(field, previous, current));
      }
      return changed;
    }
  }
}
