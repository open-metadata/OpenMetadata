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
package org.openmetadata.service.search.projection;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Compares a stored search document against a freshly projected one and names the paths that differ.
 *
 * <p>Top-level granularity, deliberately: that is the unit a write replaces, and it is the label the
 * drift metric carries. A deeper diff would report paths no writer can address individually.
 *
 * <p>Two rules keep the signal meaningful, and both exist because the alternative is a detector that
 * cries constantly and gets muted:
 *
 * <ul>
 *   <li><b>Absent, null and empty are equivalent.</b> One side omitting a field while the other stores
 *       {@code null}, {@code []} or <code>{}</code> is not drift a user can see. The two write paths
 *       genuinely disagree about materialising empty collections, in both directions.
 *   <li><b>Paths outside the projector's authority are skipped.</b> {@code embedding} and the fenced
 *       relationship fields are not reconstructible from the entity, so a projection will always
 *       "differ" from what is stored. Reporting that as drift would bury the real findings.
 * </ul>
 */
public final class DocumentDrift {

  private DocumentDrift() {}

  /**
   * Top-level paths where {@code stored} and {@code projected} disagree.
   *
   * @param authority ownerships the projector could legitimately reconstruct; anything else is skipped
   */
  public static Set<String> paths(
      Map<String, Object> stored,
      Map<String, Object> projected,
      ProjectionSpec spec,
      Set<FieldOwnership> authority) {
    Set<String> drifted = new LinkedHashSet<>();
    Set<String> candidates = new LinkedHashSet<>(projected.keySet());
    candidates.addAll(stored.keySet());
    for (String path : candidates) {
      if (!authority.contains(spec.ownershipOf(path))) {
        continue;
      }
      if (!equivalent(stored.get(path), projected.get(path))) {
        drifted.add(path);
      }
    }
    return drifted;
  }

  private static boolean equivalent(Object storedValue, Object projectedValue) {
    if (isAbsent(storedValue) && isAbsent(projectedValue)) {
      return true;
    }
    return Objects.equals(storedValue, projectedValue);
  }

  private static boolean isAbsent(Object value) {
    if (value == null) {
      return true;
    }
    if (value instanceof Collection<?> collection) {
      return collection.isEmpty();
    }
    if (value instanceof Map<?, ?> map) {
      return map.isEmpty();
    }
    return false;
  }
}
