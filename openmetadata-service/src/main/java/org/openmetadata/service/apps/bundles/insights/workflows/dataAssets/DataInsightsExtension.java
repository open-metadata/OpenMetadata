package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import java.util.List;
import java.util.Map;
import java.util.function.BooleanSupplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

/** Run-scoped additions to DI snapshots and consumers of a successfully indexed DI run. */
public interface DataInsightsExtension {
  Session open(RunContext context);

  record RunContext(
      String runId,
      long capturedAt,
      long snapshotTimestamp,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      DataAssetsConfig configuration,
      BooleanSupplier cancelled) {
    public RunContext(
        String runId,
        long capturedAt,
        long snapshotTimestamp,
        CollectionDAO collectionDAO,
        SearchRepository searchRepository,
        DataAssetsConfig configuration) {
      this(
          runId,
          capturedAt,
          snapshotTimestamp,
          collectionDAO,
          searchRepository,
          configuration,
          () -> false);
    }

    public void requireActive() {
      if (cancelled.getAsBoolean() || Thread.currentThread().isInterrupted()) {
        throw new IllegalStateException(
            "Data Insights run was cancelled or lost its execution lease");
      }
    }
  }

  /** Enrichment can run concurrently; completion runs once, while the DI job still owns its lease. */
  interface Session extends AutoCloseable {
    /** Allows bounded bulk lookups before the batch's concurrent enrichment starts. */
    default void beforeBatch(List<? extends EntityInterface> entities) {}

    default void enrich(Map<String, Object> snapshot) {}

    default void complete() {}

    @Override
    default void close() {}
  }
}
