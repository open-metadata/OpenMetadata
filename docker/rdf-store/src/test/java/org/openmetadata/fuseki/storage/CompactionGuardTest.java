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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** A compaction copies at most the generation in service, which is what must fit on the volume. */
class CompactionGuardTest {
  @TempDir Path databases;

  @Test
  void theCopyIsAtMostTheGenerationInService() throws IOException {
    final Path dataset = databases.resolve("openmetadata");
    write(dataset.resolve("Data-0001/nodes.dat"), 4096);
    write(dataset.resolve("Data-0002/nodes.dat"), 1024);
    write(dataset.resolve("Data-0002/SPO.idn"), 512);
    write(dataset.resolve("Data-0003-tmp/nodes.dat"), 8192);

    assertEquals(1536, CompactionGuard.servingGenerationBytes(dataset));
  }

  @Test
  void aDatasetWithoutAGenerationHasNothingToCopy() {
    assertEquals(0, CompactionGuard.servingGenerationBytes(databases.resolve("missing")));
  }

  private static void write(final Path file, final int bytes) throws IOException {
    Files.createDirectories(file.getParent());
    Files.write(file, new byte[bytes]);
  }
}
