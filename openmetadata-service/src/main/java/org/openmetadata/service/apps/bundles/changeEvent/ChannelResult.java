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

import java.util.UUID;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.ledger.DestinationOutcome;
import org.openmetadata.service.exception.CatalogExceptionMessage;

/**
 * What one channel did with one event. A channel that could not try, or found nobody to send to,
 * failed it: nothing went out.
 */
sealed interface ChannelResult {

  ChannelResult DELIVERED = new Delivered();

  record Delivered() implements ChannelResult {}

  record Failed(Delivery.Failure failure) implements ChannelResult {

    static Failed of(EventPublisherException failure) {
      UUID destinationId =
          failure.getChangeEventWithSubscription() == null
              ? null
              : failure.getChangeEventWithSubscription().getLeft();
      return new Failed(new Delivery.Failure(destinationId, failure.getMessage()));
    }

    /** Nothing went out, and the reason says it was never tried. */
    static Failed notAttempted(SubscriptionDestination destination, String why) {
      return new Failed(
          new Delivery.Failure(
              destination.getId(),
              CatalogExceptionMessage.eventPublisherFailedToPublish(
                  destination.getType(), DestinationOutcome.notAttemptedReason(why))));
    }
  }
}
