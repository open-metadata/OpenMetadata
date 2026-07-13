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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

/**
 * Pure-function tests for {@link SnapshotMaterializer}. The materializer takes a {@link
 * VersionedWindow} and the enriched map, emits one daily snapshot per day in the window's range,
 * and never mutates the input map. Day boundaries are honored by the existing {@code
 * TimestampUtils} helpers.
 */
class SnapshotMaterializerTest {

  private static final long MILLIS_PER_DAY = 86_400_000L;

  private final SnapshotMaterializer materializer = new SnapshotMaterializer();

  @Test
  void singleDayWindow_emitsOneSnapshot() {
    long today = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    long endOfToday = TimestampUtils.getEndOfDayTimestamp(today);
    VersionedWindow window =
        new VersionedWindow(stubEntity(), today, endOfToday, VersionShape.LATEST_HYDRATED);

    Map<String, Object> enriched = new HashMap<>();
    enriched.put("entityType", "table");
    enriched.put("hasDescription", 1);

    List<Map<String, Object>> snapshots = materializer.materialize(window, enriched);

    assertEquals(1, snapshots.size());
    Map<String, Object> snap = snapshots.get(0);
    assertEquals(today, snap.get(TIMESTAMP_KEY));
    assertEquals("table", snap.get("entityType"));
    assertEquals(1, snap.get("hasDescription"));
  }

  @Test
  void fiveDayWindow_emitsFiveSnapshotsOnePerDay() {
    long today = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    long endOfToday = TimestampUtils.getEndOfDayTimestamp(today);
    long fiveDaysAgo = TimestampUtils.subtractDays(today, 4); // inclusive => 5 days
    VersionedWindow window =
        new VersionedWindow(stubEntity(), fiveDaysAgo, endOfToday, VersionShape.LATEST_HYDRATED);

    Map<String, Object> enriched = new HashMap<>();
    enriched.put("entityType", "table");

    List<Map<String, Object>> snapshots = materializer.materialize(window, enriched);

    assertEquals(5, snapshots.size(), "one snapshot per day across the 5-day window");

    // Snapshots emitted newest-first; the per-day @timestamp should march backwards by 1 day.
    long expected = today;
    for (Map<String, Object> snap : snapshots) {
      assertEquals(expected, snap.get(TIMESTAMP_KEY));
      expected -= MILLIS_PER_DAY;
    }
  }

  @Test
  void inputMapIsNotMutated() {
    long today = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    VersionedWindow window =
        new VersionedWindow(
            stubEntity(),
            today,
            TimestampUtils.getEndOfDayTimestamp(today),
            VersionShape.LATEST_HYDRATED);

    Map<String, Object> enriched = new HashMap<>();
    enriched.put("entityType", "table");
    enriched.put("hasDescription", 1);

    materializer.materialize(window, enriched);

    // The original should be untouched — materializer copies into per-day snapshots.
    assertFalse(enriched.containsKey(TIMESTAMP_KEY), "original map not polluted with @timestamp");
    assertEquals(2, enriched.size(), "original map's size preserved");
  }

  @Test
  void snapshotsAreIndependentCopies() {
    long today = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    long twoDaysAgo = TimestampUtils.subtractDays(today, 1);
    VersionedWindow window =
        new VersionedWindow(
            stubEntity(),
            twoDaysAgo,
            TimestampUtils.getEndOfDayTimestamp(today),
            VersionShape.LATEST_HYDRATED);

    Map<String, Object> enriched = new HashMap<>();
    enriched.put("entityType", "table");

    List<Map<String, Object>> snapshots = materializer.materialize(window, enriched);
    assertEquals(2, snapshots.size());

    // Mutating one snapshot must not affect the other.
    snapshots.get(0).put("extra", "first-only");
    assertFalse(snapshots.get(1).containsKey("extra"));
    assertNotEquals(snapshots.get(0).get(TIMESTAMP_KEY), snapshots.get(1).get(TIMESTAMP_KEY));
  }

  @Test
  void timestampKey_isStartOfDay_notRawPointer() {
    // Pointer is mid-day (now); the materializer should emit start-of-day for that pointer.
    long now = System.currentTimeMillis();
    long startOfNowDay = TimestampUtils.getStartOfDayTimestamp(now);
    long endOfNowDay = TimestampUtils.getEndOfDayTimestamp(now);
    VersionedWindow window =
        new VersionedWindow(stubEntity(), startOfNowDay, endOfNowDay, VersionShape.LATEST_HYDRATED);

    Map<String, Object> snap = materializer.materialize(window, new HashMap<>()).get(0);

    assertEquals(startOfNowDay, snap.get(TIMESTAMP_KEY));
    assertTrue(((Long) snap.get(TIMESTAMP_KEY)) <= now, "@timestamp <= now");
  }

  private EntityInterface stubEntity() {
    return mock(EntityInterface.class);
  }
}
