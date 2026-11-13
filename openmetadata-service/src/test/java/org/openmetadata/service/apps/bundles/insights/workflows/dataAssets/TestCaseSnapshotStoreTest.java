package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
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

  @Test
  void failedCheckpointInvalidationPreservesSnapshotsDuringRecreation() throws IOException {
    final AtomicBoolean snapshotsExist = new AtomicBoolean(true);
    final SearchClient client = mock(SearchClient.class);
    when(client.rawSearchRequest(any(), any(), any()))
        .thenAnswer(
            call -> {
              final String path = call.getArgument(1);
              if (path.contains("checkpoints/_delete_by_query")) {
                return new SearchClient.RawSearchResponse(503, "unavailable");
              }
              if (path.startsWith("/_data_stream/")) {
                snapshotsExist.set(false);
              }
              return new SearchClient.RawSearchResponse(200, "{}");
            });
    assertThrows(IOException.class, () -> new TestCaseSnapshotStore(client, "").deleteSnapshots());
    assertTrue(snapshotsExist.get(), "Failed invalidation must leave certified history intact");
  }

  @Test
  void recreationClearsCheckpointsEvenWhenTheStreamIsAlreadyMissing() throws IOException {
    final AtomicBoolean checkpointExists = new AtomicBoolean(true);
    final SearchClient client = mock(SearchClient.class);
    when(client.rawSearchRequest(any(), any(), any()))
        .thenAnswer(
            call -> {
              final String path = call.getArgument(1);
              if (path.contains("checkpoints/_delete_by_query")) {
                checkpointExists.set(false);
              }
              return new SearchClient.RawSearchResponse(
                  path.startsWith("/_data_stream/") ? 404 : 200, "{}");
            });
    new TestCaseSnapshotStore(client, "").deleteSnapshots();
    assertFalse(checkpointExists.get());
  }

  @Test
  void failedRetentionInvalidationPreservesHistoricalSnapshots() throws IOException {
    final AtomicBoolean historyExists = new AtomicBoolean(true);
    final SearchClient client = mock(SearchClient.class);
    when(client.rawSearchRequest(any(), any(), any()))
        .thenAnswer(
            call -> {
              final String path = call.getArgument(1);
              final String body = call.getArgument(2);
              if (body != null && JsonUtils.readTree(body).path("query").has("range")) {
                if (path.contains("checkpoints")) {
                  return new SearchClient.RawSearchResponse(503, "unavailable");
                }
                historyExists.set(false);
              }
              return new SearchClient.RawSearchResponse(200, "{}");
            });
    assertThrows(
        IOException.class,
        () -> new TestCaseSnapshotStore(client, "").beginCapture(86400000L, null, 0));
    assertTrue(historyExists.get(), "Expired snapshots must outlive their completion checkpoints");
  }

  @Test
  void aFailedRefreshCannotPublishACompletionCheckpoint() throws IOException {
    final AtomicBoolean checkpointExists = new AtomicBoolean(false);
    final SearchClient client = mock(SearchClient.class);
    when(client.rawSearchRequest(any(), any(), any()))
        .thenAnswer(
            call -> {
              final String path = call.getArgument(1);
              if (path.endsWith("/_refresh")) {
                return new SearchClient.RawSearchResponse(200, "{\"_shards\":{\"failed\":1}}");
              }
              checkpointExists.set(true);
              return new SearchClient.RawSearchResponse(201, "{}");
            });
    assertThrows(
        IOException.class, () -> new TestCaseSnapshotStore(client, "").completeCapture(0, null));
    assertFalse(checkpointExists.get());
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
