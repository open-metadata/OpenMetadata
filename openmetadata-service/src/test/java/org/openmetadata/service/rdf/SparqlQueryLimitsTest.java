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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class SparqlQueryLimitsTest {
  @Test
  void refusesSingleByteWritesBeforeTheyReachTheOutput() throws Exception {
    final ByteArrayOutputStream target = new ByteArrayOutputStream();
    try (final var output = new SparqlQueryLimits.BoundedOutputStream(target, 2, "limit")) {
      output.write('a');
      output.write('b');
      assertThrows(SparqlQueryLimits.QueryLimitExceededException.class, () -> output.write('c'));
      output.flush();
    }
    assertEquals("ab", target.toString(StandardCharsets.UTF_8));
  }

  @Test
  void countsUtf8BytesAndRejectsTheWholeOversizedWrite() throws Exception {
    final ByteArrayOutputStream target = new ByteArrayOutputStream();
    final byte[] character = "\u754c".getBytes(StandardCharsets.UTF_8);
    try (final var output = new SparqlQueryLimits.BoundedOutputStream(target, 4, "limit")) {
      output.write(character);
      assertThrows(
          SparqlQueryLimits.QueryLimitExceededException.class, () -> output.write(character));
      assertEquals(3, target.size());
      output.write('!');
      output.write(character, 0, 0);
      assertThrows(
          IndexOutOfBoundsException.class, () -> output.write(character, 0, character.length + 1));
    }
    assertEquals("\u754c!", target.toString(StandardCharsets.UTF_8));
  }
}
