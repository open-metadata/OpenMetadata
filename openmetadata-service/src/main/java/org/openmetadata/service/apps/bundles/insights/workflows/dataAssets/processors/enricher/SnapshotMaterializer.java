/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

/**
 * Expands a {@link VersionedWindow} + its enriched entity map into one daily snapshot per day in
 * the window's range. Pure function — no I/O, no shared state.
 *
 * <p>Each daily snapshot is a deep-copy-of-the-enriched-map plus a per-day {@link
 * org.openmetadata.service.workflows.searchIndex.ReindexingUtil#TIMESTAMP_KEY @timestamp} field
 * at start-of-day. The input {@code enrichedMap} is not mutated.
 */
public final class SnapshotMaterializer {

  public List<Map<String, Object>> materialize(
      VersionedWindow window, Map<String, Object> enrichedMap) {
    List<Map<String, Object>> snapshots = new ArrayList<>();
    long pointer = window.windowEndTimestamp();
    while (pointer >= window.windowStartTimestamp()) {
      Map<String, Object> snapshot = new HashMap<>(enrichedMap);
      snapshot.put(TIMESTAMP_KEY, TimestampUtils.getStartOfDayTimestamp(pointer));
      snapshots.add(snapshot);
      pointer = TimestampUtils.subtractDays(pointer, 1);
    }
    return snapshots;
  }
}
