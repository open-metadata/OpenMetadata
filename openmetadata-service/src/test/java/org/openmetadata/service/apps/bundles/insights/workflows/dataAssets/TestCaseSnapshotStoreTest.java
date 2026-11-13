package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.search.SearchClient;

class TestCaseSnapshotStoreTest {
  @Test
  void historicalCountsUseTheirOwnDayAndUnknownHistoryIsNotZero() {
    final TestCaseSnapshotStore.Coverage coverage =
        new TestCaseSnapshotStore.Coverage(
            Map.of(
                new TestCaseSnapshotStore.TableDay("table-id", 0), 2L,
                new TestCaseSnapshotStore.TableDay("table-id", 86400000), 0L));
    final Map<String, Object> first = snapshot(0);
    final Map<String, Object> second = snapshot(86400000);
    final Map<String, Object> unknown = snapshot(-86400000);
    coverage.enrich(first);
    coverage.enrich(second);
    coverage.enrich(unknown);
    assertEquals(2L, first.get("testCaseCount"));
    assertEquals(1, first.get("hasTestCases"));
    assertEquals(0L, second.get("testCaseCount"));
    assertEquals(0, second.get("hasTestCases"));
    assertFalse(unknown.containsKey("testCaseCount"));
    assertFalse(unknown.containsKey("hasTestCases"));
  }

  @Test
  void unavailableCheckpointStoreFailsInsteadOfReportingNoTests() throws IOException {
    final SearchClient client = mock(SearchClient.class);
    when(client.rawSearchRequest(any(), any(), any()))
        .thenReturn(new SearchClient.RawSearchResponse(503, "unavailable"));
    final TestCaseSnapshotStore store = new TestCaseSnapshotStore(client, "");
    assertThrows(IOException.class, () -> store.loadCoverage(List.of(table()), 0, 1));
  }

  @Test
  void deploymentsWithoutCheckpointsLeaveCoverageUnknown() throws IOException {
    final SearchClient client = mock(SearchClient.class);
    when(client.rawSearchRequest(any(), any(), any()))
        .thenReturn(new SearchClient.RawSearchResponse(404, "missing"));
    final TestCaseSnapshotStore store = new TestCaseSnapshotStore(client, "");
    assertEquals(Map.of(), store.loadCoverage(List.of(table()), 0, 1).counts());
  }

  private static Map<String, Object> snapshot(long day) {
    return new HashMap<>(
        Map.of(
            "id",
            "table-id",
            "fullyQualifiedName",
            "Service.db.schema.RenamedTable",
            "@timestamp",
            day));
  }

  private static Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withFullyQualifiedName("Service.db.schema.Table")
        .withService(new EntityReference().withName("Service"));
  }
}
