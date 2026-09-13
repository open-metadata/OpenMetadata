package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_DELETED;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.TABLE;

import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.util.DescriptionSanitizer;

class EntityValueUpdatesTest {
  @Test
  void botPutPreservesDescriptionsWithoutSanitizingTheStoredValue() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.original.withDescription("<legacy>Human description</legacy>");
    fixture.updated.withDescription("Incoming description");
    fixture.updates.updateDescription(fixture, fixture.original, fixture.updated);
    assertEquals(fixture.original.getDescription(), fixture.updated.getDescription());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void descriptionChangesRecordTheSanitizedValue() {
    final Fixture fixture = new Fixture();
    fixture.original.withDescription("Before");
    fixture.updated.withDescription("<script>alert(1)</script><b>After</b>");
    fixture.updates.updateDescription(fixture, fixture.original, fixture.updated);
    assertEquals("<b>After</b>", fixture.updated.getDescription());
    assertEquals(FIELD_DESCRIPTION, fixture.changes.getFieldsUpdated().getFirst().getName());
    assertEquals("<b>After</b>", fixture.changes.getFieldsUpdated().getFirst().getNewValue());
  }

  @Test
  void forceSyncAndBotPatchMayClearAnEntityDescription() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.override = true;
    fixture.original.withDescription("Before");
    fixture.updates.updateDescription(fixture, fixture.original, fixture.updated);
    assertNull(fixture.updated.getDescription());
    assertEquals("Before", fixture.changes.getFieldsDeleted().getFirst().getOldValue());
    fixture.override = false;
    fixture.put = false;
    fixture.patch = true;
    fixture.updated.setDescription("Bot patch");
    fixture.updates.updateDescription(fixture, fixture.original, fixture.updated);
    assertEquals("Bot patch", fixture.updated.getDescription());
  }

  @Test
  void botsCanFillAnEmptyDescription() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.updated.withDescription("Source");
    fixture.updates.updateDescription(fixture, fixture.original, fixture.updated);
    assertEquals("Source", fixture.changes.getFieldsAdded().getFirst().getNewValue());
  }

  @ParameterizedTest
  @CsvSource({"true,false,true", "true,true,false", "false,false,false"})
  void explicitBotDisplayNameDenialHonorsForceSync(
      final boolean denied, final boolean override, final boolean preserve) {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.denied = denied;
    fixture.override = override;
    fixture.original.withDisplayName("Human name");
    fixture.updated.withDisplayName("Source name");
    fixture.updates.updateDisplayName(fixture, fixture.original, fixture.updated);
    assertEquals(preserve ? "Human name" : "Source name", fixture.updated.getDisplayName());
    assertEquals(!preserve, EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void unchangedAndHumanDisplayNamesDoNotEvaluateBotPermissions() {
    final Fixture fixture = new Fixture();
    fixture.rejectPermissionRead = true;
    fixture.bot = true;
    fixture.original.withDisplayName("Same");
    fixture.updated.withDisplayName("Same");
    fixture.updates.updateDisplayName(fixture, fixture.original, fixture.updated);
    fixture.bot = false;
    fixture.updated.withDisplayName("Human update");
    fixture.updates.updateDisplayName(fixture, fixture.original, fixture.updated);
    assertEquals(FIELD_DISPLAY_NAME, fixture.changes.getFieldsUpdated().getFirst().getName());
  }

  @Test
  void putAndPatchCannotSetTheReadOnlyDeletedAttribute() {
    final Fixture fixture = new Fixture();
    fixture.updated.setDeleted(true);
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.updates.updateDeleted(fixture, fixture.original, fixture.updated));
    fixture.put = false;
    fixture.patch = true;
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.updates.updateDeleted(fixture, fixture.original, fixture.updated));
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void deleteRecordingAndPutRestoreKeepTheirExistingChanges() {
    final Fixture fixture = new Fixture();
    fixture.put = false;
    fixture.updated.setDeleted(true);
    fixture.updates.updateDeleted(fixture, fixture.original, fixture.updated);
    assertEquals(FIELD_DELETED, fixture.changes.getFieldsUpdated().getFirst().getName());
    assertEquals(true, fixture.changes.getFieldsUpdated().getFirst().getNewValue());
    fixture.put = true;
    fixture.original.setDeleted(true);
    fixture.updates.updateDeleted(fixture, fixture.original, fixture.updated);
    assertFalse(fixture.updated.getDeleted());
    assertEquals(false, fixture.changes.getFieldsUpdated().getLast().getNewValue());
  }

  @Test
  void consolidationRetainsTheExistingReadOnlyAttributeExceptions() {
    final Fixture fixture = new Fixture();
    fixture.updated.withDeleted(true).withVersion(0.9);
    fixture.updates.updateDeleted(fixture, fixture.original, fixture.updated);
    fixture.updated.setVersion(1.0);
    fixture.changes.getFieldsAdded().add(new FieldChange().withName(FIELD_DESCRIPTION));
    fixture.updates.updateDeleted(fixture, fixture.original, fixture.updated);
    assertTrue(fixture.updated.getDeleted());
  }

  @Test
  void putRetainsOmittedStyleWhilePatchCanDeleteIt() {
    final Fixture fixture = new Fixture();
    final GlossaryTerm original = new GlossaryTerm().withStyle(new Style().withColor("#123456"));
    final GlossaryTerm updated = new GlossaryTerm();
    fixture.updates.updateStyle(fixture, original, updated);
    assertSame(original.getStyle(), updated.getStyle());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    fixture.put = false;
    updated.setStyle(null);
    fixture.updates.updateStyle(fixture, original, updated);
    assertEquals(
        "{\"color\":\"#123456\"}", fixture.changes.getFieldsDeleted().getFirst().getOldValue());
  }

  @Test
  void unsupportedStyleAndLifecycleRemainUntouched() {
    final Fixture fixture = new Fixture();
    final EntityValueUpdates updates =
        new EntityValueUpdates(
            new EntityValueUpdates.Capabilities(TABLE, false, false),
            DescriptionSanitizer::sanitize);
    fixture.updated.setStyle(new Style().withColor("#123456"));
    fixture.updated.setLifeCycle(new LifeCycle().withCreated(access(100)));
    updates.updateStyle(fixture, fixture.original, fixture.updated);
    updates.updateLifeCycle(fixture, fixture.original, fixture.updated);
    assertFalse(fixture.changed);
  }

  @Test
  void lifecycleRetainsLatestTimestampsAndUsesIncomingDetailsOnEqualTimestamps() {
    final Fixture fixture = new Fixture();
    final LifeCycle original =
        new LifeCycle().withCreated(access(100)).withAccessed(access(200)).withUpdated(access(300));
    final LifeCycle updated =
        new LifeCycle()
            .withCreated(access(90))
            .withAccessed(access(200).withAccessedByAProcess("new"));
    fixture.original.setLifeCycle(original);
    fixture.updated.setLifeCycle(updated);
    fixture.updates.updateLifeCycle(fixture, fixture.original, fixture.updated);
    assertSame(original.getCreated(), updated.getCreated());
    assertSame(original.getUpdated(), updated.getUpdated());
    assertEquals("new", updated.getAccessed().getAccessedByAProcess());
    assertTrue(fixture.changed);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void lifecycleAdditionAndRemovalDoNotAddVersionedChanges() {
    final Fixture fixture = new Fixture();
    fixture.updated.setLifeCycle(new LifeCycle().withAccessed(access(200)));
    fixture.updates.updateLifeCycle(fixture, fixture.original, fixture.updated);
    assertTrue(fixture.changed);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    fixture.changed = false;
    fixture.original.setLifeCycle(fixture.updated.getLifeCycle());
    fixture.updated.setLifeCycle(null);
    fixture.updates.updateLifeCycle(fixture, fixture.original, fixture.updated);
    assertSame(fixture.original.getLifeCycle(), fixture.updated.getLifeCycle());
    assertFalse(fixture.changed);
    fixture.put = false;
    fixture.updated.setLifeCycle(null);
    fixture.updates.updateLifeCycle(fixture, fixture.original, fixture.updated);
    assertTrue(fixture.changed);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void newerLifecycleValuesAndPreviouslyAbsentAccessDetailsAreRetained() {
    final Fixture fixture = new Fixture();
    fixture.original.setLifeCycle(new LifeCycle().withCreated(access(100)));
    final LifeCycle updated =
        new LifeCycle().withCreated(access(200)).withAccessed(access(300)).withUpdated(access(400));
    fixture.updated.setLifeCycle(updated);
    fixture.updates.updateLifeCycle(fixture, fixture.original, fixture.updated);
    assertEquals(200L, updated.getCreated().getTimestamp());
    assertEquals(300L, updated.getAccessed().getTimestamp());
    assertEquals(400L, updated.getUpdated().getTimestamp());
  }

  private static AccessDetails access(final long timestamp) {
    return new AccessDetails().withTimestamp(timestamp);
  }

  private static final class Fixture implements EntityValueUpdates.Session {
    private final Table original = new Table().withVersion(1.0).withDeleted(false);
    private final Table updated = new Table().withVersion(1.0).withDeleted(false);
    private final ChangeDescription changes = new ChangeDescription();
    private final EntityValueUpdates updates =
        new EntityValueUpdates(
            new EntityValueUpdates.Capabilities(TABLE, true, true), DescriptionSanitizer::sanitize);
    private boolean put = true;
    private boolean patch;
    private boolean bot;
    private boolean override;
    private boolean denied;
    private boolean rejectPermissionRead;
    private boolean changed;

    @Override
    public boolean isPut() {
      return put;
    }

    @Override
    public boolean isPatch() {
      return patch;
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
    public ChangeDescription getChangeDescription() {
      return changes;
    }

    @Override
    public boolean updatingBotDeniedOperation(final MetadataOperation operation) {
      if (rejectPermissionRead) {
        throw new AssertionError("Unexpected policy lookup");
      }
      assertEquals(MetadataOperation.EDIT_DISPLAY_NAME, operation);
      return denied;
    }

    @Override
    public <K> boolean recordChange(final String field, final K previous, final K current) {
      return recordChange(field, previous, current, false);
    }

    @Override
    public <K> boolean recordChange(
        final String field, final K previous, final K current, final boolean json) {
      final boolean differs = !Objects.equals(previous, current);
      if (differs) {
        changed = true;
        EntityChangeRecorder.recordValue(changes, field, previous, current, json);
      }
      return differs;
    }

    @Override
    public void recordUnversionedChange(
        final String field, final Object previous, final Object current) {
      changed |= !Objects.equals(previous, current);
    }
  }
}
