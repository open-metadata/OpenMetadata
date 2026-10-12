/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.apps.bundles.dataRetention;

import java.util.function.IntPredicate;
import java.util.function.Supplier;

/**
 * Repeatedly calls a batched delete until it reports the table is drained, it throws, or it hits
 * the iteration cap.
 *
 * <p>The cap is the point of this class. A delete that always reports a full batch — rows it cannot
 * actually remove because of an FK constraint, or a {@link DataRetentionExtension} deleter that
 * ignores the batch size it was handed — would otherwise spin forever and block every cleanup
 * queued behind it. With a 10k batch the cap still allows 10M rows per entity per run, well above
 * any healthy catalog, and whatever is left is retried on the next run.
 */
final class BatchDrain {

  static final int MAX_ITERATIONS = 1000;

  private BatchDrain() {}

  /**
   * @param deleted rows deleted across every batch
   * @param failed rows assumed lost to the failure, if there was one
   * @param hitIterationCap whether the drain ran out of iterations rather than finishing
   * @param failure the throwable that stopped the drain, or {@code null} if nothing threw
   */
  record Result(int deleted, int failed, boolean hitIterationCap, Throwable failure) {}

  /**
   * @param deleteFunction deletes one batch and reports how many rows went
   * @param drainedWhen reads a batch's row count and says whether the table is now drained
   * @param failedRowsPerBatch charged to {@code failed} when a batch throws, since the delete
   *     cannot say how many of its rows it did not get to
   */
  static Result drain(
      final Supplier<Integer> deleteFunction,
      final IntPredicate drainedWhen,
      final int failedRowsPerBatch) {
    int totalDeleted = 0;
    int totalFailed = 0;
    boolean finished = false;
    Throwable failure = null;

    for (int iteration = 0; iteration < MAX_ITERATIONS && !finished; iteration++) {
      try {
        final int deleted = deleteFunction.get();
        totalDeleted += deleted;
        finished = drainedWhen.test(deleted);
      } catch (Exception | LinkageError thrown) {
        failure = thrown;
        totalFailed += failedRowsPerBatch;
        finished = true;
      }
    }

    return new Result(totalDeleted, totalFailed, !finished, failure);
  }
}
