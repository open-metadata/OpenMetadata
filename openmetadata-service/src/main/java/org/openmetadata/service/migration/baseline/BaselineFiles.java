/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.migration.baseline;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SqlStatementSplitter;
import org.openmetadata.service.util.EntityUtil;

/**
 * Resolves and parses the consolidated baseline SQL for one dialect:
 * {@code {baselinePath}/{mysql|postgres}/schema.sql}.
 *
 * <p>Schema only, deliberately: the baseline replaces the historical migration chain, not the
 * application's own seeding. Everything a running system needs in its tables — default settings,
 * search index-mapping versions, seeded policies, workflow definitions, Data Insight charts — is
 * created by the application at boot from {@code json/data/**}, so freezing a snapshot of those
 * rows here would only pin them to whatever they looked like the day the baseline was cut.
 *
 * <p>Unlike {@link org.openmetadata.service.migration.utils.MigrationFile}, no per-statement dedup
 * lookups happen here — baseline statements are never recorded in SERVER_MIGRATION_SQL_LOGS.
 */
public class BaselineFiles {

  public static final String SCHEMA_FILE = "schema.sql";

  private final ConnectionType connectionType;
  private final Path dialectDirectory;

  public BaselineFiles(String baselinePath, ConnectionType connectionType) {
    this.connectionType = connectionType;
    String dialectDirName = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    this.dialectDirectory = Paths.get(baselinePath, dialectDirName);
  }

  public boolean exists() {
    return Files.isRegularFile(schemaFile());
  }

  public List<String> schemaStatements() {
    return SqlStatementSplitter.splitFile(schemaFile(), connectionType);
  }

  /** MD5 over the baseline file contents — recorded on the baseline history row. */
  public String contentChecksum() {
    return EntityUtil.hash(readFile(schemaFile()));
  }

  public String directoryPath() {
    return dialectDirectory.toString();
  }

  private Path schemaFile() {
    return dialectDirectory.resolve(SCHEMA_FILE);
  }

  private String readFile(Path file) {
    try {
      return Files.readString(file, StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read baseline file: " + file, e);
    }
  }
}
