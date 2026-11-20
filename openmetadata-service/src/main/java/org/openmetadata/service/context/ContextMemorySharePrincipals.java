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

package org.openmetadata.service.context;

import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;

/** Lets a distribution extend the principals supported by context memory sharing. */
public interface ContextMemorySharePrincipals {

  /** Whether this resolved, live share target passes the distribution's validation. */
  default boolean validateAdditionalTarget(EntityReference target) {
    return false;
  }

  /** Additional sharing principal IDs the caller currently belongs to. */
  default Set<UUID> additionalPrincipalIds(User user) {
    return Set.of();
  }

  static ContextMemorySharePrincipals get() {
    return Registry.active;
  }

  /** Registers the distribution's provider at startup. Passing null restores the default. */
  static void set(ContextMemorySharePrincipals provider) {
    Registry.active = provider == null ? Registry.DEFAULT : provider;
  }

  final class Registry {
    private static final ContextMemorySharePrincipals DEFAULT =
        new ContextMemorySharePrincipals() {};
    private static volatile ContextMemorySharePrincipals active = DEFAULT;

    private Registry() {}
  }
}
