package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.concurrent.Executor;

/** How a bulk sink batches and sends, how it retries, and where it builds its documents. */
record BulkSinkOptions(
    int batchSize,
    int maxConcurrentRequests,
    long maxPayloadSizeBytes,
    BulkRetryPolicy retryPolicy,
    Executor docBuildExecutor) {}
