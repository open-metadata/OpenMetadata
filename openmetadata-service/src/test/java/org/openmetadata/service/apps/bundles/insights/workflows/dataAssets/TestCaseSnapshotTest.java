package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

class TestCaseSnapshotTest {
  private static final long DAY = 1794528000000L;

  @Test
  void unchangedDefinitionsAreCapturedOnTheCollectionDay() {
    final TestCase definition = definition("<#E::table::service.db.schema.table>");
    final Map<String, Object> snapshot =
        TestCaseSnapshot.capture(
            definition,
            DAY + 1000,
            List.of("id", "updatedAt", "testDefinition", "entityLink"),
            UUID.randomUUID());
    assertEquals(DAY, snapshot.get("@timestamp"));
    assertEquals(TimestampUtils.subtractDays(DAY, 90), snapshot.get("updatedAt"));
    assertEquals("service.db.schema.table", snapshot.get("originEntityFQN"));
    assertFalse(snapshot.containsKey("testCaseResult"));
  }

  @Test
  void columnTestsKeepTheirParentTableAndQuotedService() {
    final Map<String, Object> snapshot =
        TestCaseSnapshot.capture(
            definition("<#E::table::\"service.with.dot\".db.schema.table::columns::id>"),
            DAY,
            List.of("id", "testDefinition"),
            UUID.randomUUID());
    assertEquals("\"service.with.dot\".db.schema.table", snapshot.get("originEntityFQN"));
    assertEquals(
        Map.of("name", "service.with.dot", "fullyQualifiedName", "\"service.with.dot\""),
        snapshot.get("service"));
    assertEquals("rows", ((Map<?, ?>) snapshot.get("testDefinition")).get("name"));
  }

  private static TestCase definition(String entityLink) {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("old_test")
        .withEntityLink(entityLink)
        .withUpdatedAt(TimestampUtils.subtractDays(DAY, 90))
        .withTestDefinition(new EntityReference().withName("rows"));
  }
}
