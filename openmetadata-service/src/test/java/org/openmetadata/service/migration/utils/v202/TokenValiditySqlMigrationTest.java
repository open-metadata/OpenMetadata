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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Static guard over the 2.0.2 data repair. It does not execute SQL — replay behaviour against real
 * MySQL and PostgreSQL is covered manually — but it does fail if either provider path is dropped,
 * which is the regression that would silently leave upgraded tenants locked out.
 */
class TokenValiditySqlMigrationTest {

  @ParameterizedTest
  @ValueSource(strings = {"mysql", "postgres"})
  void repairsNonPositiveTokenValidityForBothProviders(String dialect) throws IOException {
    String sql = readPostDataMigration(dialect);

    assertTrue(sql.contains("openmetadata_settings"));
    assertTrue(sql.contains("authenticationconfiguration"));
    assertTrue(sql.contains("3600"));
    assertTrue(sql.contains("oidcconfiguration"), "missing the OIDC repair");
    assertTrue(sql.contains("samlconfiguration"), "missing the SAML repair");
  }

  /** The guard is what makes a replay a no-op, so every repair statement must carry it. */
  @ParameterizedTest
  @ValueSource(strings = {"mysql", "postgres"})
  void everyRepairIsGuardedSoReplayIsANoOp(String dialect) throws IOException {
    String sql = readPostDataMigration(dialect);

    assertEquals(2, countOccurrences(sql, "update openmetadata_settings"));
    assertEquals(2, countOccurrences(sql, "<= 0"));
  }

  private String readPostDataMigration(String dialect) throws IOException {
    return Files.readString(
            migrationRoot().resolve(dialect).resolve("postDataMigrationSQLScript.sql"))
        .toLowerCase(Locale.ROOT);
  }

  private int countOccurrences(String sql, String token) {
    int count = 0;
    int index = sql.indexOf(token);
    while (index >= 0) {
      count++;
      index = sql.indexOf(token, index + token.length());
    }
    return count;
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
