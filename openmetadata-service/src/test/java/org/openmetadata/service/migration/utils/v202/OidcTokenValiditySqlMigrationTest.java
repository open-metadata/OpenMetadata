/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v202;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class OidcTokenValiditySqlMigrationTest {

  @ParameterizedTest
  @ValueSource(strings = {"mysql", "postgres"})
  void repairsNonPositiveOidcTokenValidity(String dialect) throws IOException {
    String sql =
        Files.readString(migrationRoot().resolve(dialect).resolve("schemaChanges.sql"))
            .toLowerCase(Locale.ROOT);

    assertTrue(sql.contains("openmetadata_settings"));
    assertTrue(sql.contains("authenticationconfiguration"));
    assertTrue(sql.contains("tokenvalidity"));
    assertTrue(sql.contains("3600"));
    assertTrue(sql.contains("<= 0"));
  }

  private static Path migrationRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve("bootstrap/sql/schema/mysql.sql"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current.resolve("bootstrap/sql/migrations/native/2.0.2");
  }
}
