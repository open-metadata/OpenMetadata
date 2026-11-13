package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.FullyQualifiedName;

/** A captured definition, independent of its last edit or result timestamp. */
public final class TestCaseSnapshot {
  private TestCaseSnapshot() {}

  public static Map<String, Object> capture(
      TestCase testCase, long timestamp, List<String> fields, UUID tableId) {
    final Map<String, Object> snapshot = new HashMap<>(JsonUtils.getMap(testCase));
    snapshot.keySet().retainAll(fields);
    final String tableFqn = EntityLink.parse(testCase.getEntityLink()).getEntityFQN();
    final String serviceFqn = FullyQualifiedName.getRoot(tableFqn);
    snapshot.put("entityType", Entity.TEST_CASE);
    snapshot.put("originEntityFQN", tableFqn);
    snapshot.put(
        "originEntityId",
        Objects.requireNonNull(tableId, "Snapshot parent table no longer exists").toString());
    snapshot.put(
        "service",
        Map.of(
            "name", FullyQualifiedName.unquoteName(serviceFqn), "fullyQualifiedName", serviceFqn));
    snapshot.put("@timestamp", TimestampUtils.getStartOfDayTimestamp(timestamp));
    return snapshot;
  }
}
