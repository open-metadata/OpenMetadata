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

import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.JobPersistenceException;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.impl.matchers.GroupMatcher;

/**
 * What the job store holds for alerts, read only. Whoever needs to know how an alert is scheduled
 * reads it here; only {@link AlertJobs} changes it.
 */
@Slf4j
public final class AlertJobView {
  private final Scheduler scheduler;

  AlertJobView(Scheduler scheduler) {
    this.scheduler = scheduler;
  }

  /** Every key in the alert group as stored, including any that name no alert. */
  Set<JobKey> jobKeys() throws SchedulerException {
    return scheduler.getJobKeys(GroupMatcher.jobGroupEquals(AlertJobs.JOB_GROUP));
  }

  public boolean exists(UUID alertId) throws SchedulerException {
    return scheduler.checkExists(AlertJobs.jobKey(alertId));
  }

  /**
   * Empty when there is no job, and when the job names a class this server cannot load: a job
   * stored by an earlier release with its alert's consumer class is then treated as missing and
   * stored again, which never needs the old class.
   */
  public Optional<JobDetail> job(UUID alertId) throws SchedulerException {
    JobKey key = AlertJobs.jobKey(alertId);
    JobDetail job = null;
    try {
      job = scheduler.getJobDetail(key);
    } catch (JobPersistenceException unreadable) {
      LOG.info("Alert job {} cannot be read and is treated as missing", key, unreadable);
    }
    return Optional.ofNullable(job);
  }

  public boolean hasCurrentJobClass(UUID alertId) throws SchedulerException {
    return job(alertId).map(job -> AlertPublisher.class.equals(job.getJobClass())).orElse(false);
  }

  public Optional<Trigger> trigger(UUID alertId) throws SchedulerException {
    return Optional.ofNullable(scheduler.getTrigger(AlertJobs.triggerKey(alertId)));
  }

  public Trigger.TriggerState triggerState(UUID alertId) throws SchedulerException {
    return scheduler.getTriggerState(AlertJobs.triggerKey(alertId));
  }
}
