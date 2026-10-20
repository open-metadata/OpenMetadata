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

package org.openmetadata.service.apps.scheduler;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.service.exception.UnhandledServerException;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

/**
 * Waits, for a bounded time, for a run that has already reported a terminal status but that Quartz
 * has not released yet. A run's record turns terminal before Quartz drops the job from its
 * executing list and deletes its rows, so a trigger sent right after "completed" would otherwise
 * be refused. See ADR:2026-10-20-an-app-trigger-waits-for-a-finishing-run-before-answering-409.
 */
@Slf4j
final class FinishingRunWaiter {
  static final Duration RELEASE_BUDGET = Duration.ofSeconds(10);
  static final Duration POLL_INTERVAL = Duration.ofMillis(200);

  /** One wait's allowance: each call pauses until the next poll, and is false once spent. */
  interface Budget {
    boolean awaitNextPoll();
  }

  enum StoredRelease {
    RELEASED,
    STILL_ACTIVE,
    OUTLIVED_BUDGET
  }

  private final Scheduler scheduler;
  private final Supplier<Budget> budgets;

  FinishingRunWaiter(Scheduler scheduler, Supplier<Budget> budgets) {
    this.scheduler = scheduler;
    this.budgets = budgets;
  }

  /**
   * True once no run of the app executes on this scheduler. A run whose record is still active is
   * never waited for; a run that has finished is awaited for one budget.
   */
  boolean awaitLocalRelease(String appName, Set<JobKey> runKeys) throws SchedulerException {
    Budget budget = budgets.get();
    List<JobExecutionContext> runs = executingRuns(runKeys);
    if (isFinishing(runs)) {
      LOG.info("Waiting for the finishing run of {} to release", appName);
    }
    while (isFinishing(runs) && budget.awaitNextPoll()) {
      runs = executingRuns(runKeys);
    }
    return runs.isEmpty();
  }

  /**
   * Waits for Quartz to delete a stored job whose identity a new trigger collided with. The active
   * run is re-read on every poll, so a run that starts during the wait is reported as active.
   */
  StoredRelease awaitStoredRelease(JobKey jobKey, BooleanSupplier hasActiveRun)
      throws SchedulerException {
    Budget budget = budgets.get();
    Optional<StoredRelease> settled = settledState(jobKey, hasActiveRun);
    while (settled.isEmpty() && budget.awaitNextPoll()) {
      settled = settledState(jobKey, hasActiveRun);
    }
    return settled.orElse(StoredRelease.OUTLIVED_BUDGET);
  }

  static Budget timedBudget() {
    long deadline = System.nanoTime() + RELEASE_BUDGET.toNanos();
    return () -> System.nanoTime() < deadline && pauseUntilNextPoll();
  }

  private Optional<StoredRelease> settledState(JobKey jobKey, BooleanSupplier hasActiveRun)
      throws SchedulerException {
    Optional<StoredRelease> settled = Optional.empty();
    if (!scheduler.checkExists(jobKey)) {
      settled = Optional.of(StoredRelease.RELEASED);
    } else if (hasActiveRun.getAsBoolean()) {
      settled = Optional.of(StoredRelease.STILL_ACTIVE);
    }
    return settled;
  }

  private List<JobExecutionContext> executingRuns(Set<JobKey> runKeys) throws SchedulerException {
    return scheduler.getCurrentlyExecutingJobs().stream()
        .filter(context -> runKeys.contains(context.getJobDetail().getKey()))
        .toList();
  }

  private static boolean isFinishing(List<JobExecutionContext> runs) {
    return !runs.isEmpty() && runs.stream().allMatch(FinishingRunWaiter::hasFinished);
  }

  private static boolean hasFinished(JobExecutionContext run) {
    AppRunRecord record = OmAppJobListener.runRecordOf(run);
    return record != null
        && record.getStatus() != null
        && AppScheduler.TERMINAL_RUN_STATUSES.contains(record.getStatus());
  }

  private static boolean pauseUntilNextPoll() {
    try {
      Thread.sleep(POLL_INTERVAL);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new UnhandledServerException(
          "Interrupted while waiting for the previous run to finish", e);
    }
    return true;
  }
}
