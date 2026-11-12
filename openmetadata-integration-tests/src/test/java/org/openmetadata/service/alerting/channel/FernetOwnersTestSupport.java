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
package org.openmetadata.service.alerting.channel;

import java.util.UUID;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.secrets.SecretOwner;

/**
 * The owners a webhook secret is bound to, for integration tests that open stored bound ciphertext
 * on their own. The owner functions are package-private so that only the server code decides them.
 */
public final class FernetOwnersTestSupport {
  private FernetOwnersTestSupport() {}

  /** The owner of every secret of the stored alert destination with this id. */
  public static SecretOwner destinationOwner(UUID destinationId) {
    return DestinationSecrets.ownerOf(new SubscriptionDestination().withId(destinationId));
  }

  /** The owner of the secrets of one webhook slot, such as {@code generic}, on a profile. */
  public static SecretOwner profileOwner(String entityType, UUID holderId, String slot) {
    return new ProfileWebhookSecrets.Holder(entityType, holderId).ownerOf(slot);
  }
}
