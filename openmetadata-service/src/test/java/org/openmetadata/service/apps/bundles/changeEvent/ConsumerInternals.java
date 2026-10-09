/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.changeEvent;

import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.quartz.JobExecutionContext;

/**
 * What a test of a consumer reaches inside the runtime it runs on: its alert, its ledger, what it
 * records and one tick. The runtime keeps these to itself and its subclasses, so tests of a consumer that lives in
 * another package go through here.
 */
public final class ConsumerInternals {
  private ConsumerInternals() {}

  public static void subscribe(AbstractEventConsumer consumer, EventSubscription alert) {
    consumer.eventSubscription = alert;
  }

  public static AlertLedger ledgerOf(AbstractEventConsumer consumer) {
    return consumer.ledger;
  }

  public static void useLedger(AbstractEventConsumer consumer, AlertLedger ledger) {
    consumer.ledger = ledger;
  }

  public static void tick(
      AbstractEventConsumer consumer,
      EventSubscription alert,
      AlertLedger ledger,
      JobExecutionContext context) {
    consumer.tick(alert, ledger, context);
  }

  public static void recordDelivery(AbstractEventConsumer consumer, int delivered, int failed) {
    consumer.recordDelivery(delivered, failed);
  }

  public static void recordFailure(AbstractEventConsumer consumer, String reason) {
    consumer.recordFailure(reason);
  }
}
