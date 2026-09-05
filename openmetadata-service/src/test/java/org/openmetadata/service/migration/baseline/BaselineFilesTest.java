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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class BaselineFilesTest {

  @TempDir Path baselineDir;

  @BeforeEach
  void writeFixtures() throws IOException {
    Path mysqlDir = Files.createDirectories(baselineDir.resolve("mysql"));
    Files.writeString(
        mysqlDir.resolve(BaselineFiles.SCHEMA_FILE),
        "-- baseline header\nCREATE TABLE IF NOT EXISTS a (id int);\nCREATE TABLE IF NOT EXISTS b (id int);\n");
  }

  @Test
  void parsesSchemaStatements() {
    BaselineFiles files = new BaselineFiles(baselineDir.toString(), ConnectionType.MYSQL);
    assertTrue(files.exists());
    List<String> schema = files.schemaStatements();
    assertEquals(2, schema.size());
    assertEquals("-- baseline header\nCREATE TABLE IF NOT EXISTS a (id int)", schema.get(0));
    assertEquals("CREATE TABLE IF NOT EXISTS b (id int)", schema.get(1));
  }

  @Test
  void missingDialectDirectoryMeansAbsent() {
    BaselineFiles files = new BaselineFiles(baselineDir.toString(), ConnectionType.POSTGRES);
    assertFalse(files.exists());
  }

  @Test
  void checksumTracksContent() throws IOException {
    BaselineFiles files = new BaselineFiles(baselineDir.toString(), ConnectionType.MYSQL);
    String before = files.contentChecksum();
    Files.writeString(
        baselineDir.resolve("mysql").resolve(BaselineFiles.SCHEMA_FILE),
        "CREATE TABLE IF NOT EXISTS c (id int);\n");
    assertNotEquals(before, files.contentChecksum());
  }
}
