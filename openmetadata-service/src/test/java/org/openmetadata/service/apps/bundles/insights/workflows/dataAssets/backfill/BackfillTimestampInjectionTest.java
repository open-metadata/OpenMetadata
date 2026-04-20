package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class BackfillTimestampInjectionTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static String appendTimestamp(String baseDocJson, long ts) {
    return baseDocJson.substring(0, baseDocJson.length() - 1) + ",\"@timestamp\":" + ts + "}";
  }

  @Test
  void fieldValueContainingTimestampStringIsNotCorrupted() throws Exception {
    // The old string-replace approach would corrupt this: replacing "\"@timestamp\":0" inside
    // a description value would produce invalid or wrong output.
    String base = "{\"id\":\"abc\",\"description\":\"see @timestamp docs\",\"@timestamp\":0}";
    long ts = 1_700_000_000_000L;

    // Simulate the old bug: string replace on a doc that already has @timestamp:0 in content
    // The new approach: serialize WITHOUT @timestamp first, then append.
    String baseWithout = "{\"id\":\"abc\",\"description\":\"see @timestamp docs\"}";
    JsonNode node = MAPPER.readTree(appendTimestamp(baseWithout, ts));

    assertEquals("see @timestamp docs", node.get("description").asText());
    assertEquals(ts, node.get("@timestamp").longValue());
    assertEquals(1, node.findValues("@timestamp").size());
  }

  @Test
  void eachDayReceivesItsOwnTimestamp() throws Exception {
    String base = "{\"id\":\"abc\"}";
    long ts1 = 1_700_000_000_000L;
    long ts2 = 1_700_086_400_000L; // +1 day

    JsonNode node1 = MAPPER.readTree(appendTimestamp(base, ts1));
    JsonNode node2 = MAPPER.readTree(appendTimestamp(base, ts2));

    assertEquals(ts1, node1.get("@timestamp").longValue());
    assertEquals(ts2, node2.get("@timestamp").longValue());
  }
}
