package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataInsightsExtension.RunContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataInsightsExtension.Session;

class DataInsightsExtensionsTest {
  private static final RunContext CONTEXT = new RunContext("run", 2000, 1000, null, null, null);

  @Test
  void batchPreparationPrecedesEnrichmentAndCancellationStopsCompletion() {
    var cancelled = new java.util.concurrent.atomic.AtomicBoolean();
    var context = new RunContext("run", 2000, 1000, null, null, null, cancelled::get);
    List<String> calls = new ArrayList<>();
    DataInsightsExtension extension =
        ignored ->
            new Session() {
              @Override
              public void beforeBatch(
                  List<? extends org.openmetadata.schema.EntityInterface> entities) {
                calls.add("batch");
              }

              @Override
              public void enrich(Map<String, Object> snapshot) {
                calls.add("asset");
              }

              @Override
              public void complete() {
                calls.add("complete");
              }
            };
    try (var run = DataInsightsExtensions.open(context, List.of(extension))) {
      run.beforeBatch(List.of());
      run.enrich(new HashMap<>());
      cancelled.set(true);
      assertThrows(CancellationException.class, run::complete);
      assertThrows(CancellationException.class, () -> run.enrich(new HashMap<>()));
      assertEquals(List.of("batch", "asset"), calls);
    }
  }

  @Test
  void startupAndCleanupFailuresAreBothPreserved() {
    DataInsightsExtension opened =
        context ->
            new Session() {
              @Override
              public void close() {
                throw new IllegalStateException("close");
              }
            };
    DataInsightsExtension failed =
        context -> {
          throw new IllegalArgumentException("open");
        };
    var error =
        assertThrows(
            IllegalArgumentException.class,
            () -> DataInsightsExtensions.open(CONTEXT, List.of(opened, failed)));
    assertEquals("open", error.getMessage());
    assertEquals("close", error.getSuppressed()[0].getMessage());
  }

  @Test
  void nullSessionFailsFastWithProviderName() {
    var error =
        assertThrows(
            IllegalStateException.class,
            () -> DataInsightsExtensions.open(CONTEXT, List.of(new NullSessionExtension())));

    assertTrue(error.getMessage().contains(NullSessionExtension.class.getName()));
  }

  @Test
  void snapshotsCarryOneRunIdentityAndCompletionIsExplicit() {
    List<String> events = new ArrayList<>();
    DataInsightsExtension extension =
        context ->
            new Session() {
              @Override
              public void enrich(Map<String, Object> snapshot) {
                events.add("enriched");
              }

              @Override
              public void complete() {
                events.add("completed");
              }

              @Override
              public void close() {
                events.add("closed");
              }
            };
    var snapshot = new HashMap<String, Object>();
    try (var run = DataInsightsExtensions.open(CONTEXT, List.of(extension))) {
      run.enrich(snapshot);
      assertEquals(List.of("enriched"), events);
      run.complete();
    }

    assertEquals("run", snapshot.get(DataInsightsExtensions.RUN_ID));
    assertEquals(2000L, snapshot.get(DataInsightsExtensions.CAPTURED_AT));
    assertEquals(List.of("enriched", "completed", "closed"), events);
  }

  @Test
  void failedStartupClosesAlreadyOpenedSessions() {
    List<String> events = new ArrayList<>();
    DataInsightsExtension opened = context -> closingSession(events, "first");
    DataInsightsExtension failed =
        context -> {
          throw new IllegalStateException("source failed");
        };

    assertThrows(
        IllegalStateException.class,
        () -> DataInsightsExtensions.open(CONTEXT, List.of(opened, failed)));
    assertEquals(List.of("first"), events);
  }

  @Test
  void failureToCloseOneSessionDoesNotLeakAnother() {
    List<String> events = new ArrayList<>();
    DataInsightsExtension opened = context -> closingSession(events, "first");
    DataInsightsExtension failed =
        context ->
            new Session() {
              @Override
              public void close() {
                throw new IllegalStateException("cleanup failed");
              }
            };
    var run = DataInsightsExtensions.open(CONTEXT, List.of(opened, failed));

    assertThrows(IllegalStateException.class, run::close);
    assertEquals(List.of("first"), events);
  }

  private static Session closingSession(List<String> events, String event) {
    return new Session() {
      @Override
      public void close() {
        events.add(event);
      }
    };
  }

  private static final class NullSessionExtension implements DataInsightsExtension {
    @Override
    public Session open(RunContext context) {
      return null;
    }
  }
}
