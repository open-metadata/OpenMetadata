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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.LifeCycle;

class LifeCyclesTest {

  private static final long YEAR_0001 = -62135596800000L;
  private static final long MARCH_2022 = 1647336600000L;

  @Test
  void keepsTimestampsFromTheEpochOnward() {
    final LifeCycle lifeCycle =
        new LifeCycle()
            .withCreated(at(MARCH_2022))
            .withUpdated(at(0L))
            .withAccessed(at(MARCH_2022 + 1));

    final LifeCycle result = LifeCycles.withoutPlaceholderTimestamps(lifeCycle);

    assertEquals(MARCH_2022, result.getCreated().getTimestamp());
    assertEquals(0L, result.getUpdated().getTimestamp());
    assertEquals(MARCH_2022 + 1, result.getAccessed().getTimestamp());
  }

  @Test
  void dropsOnlyTheAspectsBeforeTheEpoch() {
    final LifeCycle lifeCycle =
        new LifeCycle()
            .withCreated(at(YEAR_0001))
            .withUpdated(at(-1L))
            .withAccessed(at(MARCH_2022));

    final LifeCycle result = LifeCycles.withoutPlaceholderTimestamps(lifeCycle);

    assertNull(result.getCreated());
    assertNull(result.getUpdated());
    assertEquals(MARCH_2022, result.getAccessed().getTimestamp());
  }

  @Test
  void becomesNullWhenEveryAspectIsAPlaceholder() {
    final LifeCycle lifeCycle = new LifeCycle().withCreated(at(YEAR_0001));

    assertNull(LifeCycles.withoutPlaceholderTimestamps(lifeCycle));
  }

  @Test
  void leavesAMissingLifeCycleMissing() {
    assertNull(LifeCycles.withoutPlaceholderTimestamps(null));
  }

  @Test
  void keepsTheStoredLifeCycleWhenAPatchCarriesOnlyPlaceholders() {
    final LifeCycle stored = new LifeCycle().withAccessed(at(MARCH_2022));
    final LifeCycle patched = new LifeCycle().withCreated(at(YEAR_0001));

    final LifeCycle result = LifeCycles.withoutPlaceholderTimestamps(patched, stored);

    assertEquals(MARCH_2022, result.getAccessed().getTimestamp());
    assertNull(result.getCreated());
    assertNotSame(stored, result);
  }

  @Test
  void takesThePatchedTimesWhenAPatchCarriesARecordedOne() {
    final LifeCycle stored = new LifeCycle().withAccessed(at(MARCH_2022));
    final LifeCycle patched =
        new LifeCycle().withCreated(at(YEAR_0001)).withAccessed(at(MARCH_2022 + 1));

    final LifeCycle result = LifeCycles.withoutPlaceholderTimestamps(patched, stored);

    assertNull(result.getCreated());
    assertEquals(MARCH_2022 + 1, result.getAccessed().getTimestamp());
  }

  @Test
  void removesTheLifeCycleWhenAPatchRemovesIt() {
    final LifeCycle stored = new LifeCycle().withAccessed(at(MARCH_2022));

    assertNull(LifeCycles.withoutPlaceholderTimestamps(null, stored));
  }

  @Test
  void dropsAPlaceholderOnlyPatchWhenNothingIsStored() {
    final LifeCycle patched = new LifeCycle().withCreated(at(YEAR_0001));

    assertNull(LifeCycles.withoutPlaceholderTimestamps(patched, null));
  }

  private static AccessDetails at(final long timestamp) {
    return new AccessDetails().withTimestamp(timestamp);
  }
}
