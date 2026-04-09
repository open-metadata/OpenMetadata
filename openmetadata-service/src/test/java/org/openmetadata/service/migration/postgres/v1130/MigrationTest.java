package org.openmetadata.service.migration.postgres.v1130;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.lang.reflect.Field;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1130.MigrationUtil;

class MigrationTest {

  private Migration createMigrationWithHandle(Handle handle) throws Exception {
    MigrationFile migrationFile = mock(MigrationFile.class);
    Migration migration = new Migration(migrationFile);
    Field handleField = MigrationProcessImpl.class.getDeclaredField("handle");
    handleField.setAccessible(true);
    handleField.set(migration, handle);
    return migration;
  }

  @Test
  void runDataMigrationCallsBackfillRelationshipFqnHashes() throws Exception {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    Migration migration = createMigrationWithHandle(handle);

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(MigrationUtil::updateOwnerChartFormulas).then(inv -> null);
      util.when(() -> MigrationUtil.backfillRelationshipFqnHashes(handle)).then(inv -> null);

      migration.runDataMigration();

      util.verify(() -> MigrationUtil.backfillRelationshipFqnHashes(handle));
    }
  }

  @Test
  void runDataMigrationDoesNotThrowWhenBackfillFails() throws Exception {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    Migration migration = createMigrationWithHandle(handle);

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(MigrationUtil::updateOwnerChartFormulas).then(inv -> null);
      util.when(() -> MigrationUtil.backfillRelationshipFqnHashes(handle))
          .thenThrow(new RuntimeException("DB error"));

      assertDoesNotThrow(migration::runDataMigration);
    }
  }
}
