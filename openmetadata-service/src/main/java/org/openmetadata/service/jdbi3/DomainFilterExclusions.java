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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Set;
import org.openmetadata.service.Entity;

/**
 * Entity types the global (navbar) domain filter must NOT narrow, even though they support domains.
 *
 * <p>Whether the filter applies is driven by the intrinsic {@link
 * EntityRepository#isSupportsDomains()} flag (so new domain-scoped entities are covered
 * automatically, with nothing to maintain here). This small denylist is the exception: these types
 * support domains, but their lists double as reference / administration surfaces — Settings members
 * and teams, permission resolution, and the tag/classification pickers on every entity page — that
 * must return their full contents regardless of the selected domain. Narrowing them with the strict
 * domain-membership condition would empty those surfaces.
 *
 * <p>The applies-to rule is therefore {@code supportsDomains && !isExcluded(entityType)}, composed
 * at the list injection point where {@code supportsDomains} is known.
 */
public final class DomainFilterExclusions {
  private DomainFilterExclusions() {}

  private static final Set<String> EXCLUDED =
      Set.of(Entity.USER, Entity.TEAM, Entity.TAG, Entity.CLASSIFICATION);

  /** True when the global domain filter must never narrow lists of the given entity type. */
  public static boolean isExcluded(String entityType) {
    return !nullOrEmpty(entityType) && EXCLUDED.contains(entityType);
  }
}
