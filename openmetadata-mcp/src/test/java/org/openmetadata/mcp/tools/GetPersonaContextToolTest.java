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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.service.aicontext.PersonaContextBuilder.MaterializedPersonaContext;

class GetPersonaContextToolTest {

  @Test
  void splitsLargeDocumentsDeterministicallyAtLineBoundaries() {
    String content = "a".repeat(84_999) + "\n" + "b".repeat(90_000) + "\nend";

    List<String> parts = GetPersonaContextTool.split(content);

    assertEquals(content, String.join("", parts));
    assertTrue(
        parts.stream()
            .allMatch(
                part ->
                    McpResponseTrim.serializedLength(Map.of("content", part))
                        <= McpResponseTrim.MAX_RESPONSE_CHARS - 10_000));
    assertTrue(parts.getFirst().endsWith("\n"));
  }

  @Test
  void budgetsJsonEscapingInsideTheMcpEnvelope() {
    String content = "{\"line\":\"\\\\quoted\\nvalue\"}\n".repeat(10_000);

    List<String> parts = GetPersonaContextTool.split(content);

    assertEquals(content, String.join("", parts));
    assertTrue(parts.size() > 1);
    assertTrue(
        parts.stream()
            .allMatch(
                part ->
                    McpResponseTrim.serializedLength(Map.of("content", part))
                        <= McpResponseTrim.MAX_RESPONSE_CHARS - 10_000));
  }

  @Test
  void representsAnEmptyDocumentAsOnePart() {
    assertEquals(List.of(""), GetPersonaContextTool.split(""));
  }

  @Test
  void carriesThePromptAsInstructionsOnTheFirstPartOnly() {
    MaterializedPersonaContext materialized =
        materialized(
            "You assist finance analysts.", "a".repeat(80_000) + "\n" + "b".repeat(80_000));

    Map<String, Object> first = GetPersonaContextTool.page(materialized, "markdown", 1);
    Map<String, Object> second = GetPersonaContextTool.page(materialized, "markdown", 2);

    assertEquals("You assist finance analysts.", first.get("instructions"));
    assertFalse(second.containsKey("instructions"));
    // The document stays reference data; the prompt is never paged inside it.
    assertFalse(((String) first.get("content")).contains("You assist finance analysts."));
  }

  @Test
  void carriesThePromptInTheJsonFormatToo() {
    Map<String, Object> first =
        GetPersonaContextTool.page(materialized("Answer tersely.", "# doc"), "json", 1);

    assertEquals("Answer tersely.", first.get("instructions"));
    assertEquals("json", first.get("format"));
  }

  @Test
  void omitsInstructionsWhenThePersonaHasNoPrompt() {
    Map<String, Object> first =
        GetPersonaContextTool.page(materialized(null, "# doc"), "markdown", 1);

    assertFalse(first.containsKey("instructions"));
  }

  @Test
  void firstPartLeavesRoomForTheLargestPrompt() {
    // Quotes double when serialized, so this is the widest prompt the 8000-character cap admits.
    // Over MAX_RESPONSE_CHARS, dispatch would replace the whole part with a truncated envelope.
    String content = "a".repeat(84_999) + "\n" + "b".repeat(90_000) + "\nend";
    MaterializedPersonaContext materialized = materialized("\"".repeat(8_000), content);

    Map<String, Object> first = GetPersonaContextTool.page(materialized, "markdown", 1);
    int totalParts = (int) first.get("totalParts");
    StringBuilder paged = new StringBuilder();
    for (int part = 1; part <= totalParts; part++) {
      paged.append(GetPersonaContextTool.page(materialized, "markdown", part).get("content"));
    }

    assertTrue(McpResponseTrim.serializedLength(first) <= McpResponseTrim.MAX_RESPONSE_CHARS);
    assertEquals(content, paged.toString());
  }

  private static MaterializedPersonaContext materialized(String prompt, String markdown) {
    return new MaterializedPersonaContext(
        new PersonaContext().withPrompt(prompt).withFingerprint("fingerprint"), markdown);
  }
}
