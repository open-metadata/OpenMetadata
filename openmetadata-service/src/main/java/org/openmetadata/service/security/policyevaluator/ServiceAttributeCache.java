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

package org.openmetadata.service.security.policyevaluator;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * Request-scoped memo of the service attributes the {@code matchAnyService*} conditions read.
 *
 * <p>{@link ResourceContextInterface} is an interface, so its default accessors cannot memoize on
 * the instance the way {@link ResourceContext} and {@link CreateResourceContext} do. Without a memo
 * each of {@code getServiceTags()}, {@code getServiceType()} and {@code getServiceEnvironment()}
 * re-resolves the service, once per condition per operation per entity — and while {@code
 * RequestEntityCache} spares the database round trip, it stores JSON and deserializes on every hit,
 * so each call still parses a whole service entity including its {@code connection} blob. Over a
 * bulk authorization that is thousands of parses of a handful of distinct services.
 *
 * <p>Keyed by service id rather than by context, so contexts in the same request share the answer.
 * Bounded at {@value MAX_ENTRIES_PER_REQUEST} entries as CLAUDE.md requires, and cleared with the
 * other per-request ThreadLocals by {@code PerRequestContextCleaner}.
 */
public final class ServiceAttributeCache {

  /**
   * One entry per distinct service touched by a request. A request spans far fewer services than
   * entities, so this is comfortable; LRU eviction keeps it bounded if a bulk request spans more.
   */
  private static final int MAX_ENTRIES_PER_REQUEST = 50;

  private static final int INITIAL_CAPACITY = 16;
  private static final float LOAD_FACTOR = 0.75f;
  private static final boolean ACCESS_ORDER = true;

  /** Answer for a resource with no service, and for a service that no longer resolves. */
  static final ServiceAttributes NONE = new ServiceAttributes(Collections.emptyList(), null, null);

  private static final ThreadLocal<Map<UUID, ServiceAttributes>> CACHE =
      ThreadLocal.withInitial(
          () ->
              new LinkedHashMap<>(INITIAL_CAPACITY, LOAD_FACTOR, ACCESS_ORDER) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<UUID, ServiceAttributes> eldest) {
                  return size() > MAX_ENTRIES_PER_REQUEST;
                }
              });

  private ServiceAttributeCache() {}

  /** The three attributes a policy condition can read off a service. */
  record ServiceAttributes(List<TagLabel> tags, String serviceType, String environment) {}

  /**
   * Attributes of {@code serviceReference}, resolved once per service per request. A reference with
   * no id is not cached — there is no key to cache it under — but that is the legacy-row case, not
   * the hot path.
   */
  static ServiceAttributes resolve(EntityReference serviceReference) {
    if (serviceReference == null) {
      return NONE;
    }
    if (serviceReference.getId() == null) {
      return load(serviceReference);
    }
    return CACHE.get().computeIfAbsent(serviceReference.getId(), id -> load(serviceReference));
  }

  /**
   * {@code getEntityOrNull} so a service deleted mid-request does not raise from inside the
   * authorization decision; it simply stops matching the condition.
   */
  private static ServiceAttributes load(EntityReference serviceReference) {
    EntityInterface service =
        Entity.getEntityOrNull(serviceReference, Entity.FIELD_TAGS, Include.ALL);
    if (service == null) {
      return NONE;
    }
    return new ServiceAttributes(
        Entity.getEntityTags(service.getEntityReference().getType(), service),
        ServiceAttributeUtil.serviceTypeOf(service),
        ServiceAttributeUtil.environmentOf(service));
  }

  /** Drops the memo at the end of a request, alongside the other per-request ThreadLocals. */
  public static void clear() {
    CACHE.remove();
  }
}
