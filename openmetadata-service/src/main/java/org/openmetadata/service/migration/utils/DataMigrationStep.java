package org.openmetadata.service.migration.utils;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.MigrationDAO;

/**
 * Runs a single data migration step at most once per version.
 *
 * <p>A version's data migration runs again whenever its fingerprint changes, and the fingerprint
 * covers every helper in that version's {@code utils.vNNN} package (see {@link
 * MigrationCodeFingerprint}). So a helper added later in the release train re-runs every step of
 * that version. That is harmless for a step that is cheap to repeat, but a one-time backfill over
 * large tables should not pay its full cost on each re-run.
 *
 * <p>A step run through here records a marker in SERVER_MIGRATION_SQL_LOGS once it succeeds, and
 * is skipped while that marker exists. A step that fails records nothing, so the next run retries
 * it. The marker is written through the migration's own handle, so it commits or rolls back with
 * the step's writes.
 */
@Slf4j
public final class DataMigrationStep {

  private static final String MARKER_PREFIX = "data-migration-step:";

  private DataMigrationStep() {}

  public static void runOnce(
      final MigrationDAO migrationDAO,
      final String version,
      final String stepName,
      final Runnable step) {
    final String marker = markerFor(version, stepName);
    if (isRecorded(migrationDAO, version, marker)) {
      LOG.info("Skipping data migration step {} for {}: already applied", stepName, version);
    } else {
      step.run();
      migrationDAO.upsertServerMigrationSQL(version, "-- data migration step " + stepName, marker);
    }
  }

  /** SERVER_MIGRATION_SQL_LOGS keys on the marker alone, so it must be unique across versions. */
  static String markerFor(final String version, final String stepName) {
    return MARKER_PREFIX + version + ":" + stepName;
  }

  private static boolean isRecorded(
      final MigrationDAO migrationDAO, final String version, final String marker) {
    return !nullOrEmpty(migrationDAO.getSqlQuery(version, marker));
  }
}
