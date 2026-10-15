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
package org.openmetadata.service.rdf.repair;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;

class RdfProjectionCheckTest {
  private static final long NOW = 1_800_000_000_000L;
  private static final long HOUR = Duration.ofHours(1).toMillis();

  private final AtomicInteger rebuildsStarted = new AtomicInteger();
  private final Deque<Optional<AppRunRecord>> latestRuns = new ArrayDeque<>();
  private boolean ontologyLoaded = true;
  private boolean rebuildRunning;
  private boolean searchReindexRunning;

  @Test
  void aProjectionNeverBuiltIsBuilt() throws Exception {
    latestRuns.add(Optional.empty());

    check().rebuildIfNeeded();

    assertEquals(1, rebuildsStarted.get());
  }

  @Test
  void aStoreThatLostItsDataIsRebuilt() throws Exception {
    latestRuns.add(Optional.of(run(AppRunRecord.Status.SUCCESS, NOW - HOUR)));
    ontologyLoaded = false;

    check().rebuildIfNeeded();

    assertEquals(1, rebuildsStarted.get());
  }

  @Test
  void aFailedBuildIsRetriedADayLaterButNotSooner() throws Exception {
    latestRuns.add(Optional.of(run(AppRunRecord.Status.FAILED, NOW - HOUR)));
    check().rebuildIfNeeded();
    assertEquals(0, rebuildsStarted.get());

    latestRuns.clear();
    latestRuns.add(
        Optional.of(
            run(
                AppRunRecord.Status.FAILED,
                NOW - RdfProjectionCheck.FAILED_BUILD_RETRY.toMillis())));
    check().rebuildIfNeeded();
    assertEquals(1, rebuildsStarted.get());
  }

  @Test
  void aStoppedOrSuccessfulBuildIsLeftAlone() throws Exception {
    latestRuns.add(Optional.of(run(AppRunRecord.Status.STOPPED, NOW - 10 * 24 * HOUR)));
    check().rebuildIfNeeded();
    latestRuns.clear();
    latestRuns.add(Optional.of(run(AppRunRecord.Status.SUCCESS, NOW - 10 * 24 * HOUR)));
    check().rebuildIfNeeded();

    assertEquals(0, rebuildsStarted.get());
  }

  @Test
  void nothingStartsWhileARebuildOrASearchReindexRuns() throws Exception {
    latestRuns.add(Optional.empty());
    rebuildRunning = true;
    check().rebuildIfNeeded();

    latestRuns.add(Optional.empty());
    rebuildRunning = false;
    searchReindexRunning = true;
    check().rebuildIfNeeded();

    assertEquals(0, rebuildsStarted.get());
  }

  @Test
  void aReasonGoneByTheConfirmationStartsNothing() throws Exception {
    latestRuns.add(Optional.empty());
    latestRuns.add(Optional.of(run(AppRunRecord.Status.RUNNING, NOW)));

    check().rebuildIfNeeded();

    assertEquals(0, rebuildsStarted.get());
  }

  /** Each read of the latest run takes the next queued answer, repeating the last one. */
  private RdfProjectionCheck check() {
    final RdfProjectionCheck.Probes probes =
        new RdfProjectionCheck.Probes(
            () -> latestRuns.size() > 1 ? latestRuns.poll() : latestRuns.peek(),
            () -> ontologyLoaded,
            () -> rebuildRunning,
            () -> searchReindexRunning);
    return new RdfProjectionCheck(
        probes, rebuildsStarted::incrementAndGet, () -> NOW, Duration.ZERO);
  }

  private static AppRunRecord run(final AppRunRecord.Status status, final long endedAt) {
    return new AppRunRecord().withStatus(status).withEndTime(endedAt).withTimestamp(endedAt);
  }
}
