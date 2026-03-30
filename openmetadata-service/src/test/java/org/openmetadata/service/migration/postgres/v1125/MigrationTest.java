package org.openmetadata.service.migration.postgres.v1125;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1125.MigrationUtil;

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
  void runDataMigrationCallsMigrateCertificationToTagUsage() throws Exception {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(List.of());
    Migration migration = createMigrationWithHandle(handle);

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle)).then(inv -> null);
      util.when(MigrationUtil::migrateWorkflowDefinitions).then(inv -> null);
      util.when(() -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.POSTGRES))
          .then(inv -> null);

      migration.runDataMigration();

      util.verify(
          () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.POSTGRES));
    }
  }

  @Test
  void runDataMigrationHandlesMigrateCertificationException() throws Exception {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(List.of());
    Migration migration = createMigrationWithHandle(handle);

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle)).then(inv -> null);
      util.when(MigrationUtil::migrateWorkflowDefinitions).then(inv -> null);
      util.when(() -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.POSTGRES))
          .thenThrow(new RuntimeException("certification migration failed"));

      assertDoesNotThrow(() -> migration.runDataMigration());
    }
  }
}
