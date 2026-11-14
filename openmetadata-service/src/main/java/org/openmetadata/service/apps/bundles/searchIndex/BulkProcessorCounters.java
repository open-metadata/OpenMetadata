package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.concurrent.atomic.AtomicLong;

/** The sink-owned counters a bulk processor updates, and the hook it calls after each update. */
record BulkProcessorCounters(
    AtomicLong submitted,
    AtomicLong success,
    AtomicLong failed,
    AtomicLong warnings,
    Runnable onUpdate) {}
