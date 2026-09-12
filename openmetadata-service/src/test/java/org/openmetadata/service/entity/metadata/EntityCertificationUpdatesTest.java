package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityChangeRecorder;

class EntityCertificationUpdatesTest {
  private static final String CERTIFIED = "Certification.Certified";
  private static final String FQN = "service.database.schema.table";
  private static final long NOW = Instant.parse("2025-01-31T10:30:00Z").toEpochMilli();

  @Test
  void applyingCertificationUsesOneClockReadAndCalendarPeriodInUtc() {
    final Fixture fixture = new Fixture();
    fixture.updated.setCertification(certification(CERTIFIED));
    fixture.run();
    assertEquals(NOW, fixture.stored.getAppliedDate());
    assertEquals(
        Instant.parse("2025-02-28T10:30:00Z").toEpochMilli(), fixture.stored.getExpiryDate());
    assertEquals(1, fixture.clockReads);
    assertEquals(1, fixture.settingsReads);
    assertEquals(
        JsonUtils.pojoToJson(fixture.stored),
        fixture.changes.getFieldsAdded().getFirst().getNewValue());
  }

  @Test
  void unchangedCertificationAvoidsSettingsAndPersistence() {
    final Fixture fixture = new Fixture();
    fixture.original.setCertification(certification(CERTIFIED));
    fixture.updated.setCertification(certification(CERTIFIED));
    fixture.stored = fixture.original.getCertification();
    fixture.run();
    assertSame(fixture.original.getCertification(), fixture.stored);
    fixture.assertNoSettingsOrChanges();
  }

  @Test
  void deletingCertificationRecordsTheOldValue() {
    final Fixture fixture = new Fixture();
    fixture.original.setCertification(certification(CERTIFIED));
    fixture.stored = fixture.original.getCertification();
    fixture.run();
    assertNull(fixture.stored);
    assertEquals(FQN, fixture.deletedFqn);
    assertEquals(
        JsonUtils.pojoToJson(fixture.original.getCertification()),
        fixture.changes.getFieldsDeleted().getFirst().getOldValue());
    assertEquals(0, fixture.settingsReads);
  }

  @Test
  void nullCertificationStillClearsStoredTagsWhenTheInputProjectionIsEmpty() {
    final Fixture fixture = new Fixture();
    fixture.stored = certification(CERTIFIED);
    fixture.run();
    assertNull(fixture.stored);
    assertEquals(FQN, fixture.deletedFqn);
    fixture.assertNoSettingsOrChanges();
  }

