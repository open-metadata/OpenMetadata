package org.openmetadata.service.events.scheduled;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * What one reconcile round did. Keys that name no alert are listed by the store they were read
 * from, as stored; the round left them alone.
 */
public record ReconcileRound(
    Outcome outcome, int alerts, int repaired, int failed, Map<String, List<String>> foreignKeys) {

  public static final String ALERTS = "alerts";
  public static final String JOBS = "jobs";
  public static final String LEDGER = "ledger";
  static final List<String> STORES = List.of(ALERTS, JOBS, LEDGER);

  public enum Outcome {
    COMPLETED,
    // Some alerts could not be reconciled; the others were.
    PARTIAL;

    public String tag() {
      return name().toLowerCase(Locale.ROOT);
    }
  }

  public int foreignKeyCount() {
    return foreignKeys.values().stream().mapToInt(List::size).sum();
  }
}
