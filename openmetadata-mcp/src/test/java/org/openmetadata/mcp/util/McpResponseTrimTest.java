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
import static org.junit.jupiter.api.Assertions.assertFalse;
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

  @Test
  void summarizesAFourKilobyteSearchBackendFailure() {
    // Shape taken from a real failing search_metadata call: one status line, then a shard-failure
    // body that repeats the same null_pointer_exception once per shard.
    String shardFailure =
        "{\"shard\":0,\"index\":\"table_search_index_rebuild_1787425808482\","
            + "\"node\":\"BJKMp72iTySSK0CbcFTzFg\",\"reason\":{\"type\":\"null_pointer_exception\","
            + "\"reason\":null,\"suppressed\":[{\"type\":\"null_pointer_exception\",\"reason\":null},"
            + "{\"type\":\"null_pointer_exception\",\"reason\":null}]}},";
    String repeated = shardFailure.repeat(24);
    String raw =
        "method [POST], host [http://localhost:9200], URI [/dataAsset/_search], status line "
            + "[HTTP/1.1 500 Internal Server Error]\n"
            + "{\"error\":{\"root_cause\":["
            + repeated
            + "],\"type\":\"search_phase_execution_exception\",\"reason\":\"all shards failed\"}}";
    assertTrue(raw.length() > 1500, "fixture must be big enough to be worth summarising");

    String summary = McpResponseTrim.summarizeFailure(new RuntimeException(raw), true);

    assertTrue(
        summary.length() < raw.length() / 3,
        "a backend failure must not cost more context than a successful call: " + summary.length());
    assertTrue(summary.contains("null_pointer_exception"), "the cause is named once: " + summary);
    assertFalse(
        summary.contains("\"reason\":null},{\"type\""),
        "the per-shard repetition must not survive: " + summary);
    assertTrue(
        summary.contains("not a problem with the arguments"),
        "a 5xx must tell the caller retrying the same call will not help: " + summary);
  }

  @Test
  void leavesAShortActionableMessageAlone() {
    String actionable =
        "Parameter 'metricExpressionLanguage' is required and must be a non-blank string. "
            + "Valid values are: SQL, Java, JavaScript, Python, External. Received: null";

    String summary = McpResponseTrim.summarizeFailure(new RuntimeException(actionable), false);

    assertEquals(
        actionable,
        summary,
        "a 4xx that already names the field and its valid values is exactly what we want the model "
            + "to read - summarising it would remove the fix");
  }

  @Test
  void slimCertificationResolvesExpiryInsteadOfShippingEpochMillis() {
    long now = 1_756_000_000_000L;
    Map<String, Object> label = new LinkedHashMap<>();
    label.put("tagFQN", "Certification.Gold");
    label.put("state", "Confirmed");
    label.put("description", "Gold certified Data Asset.");
    label.put("iconURL", "GoldCertification.svg");
    Map<String, Object> certification = new LinkedHashMap<>();
    certification.put("tagLabel", label);
    certification.put("expiryDate", 1_785_312_839_519L);

    Object lapsed = McpResponseTrim.slimCertification(certification, 1_790_000_000_000L);
    assertEquals(
        "Certification.Gold (EXPIRED 2026-07-29)",
        lapsed,
        "a lapsed badge beside state=Confirmed reads as trustworthy unless expiry is resolved here");

    Object live = McpResponseTrim.slimCertification(certification, now);
    assertTrue(live.toString().startsWith("Certification.Gold (valid until "), live.toString());
  }

  @Test
  void slimCertificationKeepsTheLabelWhenThereIsNoExpiry() {
    Map<String, Object> certification =
        Map.of("tagLabel", Map.of("tagFQN", "Certification.Bronze"));
    String summary = McpResponseTrim.slimCertification(certification, 1L).toString();
    assertTrue(summary.startsWith("Certification.Bronze"), summary);
    assertTrue(
        summary.contains("not in this index") && summary.contains("get_entity_details"),
        "an un-indexed expiry must name the cause and where to resolve it - a bare label reads as "
            + "a live badge, and 'unknown' reads as 'no expiry set'. Both mislead: "
            + summary);
    assertEquals(
        "not-a-map",
        McpResponseTrim.slimCertification("not-a-map", 1L),
        "an unrecognised shape passes through rather than being emptied");
  }

  @Test
  void slimRefMarksAnInheritedOwnerSoItIsNotMistakenForASteward() {
    Map<String, Object> inherited = new LinkedHashMap<>();
    inherited.put("name", "admin");
    inherited.put("type", "user");
    inherited.put("inherited", true);

    assertEquals(
        "admin (inherited)",
        McpResponseTrim.slimRef(inherited),
        "an owner cascaded from the parent database is not who you talk to - collapsing it to a "
            + "bare name made it indistinguishable from a real steward");
  }

  @Test
  void slimRefLeavesADirectOwnerUnmarked() {
    Map<String, Object> direct = new LinkedHashMap<>();
    direct.put("name", "vishnu.jain");
    direct.put("type", "user");

    assertEquals(
        "vishnu.jain",
        McpResponseTrim.slimRef(direct),
        "a deliberately-assigned owner carries no qualifier");
    assertEquals(
        "sample_data.ecommerce_db",
        McpResponseTrim.slimRef(Map.of("fullyQualifiedName", "sample_data.ecommerce_db")),
        "a non-owner reference is unaffected");
  }
}
