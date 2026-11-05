package org.openmetadata.service.apps.bundles.searchIndex;

/** How a bulk processor batches and sends: flush thresholds, concurrency and retries. */
record BulkProcessorSettings(
    int bulkActions,
    long maxPayloadSizeBytes,
    int concurrentRequests,
    long flushIntervalMillis,
    BulkRetryPolicy retryPolicy) {}
