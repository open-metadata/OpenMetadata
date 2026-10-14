package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.MigrationDAO;

class DataMigrationStepTest {

  private static final String VERSION = "2.1.0";
  private static final String STEP = "creation-audit-backfill";
  private static final String MARKER = DataMigrationStep.markerFor(VERSION, STEP);

  private MigrationDAO migrationDAO;
  private AtomicInteger runs;

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
    runs = new AtomicInteger();
  }

  @Test
  void runsTheStepAndRecordsItsMarkerWhenNotYetApplied() {
    when(migrationDAO.getSqlQuery(VERSION, MARKER)).thenReturn(null);

    DataMigrationStep.runOnce(migrationDAO, VERSION, STEP, runs::incrementAndGet);

    assertEquals(1, runs.get(), "a step with no marker should run");
    verify(migrationDAO)
        .upsertServerMigrationSQL(VERSION, "-- data migration step " + STEP, MARKER);
  }

  @Test
  void skipsTheStepWhileItsMarkerIsRecorded() {
    when(migrationDAO.getSqlQuery(VERSION, MARKER)).thenReturn("-- data migration step " + STEP);

    DataMigrationStep.runOnce(migrationDAO, VERSION, STEP, runs::incrementAndGet);

    assertEquals(0, runs.get(), "a recorded step must not run again");
    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void recordsNothingWhenTheStepFails() {
    when(migrationDAO.getSqlQuery(VERSION, MARKER)).thenReturn(null);

    assertThrows(
        IllegalStateException.class,
        () ->
            DataMigrationStep.runOnce(
                migrationDAO,
                VERSION,
                STEP,
                () -> {
                  throw new IllegalStateException("backfill failed");
                }));

    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void theSameStepGetsADistinctMarkerInEachVersion() {
    assertNotEquals(
        DataMigrationStep.markerFor("2.1.0", STEP),
        DataMigrationStep.markerFor("2.1.1", STEP),
        "SERVER_MIGRATION_SQL_LOGS keys on the marker alone, so it must include the version");
  }
}
