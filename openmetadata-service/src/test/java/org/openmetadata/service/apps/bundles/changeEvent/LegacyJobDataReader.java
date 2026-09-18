package org.openmetadata.service.apps.bundles.changeEvent;

import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.quartz.JobDataMap;

/**
 * How a server of the previous release reads a job's data, copied from that release's
 * AbstractEventConsumer (init, loadInitialOffset, loadPendingGapSince) under its own name. It pins
 * what this release may leave in job data while both releases share one Quartz cluster.
 */
final class LegacyJobDataReader {

  record WhatAnOlderServerSees(EventSubscription alert, Long cachedOffset, long gapSince) {
    /** Without a cached offset the previous release falls back to the position row. */
    boolean readsPositionFromTheRow() {
      return cachedOffset == null;
    }
  }

  private LegacyJobDataReader() {}

  /** Null when the previous release would refuse to run the job at all. */
  static WhatAnOlderServerSees read(JobDataMap jobData) {
    WhatAnOlderServerSees seen = null;
    if (jobData.get(AbstractEventConsumer.ALERT_INFO_KEY) instanceof String alertJson) {
      seen =
          new WhatAnOlderServerSees(
              JsonUtils.readValue(alertJson, EventSubscription.class),
              cachedOffset(jobData),
              gapSince(jobData));
    }
    return seen;
  }

  private static Long cachedOffset(JobDataMap jobData) {
    Long offset = null;
    if (jobData.get(AbstractEventConsumer.ALERT_OFFSET_KEY) instanceof String offsetJson) {
      offset = JsonUtils.readValue(offsetJson, EventSubscriptionOffset.class).getCurrentOffset();
    }
    return offset;
  }

  private static long gapSince(JobDataMap jobData) {
    Object value = jobData.get(AbstractEventConsumer.ALERT_PENDING_GAP_SINCE_KEY);
    return value instanceof String text && !text.isBlank() ? Long.parseLong(text) : 0L;
  }
}
