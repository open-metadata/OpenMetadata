/*
 *  Copyright 2026 Collate
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
package org.openmetadata.fuseki.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class StorageReportTest {
  @TempDir Path databases;

  @Test
  void theHighestGenerationServesAndLowerOnesAreOrphaned() throws IOException {
    write(databases.resolve("collate/Data-0001/nodes.dat"), 100);
    write(databases.resolve("collate/Data-0003/nodes.dat"), 40);
    write(databases.resolve("collate/Data-0003/SPO.dat"), 2);
    Files.createDirectories(databases.resolve("collate/Data-0002"));
    write(databases.resolve("collate/tdb.lock"), 1);

    final StorageReport.DatasetStorage collate = StorageReport.datasets(databases).getFirst();

    assertEquals("collate", collate.name());
    assertEquals("Data-0003", collate.generation());
    assertEquals(42, collate.generationBytes());
    assertEquals(List.of("Data-0001", "Data-0002"), collate.orphanedGenerations());
  }

  @Test
  void directoriesThatAreNotTdb2DatasetsAreLeftOut() throws IOException {
    write(databases.resolve("collate_a/Data-0001/nodes.dat"), 5);
    write(databases.resolve("lucene/segments_1"), 5);
    write(databases.resolve("collate_b/Data-0001-tmp/nodes.dat"), 5);

    assertEquals(
        List.of("collate_a"),
        StorageReport.datasets(databases).stream()
            .map(StorageReport.DatasetStorage::name)
            .toList());
  }

  @Test
  void aMissingDatabaseDirectoryReportsNoDatasets() {
    assertEquals(List.of(), StorageReport.datasets(databases.resolve("absent")));
  }

  private static void write(final Path file, final int bytes) throws IOException {
    Files.createDirectories(file.getParent());
    Files.write(file, new byte[bytes]);
  }
}
