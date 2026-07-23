/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.capability;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Process-global registry of {@link EntityIndexCapability} keyed by entity type. Populated by
 * {@code Entity.registerEntity(...)} at startup; consumers (typed scripts, validators) read it
 * thereafter. Returns {@code null} for unknown types so callers can decide whether to fail-soft
 * or fail-hard.
 */
public final class EntityIndexCapabilityRegistry {

  private static final Map<String, EntityIndexCapability> CAPABILITIES = new ConcurrentHashMap<>();

  private EntityIndexCapabilityRegistry() {}

  public static void register(EntityIndexCapability capability) {
    CAPABILITIES.put(capability.entityType(), capability);
  }

  public static EntityIndexCapability get(String entityType) {
    if (entityType == null) {
      return null;
    }
    return CAPABILITIES.get(entityType);
  }

  public static Collection<EntityIndexCapability> all() {
    return Collections.unmodifiableCollection(CAPABILITIES.values());
  }

  public static void clear() {
    CAPABILITIES.clear();
  }
}
