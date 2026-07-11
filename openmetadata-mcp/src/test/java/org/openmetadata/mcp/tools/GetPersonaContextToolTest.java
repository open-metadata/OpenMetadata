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
package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class GetPersonaContextToolTest {

  @Test
  void splitsLargeDocumentsDeterministicallyAtLineBoundaries() {
    String content = "a".repeat(84_999) + "\n" + "b".repeat(90_000) + "\nend";

    List<String> parts = GetPersonaContextTool.split(content);

    assertEquals(content, String.join("", parts));
    assertTrue(parts.stream().allMatch(part -> part.length() <= 85_000));
    assertTrue(parts.getFirst().endsWith("\n"));
  }

  @Test
  void representsAnEmptyDocumentAsOnePart() {
    assertEquals(List.of(""), GetPersonaContextTool.split(""));
  }
}
