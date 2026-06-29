package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MigrationTrackingTableCharsetTest {

  @Test
  void detectsLatin1AsNeedingConversion() {
    assertTrue(MigrationWorkflow.needsUtf8mb4Conversion("latin1"));
  }

  @Test
  void detectsLegacyUtf8mb3AsNeedingConversion() {
    assertTrue(MigrationWorkflow.needsUtf8mb4Conversion("utf8mb3"));
  }

  @Test
  void leavesUtf8mb4Unchanged() {
    assertFalse(MigrationWorkflow.needsUtf8mb4Conversion("utf8mb4"));
  }

  @Test
  void skipsWhenCharsetIsUnknown() {
    assertFalse(MigrationWorkflow.needsUtf8mb4Conversion(null));
  }
}
