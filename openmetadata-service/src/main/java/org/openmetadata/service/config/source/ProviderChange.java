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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.databind.JsonNode;

/** Whether the deployment and the stored setting name different identity providers, and why. */
enum ProviderChange {
  /** Both name the same provider. */
  NONE,
  /**
   * The stored setting names another provider than the deployment, because it was switched in the
   * UI or because the setting was never reconciled and nobody can tell which side is newer.
   */
  BY_STORED,
  /** The stored setting still names the provider applied last time: the deployment switched. */
  BY_DEPLOYMENT;

  static ProviderChange between(JsonNode deployment, JsonNode stored, JsonNode lastApplied) {
    ProviderChange change = NONE;
    if (!IdentityProviderIdentity.sameProvider(stored, deployment)) {
      change =
          lastApplied != null && IdentityProviderIdentity.sameProvider(stored, lastApplied)
              ? BY_DEPLOYMENT
              : BY_STORED;
    }
    return change;
  }
}
