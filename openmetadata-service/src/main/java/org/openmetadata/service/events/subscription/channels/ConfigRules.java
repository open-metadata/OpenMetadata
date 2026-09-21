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

package org.openmetadata.service.events.subscription.channels;

import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/** What a channel expects of a destination's configuration. */
public interface ConfigRules {
  /** Throws a 400 naming what is wrong. */
  void validate(SubscriptionDestination destination);

  /** The configured receivers, or null for a channel that has none. */
  SubscriptionAction receiversOf(SubscriptionDestination destination);

  /** Encrypts, in place, whatever the configuration holds that must not be stored in the clear. */
  default void encryptSecrets(SubscriptionDestination destination) {}
}
