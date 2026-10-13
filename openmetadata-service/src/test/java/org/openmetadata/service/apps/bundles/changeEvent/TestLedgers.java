package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;

/** Ledgers for unit tests: opened from rows held in memory, so no database is needed to open. */
final class TestLedgers {
  static final String POSITION_JSON = "{\"currentOffset\":7,\"startingOffset\":7,\"timestamp\":1}";

  private TestLedgers() {}

  static AlertLedger fresh() {
    return fresh(UUID.randomUUID());
  }

  static AlertLedger fresh(UUID alertId) {
    EventSubscription alert = new EventSubscription().withId(alertId);
    return new AlertLedger(alert, Map.of(LedgerKeys.POSITION, POSITION_JSON));
  }
}
