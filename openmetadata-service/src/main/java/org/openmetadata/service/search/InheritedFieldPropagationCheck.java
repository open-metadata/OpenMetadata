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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.io.IOException;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.search.EntityManagementClient.ChildUpdateStatus;

/**
 * Inherited fields reach a parent's children through a background update-by-query, so the request
 * that changed the parent has returned before the engine runs it. The engine can still fail that
 * task, for example when its open scroll contexts are exhausted under concurrent update- and
 * delete-by-query load, and nothing would notice: the submission succeeded, so no retry was queued,
 * and the children keep the old value until the next reindex. This reads each task's status until it
 * finishes and, when the engine failed it, queues the parent in the search retry queue with the
 * change being propagated; the retry worker replays that propagation
 * (ADR:2026-11-03-a-failed-background-propagation-is-replayed).
 */
@Slf4j
final class InheritedFieldPropagationCheck {
  static final Duration FIRST_CHECK = Duration.ofSeconds(1);
  static final Duration LONGEST_CHECK_INTERVAL = Duration.ofSeconds(10);
  static final Duration DEADLINE = Duration.ofMinutes(15);
  static final int MAX_REPAIRS_PER_PARENT = 3;
  static final int MAX_WATCHED_TASKS = 1_000;
  private static final ScheduledExecutorService CHECKER =
      Executors.newSingleThreadScheduledExecutor(
          Thread.ofPlatform().name("search-propagation-check").daemon().factory());

  @FunctionalInterface
  interface Scheduler {
    void schedule(Runnable check, Duration delay);
  }

  @FunctionalInterface
  interface StatusReader {
    ChildUpdateStatus read(String taskId) throws IOException;
  }

  @FunctionalInterface
  interface Repair {
    void queue(EntityInterface<?> parent, ChangeDescription change, String reason);
  }

  private record Watch(
      String taskId, EntityInterface<?> parent, ChangeDescription change, Duration waited) {}

  private final Scheduler scheduler;
  private final StatusReader statusReader;
  private final Repair repair;
  private final AtomicInteger watched = new AtomicInteger();
  private final AtomicLong unchecked = new AtomicLong();
  // A replay is itself checked; under sustained engine pressure it can fail again, and every queue
  // entry restarts the retry worker's attempt count, so the repairs of one parent are capped here.
  private final Cache<UUID, Integer> repairsByParent =
      Caffeine.newBuilder().maximumSize(10_000).expireAfterWrite(Duration.ofHours(1)).build();

  InheritedFieldPropagationCheck(StatusReader statusReader) {
    this(
        (check, delay) -> CHECKER.schedule(check, delay.toMillis(), TimeUnit.MILLISECONDS),
        statusReader,
        SearchIndexRetryQueue::enqueueWithPropagation);
  }

  InheritedFieldPropagationCheck(Scheduler scheduler, StatusReader statusReader, Repair repair) {
    this.scheduler = scheduler;
    this.statusReader = statusReader;
    this.repair = repair;
  }

  void watch(String taskId, EntityInterface<?> parent, ChangeDescription change) {
    if (taskId != null && parent != null) {
      if (watched.incrementAndGet() > MAX_WATCHED_TASKS) {
        watched.decrementAndGet();
        reportUnchecked(taskId);
      } else {
        Watch watch = new Watch(taskId, parent, change, FIRST_CHECK);
        scheduler.schedule(() -> check(watch), FIRST_CHECK);
      }
    }
  }

  // Logged on the first and every thousandth task left unchecked, so a burst cannot flood the log.
  private void reportUnchecked(String taskId) {
    long count = unchecked.incrementAndGet();
    if (count == 1 || count % MAX_WATCHED_TASKS == 0) {
      LOG.warn(
          "{} propagation task(s), most recently {}, went unchecked: {} were already being checked",
          count,
          taskId,
          MAX_WATCHED_TASKS);
    }
  }

  private void check(Watch watch) {
    ChildUpdateStatus status = readStatus(watch);
    if (status.finished()) {
      watched.decrementAndGet();
      repairIfFailed(watch, status);
    } else if (watch.waited().compareTo(DEADLINE) >= 0) {
      watched.decrementAndGet();
      LOG.warn(
          "Propagation task {} for {} did not finish within {}; its outcome is unknown",
          watch.taskId(),
          watch.parent().getId(),
          DEADLINE);
    } else {
      Duration delay = nextDelay(watch.waited());
      Watch next =
          new Watch(watch.taskId(), watch.parent(), watch.change(), watch.waited().plus(delay));
      scheduler.schedule(() -> check(next), delay);
    }
  }

  private static Duration nextDelay(Duration waited) {
    Duration doubled = waited.multipliedBy(2);
    return doubled.compareTo(LONGEST_CHECK_INTERVAL) > 0 ? LONGEST_CHECK_INTERVAL : doubled;
  }

  // The engine checked here is often the one under load, so a read that fails is tried again on the
  // next check rather than taken as the task's outcome.
  private ChildUpdateStatus readStatus(Watch watch) {
    ChildUpdateStatus status;
    try {
      status = statusReader.read(watch.taskId());
    } catch (IOException | RuntimeException e) {
      LOG.debug("Could not read propagation task {}: {}", watch.taskId(), e.getMessage());
      status = ChildUpdateStatus.running();
    }
    return status;
  }

  private void repairIfFailed(Watch watch, ChildUpdateStatus status) {
    if (status.failed()) {
      int repairs = repairsByParent.asMap().merge(watch.parent().getId(), 1, Integer::sum);
      if (repairs <= MAX_REPAIRS_PER_PARENT) {
        LOG.warn(
            "Propagation task {} for {} failed ({}); queueing it for replay",
            watch.taskId(),
            watch.parent().getId(),
            status.failure());
        repair.queue(
            watch.parent(),
            watch.change(),
            "propagateInheritedFields: %s".formatted(status.failure()));
      } else {
        LOG.error(
            "Propagation for {} failed {} times within an hour; not queueing it again: {}",
            watch.parent().getId(),
            repairs,
            status.failure());
      }
    }
  }
}
