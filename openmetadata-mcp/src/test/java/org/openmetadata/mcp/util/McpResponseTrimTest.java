/*
 *  Copyright 2025 Collate
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

package org.openmetadata.mcp.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Pins the shared trimming primitives the MCP tools delegate to. The two truncate conventions are
 * deliberately different (cut-at-max vs. cut-450-when-over-500); these tests guard against them
 * being accidentally unified, which would silently change tool output.
 */
class McpResponseTrimTest {

  @Test
  void truncateCutsAtMaxAndAppendsEllipsis() {
    String value = "a".repeat(600);

    String result = McpResponseTrim.truncate(value, McpResponseTrim.SQL_MAX_LENGTH);

    assertThat(result).hasSize(McpResponseTrim.SQL_MAX_LENGTH + 3).endsWith("...");
  }

  @Test
  void truncateLeavesShortAndNullUntouched() {
    assertThat(McpResponseTrim.truncate("short", McpResponseTrim.SQL_MAX_LENGTH))
        .isEqualTo("short");
    assertThat(McpResponseTrim.truncate(null, McpResponseTrim.SQL_MAX_LENGTH)).isNull();
  }

  @Test
  void truncateDescriptionCutsTo450OnlyWhenOver500() {
    String justOver = "b".repeat(501);
    String atThreshold = "c".repeat(500);

    String truncated = McpResponseTrim.truncateDescription(justOver);

    assertThat(truncated).hasSize(McpResponseTrim.DESCRIPTION_TRUNCATE_LENGTH + 3).endsWith("...");
    assertThat(McpResponseTrim.truncateDescription(atThreshold)).isEqualTo(atThreshold);
    assertThat(McpResponseTrim.truncateDescription(null)).isNull();
  }

  @Test
  void serializedLengthMatchesJsonSize() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("a", "x");

    assertThat(McpResponseTrim.serializedLength(result)).isEqualTo("{\"a\":\"x\"}".length());
  }

  @Test
  void oversizedEnvelopeMergesIdentityAndFlagsTruncated() {
    Map<String, Object> identity = new LinkedHashMap<>();
    identity.put("tool", "get_entity_details");

    Map<String, Object> envelope =
        McpResponseTrim.oversizedEnvelope(123_456, identity, "Refine your query.");

    assertThat(envelope.get("tool")).isEqualTo("get_entity_details");
    assertThat(envelope.get("truncated")).isEqualTo(Boolean.TRUE);
    assertThat(envelope.get("responseSizeChars")).isEqualTo(123_456);
    assertThat(envelope.get("maxResponseChars")).isEqualTo(McpResponseTrim.MAX_RESPONSE_CHARS);
    assertThat(envelope.get("message")).isEqualTo("Refine your query.");
  }

  @Test
  void oversizedEnvelopeToleratesNullIdentity() {
    Map<String, Object> envelope = McpResponseTrim.oversizedEnvelope(10, null, "advice");

    assertThat(envelope)
        .containsKeys("truncated", "responseSizeChars", "maxResponseChars", "message");
  }

  @Test
  void safeMessageReplacesNullMessage() {
    assertThat(McpResponseTrim.safeMessage(new RuntimeException("boom"))).isEqualTo("boom");
    assertThat(McpResponseTrim.safeMessage(new RuntimeException())).isEqualTo("<no message>");
    assertThat(McpResponseTrim.safeMessage(null)).isEqualTo("<no message>");
  }
}
