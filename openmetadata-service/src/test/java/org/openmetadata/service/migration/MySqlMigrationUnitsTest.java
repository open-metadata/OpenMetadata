package org.openmetadata.service.migration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * Every shipped MySQL migration file must parse into units: a malformed guarded block would
 * otherwise fail on a customer database. Each PREPARE starts exactly one block.
 */
class MySqlMigrationUnitsTest {

  @Test
  void everyMySqlMigrationFileParsesIntoUnits() throws IOException {
    MySqlMigrationUnits.assertEveryFileParsesIntoUnits(nativeMigrationsRoot());
  }

  private static Path nativeMigrationsRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current.resolve("bootstrap/sql/migrations/native");
  }
}
