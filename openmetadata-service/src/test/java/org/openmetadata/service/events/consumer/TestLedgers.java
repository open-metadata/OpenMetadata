package org.openmetadata.service.events.consumer;

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.consumer.ledger.AlertLedger;
import org.openmetadata.service.events.consumer.ledger.LedgerKeys;

/** Ledgers for unit tests: opened from rows held in memory, so no database is needed to open. */
public final class TestLedgers {
  public static final String POSITION_JSON =
      "{\"currentOffset\":7,\"startingOffset\":7,\"timestamp\":1}";

  private TestLedgers() {}

  public static AlertLedger fresh() {
    return fresh(UUID.randomUUID());
  }

  public static AlertLedger fresh(UUID alertId) {
    EventSubscription alert = new EventSubscription().withId(alertId);
    return new AlertLedger(alert, Map.of(LedgerKeys.POSITION, POSITION_JSON));
  }
}
