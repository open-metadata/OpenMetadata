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

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.audit.AuditLogConsumer;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;

/**
 * The audit log consumer's job: it reads change_event and writes audit_log on a fixed interval,
 * one instance at a time across the cluster.
 */
@Slf4j
final class AuditLogSchedule {
  static final String AUDIT_LOG_JOB_GROUP = "OMAuditLogJobGroup";
  static final String AUDIT_LOG_JOB_ID = "AuditLogConsumerJob";
  private static final int AUDIT_LOG_POLL_INTERVAL_SECONDS = 5;

  private AuditLogSchedule() {}

  /**
   * (Re)arms the audit log consumer trigger on every startup. With the clustered {@code JobStoreTX}
   * the job and trigger persist across restarts, so a plain existence check sees the job and skips
   * rescheduling forever. That strands the consumer whenever the persisted trigger stops firing:
   * not only in ERROR/BLOCKED/PAUSED states, but also while still reported as WAITING/NORMAL with a
   * frozen past next-fire-time (an abandoned trigger after an unclean shutdown). We therefore always
   * replace it with a fresh trigger. The consumer offset lives in {@code change_event_consumers},
   * not in Quartz, so re-arming loses no progress; {@code replace=true} swaps atomically so
   * concurrent cluster nodes don't race.
   */
  static void ensureScheduled(Scheduler scheduler) throws SchedulerException {
    JobKey jobKey = new JobKey(AUDIT_LOG_JOB_ID, AUDIT_LOG_JOB_GROUP);
    JobDetail jobDetail =
        JobBuilder.newJob(AuditLogConsumer.class).withIdentity(jobKey).storeDurably().build();
    scheduler.scheduleJob(jobDetail, Set.of(trigger()), true);
    LOG.info(
        "Audit log consumer (re)scheduled with poll interval: {} seconds",
        AUDIT_LOG_POLL_INTERVAL_SECONDS);
  }

  private static Trigger trigger() {
    return TriggerBuilder.newTrigger()
        .withIdentity(AUDIT_LOG_JOB_ID, AUDIT_LOG_JOB_GROUP)
        .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(AUDIT_LOG_POLL_INTERVAL_SECONDS))
        .startNow()
        .build();
  }
}
