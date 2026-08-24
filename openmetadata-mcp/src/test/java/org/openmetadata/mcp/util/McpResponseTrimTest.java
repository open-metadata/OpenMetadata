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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
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

  @Test
  void slimRefKeepsOnlyTheActionableIdentifier() {
    Map<String, Object> ref = new LinkedHashMap<>();
    ref.put("id", "8c1e1f4e-0000-0000-0000-000000000000");
    ref.put("type", "databaseSchema");
    ref.put("name", "shopify");
    ref.put("fullyQualifiedName", "sample_data.ecommerce_db.shopify");
    ref.put("description", "A long schema description repeated on every hit from this schema.");
    ref.put("deleted", false);

    assertEquals(
        "sample_data.ecommerce_db.shopify",
        McpResponseTrim.slimRef(ref),
        "every MCP tool is addressed by (entityType, fqn), so the FQN is the only actionable part");
  }

  @Test
  void slimRefFallsBackToNameAndPassesThroughUnknownShapes() {
    assertEquals("marketing", McpResponseTrim.slimRef(Map.of("name", "marketing")));
    assertEquals("already-a-string", McpResponseTrim.slimRef("already-a-string"));
    Map<String, Object> odd = Map.of("unexpected", "shape");
    assertEquals(
        odd, McpResponseTrim.slimRef(odd), "an unrecognised payload passes through, never emptied");
  }

  @Test
  void slimTagDropsTheRepeatedTagDescription() {
    Map<String, Object> tier = new LinkedHashMap<>();
    tier.put("tagFQN", "Tier.Tier1");
    tier.put("description", "Critical Source of Truth business data assets ...");
    tier.put("labelType", "Manual");
    tier.put("state", "Confirmed");

    assertEquals("Tier.Tier1", McpResponseTrim.slimTag(tier));
    assertEquals(
        List.of("PII.Sensitive", "Tier.Tier1"),
        McpResponseTrim.slimTag(
            List.of(Map.of("tagFQN", "PII.Sensitive"), Map.of("tagFQN", "Tier.Tier1"))));
  }

  @Test
  void slimmingASearchHitIsWhereTheSavingComesFrom() {
    // On a live 10-hit search_metadata response, tier alone was 26.2% of the payload and the
    // service/database/databaseSchema references a further 32.9%. Guard the ratio, not the shape.
    Map<String, Object> schemaRef = new LinkedHashMap<>();
    schemaRef.put("id", "8c1e1f4e-0000-0000-0000-000000000000");
    schemaRef.put("type", "databaseSchema");
    schemaRef.put("name", "shopify");
    schemaRef.put("fullyQualifiedName", "sample_data.ecommerce_db.shopify");
    schemaRef.put("description", "A long schema description repeated on every hit ".repeat(4));

    int before = McpResponseTrim.serializedLength(schemaRef);
    int after = McpResponseTrim.serializedLength(McpResponseTrim.slimRef(schemaRef));

    assertTrue(
        after * 4 < before,
        "a slimmed reference must be a small fraction of the embedded object, got "
            + after
            + " vs "
            + before);
  }
}
