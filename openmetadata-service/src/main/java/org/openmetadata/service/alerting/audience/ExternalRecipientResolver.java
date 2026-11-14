/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.alerting.audience;

import java.util.UUID;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;

/**
 * Resolves the recipients an External destination names itself: its receivers are already the
 * addresses (email addresses or webhook URLs) and depend on no entity.
 */
public class ExternalRecipientResolver implements RecipientResolutionStrategy {

  @Override
  public Recipients resolve(
      ChangeEvent event,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory) {
    return configured(action, destination, directory);
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory) {
    return configured(action, destination, directory);
  }

  private static Recipients configured(
      SubscriptionAction action, SubscriptionDestination destination, AddressDirectory directory) {
    return Recipients.from(
        Lookup.of(
            "the receivers of destination " + destination.getId(),
            () -> directory.configured(action, destination)),
        Recipients::of);
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.EXTERNAL;
  }
}