  @Test
  void botPutRetainsAnExistingCertificationWithoutSettingsReads() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.original.setCertification(certification(CERTIFIED));
    fixture.updated.setCertification(certification("Certification.Other"));
    fixture.run();
    assertSame(fixture.original.getCertification(), fixture.updated.getCertification());
    fixture.assertNoSettingsOrChanges();
  }

  @Test
  void botPatchCanReplaceCertificationAndBotPutCanFillAnAbsentValue() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.updated.setCertification(certification(CERTIFIED));
    fixture.run();
    assertEquals(CERTIFIED, fixture.stored.getTagLabel().getTagFQN());
    fixture.put = false;
    fixture.original.setCertification(fixture.updated.getCertification());
    fixture.updated.setCertification(certification("Certification.Other"));
    fixture.run();
    assertEquals("Certification.Other", fixture.stored.getTagLabel().getTagFQN());
  }

  @Test
  void unsupportedCertificationNeverReadsSettingsOrChangesTheEntity() {
    final Fixture fixture = new Fixture();
    fixture.supported = false;
    final AssetCertification incoming = certification(CERTIFIED);
    fixture.updated.setCertification(incoming);
    fixture.run();
    assertSame(incoming, fixture.updated.getCertification());
    assertNull(fixture.stored);
    fixture.assertNoSettingsOrChanges();
  }

  @Test
  void missingSettingsAndWrongClassificationRetainTheExistingErrors() {
    final Fixture fixture = new Fixture();
    fixture.updated.setCertification(certification(CERTIFIED));
    fixture.settings = null;
    assertTrue(
        assertThrows(IllegalArgumentException.class, fixture::run)
            .getMessage()
            .startsWith("Certification is not configured."));
    fixture.settings = new AssetCertificationSettings().withAllowedClassification("Other");
    assertEquals(
        "Invalid Classification: Certification.Certified is not valid for Certification.",
        assertThrows(IllegalArgumentException.class, fixture::run).getMessage());
    assertNull(fixture.updated.getCertification().getAppliedDate());
    assertNull(fixture.stored);
  }

  @Test
  void nestedAndQuotedClassificationLabelsKeepTheirParentFqnRules() {
    final Fixture fixture = new Fixture();
    fixture.settings.setAllowedClassification("Certification.Nested");
    fixture.updated.setCertification(certification("Certification.Nested.Certified"));
    fixture.run();
    assertEquals("Certification.Nested.Certified", fixture.stored.getTagLabel().getTagFQN());
    fixture.settings.setAllowedClassification("\"Certification.with.dot\"");
    fixture.updated.setCertification(certification("\"Certification.with.dot\".Certified"));
    fixture.run();
    assertEquals("\"Certification.with.dot\".Certified", fixture.stored.getTagLabel().getTagFQN());
  }

  @Test
  void persistenceFailuresPropagateBeforeRecordingAChange() {
    final Fixture fixture = new Fixture();
    fixture.updated.setCertification(certification(CERTIFIED));
    fixture.failure = new IllegalStateException("Tag write failed");
    assertSame(fixture.failure, assertThrows(IllegalStateException.class, fixture::run));
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  private static AssetCertification certification(final String fqn) {
    return new AssetCertification().withTagLabel(new TagLabel().withTagFQN(fqn));
  }

  private static final class Fixture implements EntityCertificationUpdates.Session {
    private final Table original = new Table().withFullyQualifiedName(FQN);
    private final Table updated = new Table().withFullyQualifiedName(FQN);
    private final ChangeDescription changes = new ChangeDescription();
    private AssetCertificationSettings settings =
        new AssetCertificationSettings()
            .withAllowedClassification("Certification")
            .withValidityPeriod("P1M");
    private AssetCertification stored;
    private IllegalStateException failure;
    private boolean supported = true;
    private boolean put = true;
    private boolean bot;
    private boolean overrideMetadata;
    private int settingsReads;
    private int clockReads;
    private String deletedFqn;

    private void run() {
      final EntityCertificationUpdates<Table> updates =
          new EntityCertificationUpdates<>(
              supported,
              () -> {
                settingsReads++;
                return settings;
              },
              () -> {
                clockReads++;
                return NOW;
              },
              new EntityCertificationUpdates.Persistence<>(this::delete, this::apply));
      updates.update(this, original, updated);
    }

    private void delete(final String fqn) {
      deletedFqn = fqn;
      stored = null;
    }

    private void apply(final Table entity) {
      if (failure != null) {
        throw failure;
      }
      stored = JsonUtils.deepCopy(entity.getCertification(), AssetCertification.class);
    }

    private void assertNoSettingsOrChanges() {
      assertEquals(0, settingsReads);
      assertEquals(0, clockReads);
      assertFalse(EntityChangeRecorder.hasChanges(changes));
    }

    @Override
    public boolean isPut() {
      return put;
    }

    @Override
    public boolean isOverrideMetadata() {
      return overrideMetadata;
    }

    @Override
    public boolean updatedByBot() {
      return bot;
    }

    @Override
    public <K> boolean recordChange(
        final String field, final K previous, final K current, final boolean json) {
      final boolean differs = !Objects.equals(previous, current);
      if (differs) {
        EntityChangeRecorder.recordValue(changes, field, previous, current, json);
      }
      return differs;
    }
  }
}
