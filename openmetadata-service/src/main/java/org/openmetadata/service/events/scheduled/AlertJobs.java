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

package org.openmetadata.service.events.scheduled;

import com.google.common.util.concurrent.Striped;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;

/**
 * The one writer of alert jobs. Whatever changed, an alert's job is brought in step with its
 * stored row: scheduled when the row is enabled, removed when it is disabled or gone. Every job is
 * stored with {@link AlertPublisher}, a class every server can load, and carries no data; the tick
 * runs the consumer the row names.
 *
 * <p>The decision is taken from the stored row, never from a copy a caller holds: two saves can
 * commit in one order and reach here in the other, and a disable arriving last would otherwise
 * delete the job an enable had just written. A lock per alert orders this server's callers, and
 * the row is read again after applying, so a peer that committed in between is caught too.
 */
@Slf4j
public final class AlertJobs {
  public static final String JOB_GROUP = "OMAlertJobGroup";
  public static final String TRIGGER_GROUP = "OMAlertJobGroup";

  // Bounded by construction rather than a per-id map that grows with the catalog.
  private static final Striped<Lock> LOCKS = Striped.lock(64);
  // A peer committing mid-flight costs one more round; the bound stops a row rewritten in a tight
  // loop from spinning here forever.
  private static final int SETTLE_ATTEMPTS = 3;

  private static volatile AlertJobs started;

  private final Scheduler scheduler;
  private final AlertJobView view;

  private AlertJobs(Scheduler scheduler) {
    this.scheduler = scheduler;
    this.view = new AlertJobView(scheduler);
  }

  static void start(Scheduler scheduler) {
    started = new AlertJobs(scheduler);
  }

  static void stop() {
    started = null;
  }

  /**
   * Brings the alert's job in step with its stored row. Does nothing while the scheduler is not
   * running, as during a migration, and never throws: a job it could not write is repaired by the
   * reconciler.
   */
  public static void converge(UUID alertId) {
    AlertJobs jobs = started;
    if (jobs != null) {
      try {
        jobs.settle(alertId);
      } catch (SchedulerException | RuntimeException e) {
        LOG.warn("Alert {} not scheduled; the reconciler repairs it", alertId, e);
      }
    }
  }

  /** Removes the alert's job without reading its row, for a delete that has not committed yet. */
  static void removeNow(UUID alertId) throws SchedulerException {
    AlertJobs jobs = started;
    if (jobs != null) {
      Lock lock = LOCKS.get(alertId);
      lock.lock();
      try {
        jobs.remove(alertId);
      } finally {
        lock.unlock();
      }
    }
  }

  /** Runs a tick that stopped for its time budget again at once, from the scheduler that ran it. */
  public static void runAgainNow(JobExecutionContext tick) throws SchedulerException {
    tick.getScheduler().triggerJob(tick.getJobDetail().getKey());
  }

  static AlertJobView view() {
    return started.view;
  }

  static JobKey jobKey(UUID alertId) {
    return new JobKey(alertId.toString(), JOB_GROUP);
  }

  static TriggerKey triggerKey(UUID alertId) {
    return new TriggerKey(alertId.toString(), TRIGGER_GROUP);
  }

  private void settle(UUID alertId) throws SchedulerException {
    Lock lock = LOCKS.get(alertId);
    lock.lock();
    try {
      boolean settled = false;
      for (int attempt = 1; attempt <= SETTLE_ATTEMPTS && !settled; attempt++) {
        EventSubscription stored = AlertRows.readOrNull(alertId);
        apply(alertId, stored);
        settled = isSettled(alertId, stored);
      }
      if (!settled) {
        LOG.warn(
            "Alert {} kept changing while it was scheduled; the reconciler repairs it", alertId);
      }
    } finally {
      lock.unlock();
    }
  }

  /** Settled means the row has not moved since the decision was taken and the job store agrees. */
  private boolean isSettled(UUID alertId, EventSubscription applied) throws SchedulerException {
    EventSubscription current = AlertRows.readOrNull(alertId);
    return Objects.equals(versionOf(applied), versionOf(current))
        && scheduler.checkExists(jobKey(alertId)) == shouldBeScheduled(current);
  }

  private void apply(UUID alertId, EventSubscription stored) throws SchedulerException {
    if (shouldBeScheduled(stored)) {
      // Rows first: a tick that finds no position row does nothing.
      AlertRecord.start(stored);
      // One job-store transaction writes the job and its trigger, so there is no moment without a
      // job, and a peer writing the same keys cannot interleave.
      scheduler.scheduleJob(job(alertId), Set.of(trigger(stored)), true);
    } else {
      remove(alertId);
      LOG.info("Alert {} is disabled or gone, so it has no job", alertId);
    }
  }

  /**
   * {@link Scheduler#deleteJob} lists a job's triggers and then unschedules them in separate
   * transactions, so it fails when a trigger it just listed is already gone. Dropping the trigger
   * first leaves it nothing to unschedule. If it fails even so, a writer on another node has
   * installed a pair under this key since, and deleting that would undo newer work, so it stops
   * and the settle loop decides.
   */
  private void remove(UUID alertId) throws SchedulerException {
    scheduler.unscheduleJob(triggerKey(alertId));
    try {
      scheduler.deleteJob(jobKey(alertId));
    } catch (SchedulerException lostRace) {
      LOG.debug("Alert job {} changed while being removed", alertId, lostRace);
    }
  }

  private static boolean shouldBeScheduled(EventSubscription stored) {
    return stored != null && !Boolean.FALSE.equals(stored.getEnabled());
  }

  private static Double versionOf(EventSubscription stored) {
    return stored == null ? null : stored.getVersion();
  }

  private static JobDetail job(UUID alertId) {
    return JobBuilder.newJob(AlertPublisher.class).withIdentity(jobKey(alertId)).build();
  }

  private static Trigger trigger(EventSubscription stored) {
    return TriggerBuilder.newTrigger()
        .withIdentity(triggerKey(stored.getId()))
        .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(stored.getPollInterval()))
        .startNow()
        .build();
  }
}
