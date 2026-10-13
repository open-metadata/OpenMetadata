package org.openmetadata.service.events.subscription.ledger;

import java.util.List;

/** The keys of `change_event_consumers` that only the ledger writes. */
public final class LedgerKeys {
  public static final String POSITION = "eventSubscription.Offset";
  public static final String COUNTERS = "eventSubscription.metrics";
  public static final String GAP_WAIT = "eventSubscription.gap";
  public static final String HEALTH = "eventSubscription.health";
  public static final String IN_PROGRESS = "eventSubscription.inProgress";

  static final String POSITION_SCHEMA = "eventSubscriptionOffset";
  static final String COUNTERS_SCHEMA = "alertMetrics";
  static final String GAP_WAIT_SCHEMA = "alertGapWait";
  static final String HEALTH_SCHEMA = "alertHealth";
  static final String IN_PROGRESS_SCHEMA = "alertEventInProgress";

  private LedgerKeys() {}

  public static List<String> all() {
    return List.of(POSITION, COUNTERS, GAP_WAIT, HEALTH, IN_PROGRESS);
  }
}
