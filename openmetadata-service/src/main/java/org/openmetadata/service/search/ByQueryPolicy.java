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
package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.SearchRetryUtil.IOOperation;

/**
 * How every update-by-query and delete-by-query runs, whichever engine sends it. The clients apply
 * it to each request, so no call site can skip it.
 *
 * <ol>
 *   <li>The targets are refreshed first. Live writes do not force a refresh, and a by-query request
 *       only sees refreshed documents, so without this it would miss documents written moments
 *       before it, such as a child created just before its parent's change is propagated.
 *   <li>A request sent as a background task is awaited, so its result is known.
 *   <li>Documents skipped because a write changed them during the scan are retried against a fresh
 *       refresh; the scripts set values, so running one twice is harmless.
 *   <li>Whatever is still undone, or a request that fails outright, is recorded as a {@link
 *       SearchRepairScope}: the retry worker rebuilds the documents the request matched from the
 *       database. Then the failure is thrown, as before.
 * </ol>
 */
@Slf4j
public final class ByQueryPolicy {
  static final int MAX_ATTEMPTS = 3;
  private static final ByQueryPolicy LIVE =
      new ByQueryPolicy(System::currentTimeMillis, SearchIndexRetryQueue::enqueueRepair);

  /** Sends a by-query request once; a request sent as a background task is awaited. */
  @FunctionalInterface
  public interface Attempt {
    ByQueryOutcome run() throws IOException;
  }

  /** What a by-query request targets, kept to record a repair of what it leaves undone. */
  public record Target(String operation, List<String> indexes, Supplier<String> queryJson) {}

  private final LongSupplier clock;
  private final BiConsumer<SearchRepairScope, String> repairs;

  ByQueryPolicy(final LongSupplier clock, final BiConsumer<SearchRepairScope, String> repairs) {
    this.clock = clock;
    this.repairs = repairs;
  }

  /**
   * Runs one by-query request under this policy.
   *
   * @throws IncompleteSearchUpdateException when matched documents were left unwritten
   */
  public static void run(final Target target, final IOOperation refresh, final Attempt attempt)
      throws IOException {
    LIVE.apply(target, refresh, attempt);
  }

  void apply(final Target target, final IOOperation refresh, final Attempt attempt)
      throws IOException {
    final long startedAt = clock.getAsLong();
    try {
      requireComplete(target, runUntilSettled(refresh, attempt));
    } catch (IOException | RuntimeException failure) {
      recordRepair(target, startedAt, failure);
      throw failure;
    }
  }

  private static ByQueryOutcome runUntilSettled(final IOOperation refresh, final Attempt attempt)
      throws IOException {
    ByQueryOutcome outcome = runAfterRefresh(refresh, attempt);
    for (int attempts = 1; outcome.hasOnlyConflicts() && attempts < MAX_ATTEMPTS; attempts++) {
      outcome = runAfterRefresh(refresh, attempt);
    }
    return outcome;
  }

  private static ByQueryOutcome runAfterRefresh(final IOOperation refresh, final Attempt attempt)
      throws IOException {
    refresh.execute();
    return attempt.run();
  }

  private static void requireComplete(final Target target, final ByQueryOutcome outcome)
      throws IncompleteSearchUpdateException {
    if (!outcome.isComplete()) {
      throw new IncompleteSearchUpdateException(
          String.format(
              "%s on %s left matched documents unwritten: %s",
              target.operation(), target.indexes(), outcome.describe()));
    }
  }

  private void recordRepair(final Target target, final long startedAt, final Exception failure) {
    try {
      final SearchRepairScope scope =
          new SearchRepairScope(target.indexes(), target.queryJson().get(), startedAt);
      repairs.accept(scope, SearchIndexRetryQueue.failureReason(target.operation(), failure));
      LOG.warn(
          "{} on {} did not finish; the documents it matched will be rebuilt from the database: {}",
          target.operation(),
          target.indexes(),
          failure.getMessage());
    } catch (RuntimeException unrecorded) {
      LOG.error(
          "{} on {} did not finish and its repair could not be recorded",
          target.operation(),
          target.indexes(),
          unrecorded);
    }
  }
}
