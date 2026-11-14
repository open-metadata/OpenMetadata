/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

class TestCaseSnapshotEnrichmentTest {
  private static final long DAY = 1794528000000L;

  @Test
  void unchangedDefinitionsAreCapturedOnTheCollectionDay() throws Exception {
    final TestCase definition = definition("<#E::table::service.db.schema.table>");
    final Map<String, Object> snapshot =
        capture(
            definition,
            DAY + 1000,
            List.of("id", "updatedAt", "testDefinition", "entityLink"),
            UUID.randomUUID());
    assertEquals(DAY, snapshot.get("@timestamp"));
    assertEquals(TimestampUtils.subtractDays(DAY, 90), snapshot.get("updatedAt"));
    assertEquals("service.db.schema.table", snapshot.get("originEntityFQN"));
    assertFalse(snapshot.containsKey("testCaseResult"));
    assertEquals("testCase", snapshot.get("entityType"));
    assertEquals(1, snapshot.get("hasDescription"), "shared enrichment must run");
  }

  @Test
  void columnTestsKeepTheirParentTableAndQuotedService() throws Exception {
    final Map<String, Object> snapshot =
        capture(
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

  @Test
  void aDefinitionUpdatedTodayUsesTheHydratedStateWithoutReconstructingHistory() throws Exception {
    final Map<String, Object> snapshot =
        capture(
            definition("<#E::table::service.db.schema.table>").withUpdatedAt(DAY + 500),
            DAY + 1000,
            List.of("id", "description", "updatedAt"),
            UUID.randomUUID());
    assertEquals(DAY, snapshot.get("@timestamp"));
    assertEquals(DAY + 500, snapshot.get("updatedAt"));
    assertEquals(1, snapshot.get("hasDescription"));
  }

  @Test
  void aMissingParentFailsInsteadOfPublishingIncompleteCoverage() {
    assertThrows(
        SearchIndexException.class,
        () ->
            capture(definition("<#E::table::service.db.schema.table>"), DAY, List.of("id"), null));
  }

  private static Map<String, Object> capture(
      TestCase testCase, long timestamp, List<String> fields, UUID tableId) throws Exception {
    final String tableFqn = EntityLink.parse(testCase.getEntityLink()).getEntityFQN();
    final Map<String, Object> context =
        Map.of(
            "entityType",
            "testCase",
            ENTITY_TYPE_FIELDS_KEY,
            fields,
            "startTimestamp",
            TimestampUtils.subtractDays(DAY, 30),
            "endTimestamp",
            TimestampUtils.getEndOfDayTimestamp(DAY),
            "snapshotTimestamp",
            timestamp,
            "parentTableIds",
            tableId == null ? Map.of() : Map.of(tableFqn, tableId));
    final List<Map<String, Object>> snapshots =
        new DataInsightsEntityEnricherProcessor(1).enrichSingle(testCase, context);
    assertEquals(1, snapshots.size(), "capture must not manufacture prior days");
    if (tableId != null) {
      assertEquals(tableId.toString(), snapshots.getFirst().get("originEntityId"));
    }
    return snapshots.getFirst();
  }

  private static TestCase definition(String entityLink) {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("old_test")
        .withDescription("Checks the table")
        .withEntityLink(entityLink)
        .withUpdatedAt(TimestampUtils.subtractDays(DAY, 90))
        .withTestDefinition(new EntityReference().withName("rows"));
  }
}
