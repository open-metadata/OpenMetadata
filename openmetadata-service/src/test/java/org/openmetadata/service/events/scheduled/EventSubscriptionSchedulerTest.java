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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Properties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.audit.AuditLogConsumer;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.impl.StdSchedulerFactory;

class EventSubscriptionSchedulerTest {

  @Test
  @DisplayName("Scheduler should use ALERT_JOB_GROUP for job grouping")
  void testAlertJobGroupConstant() {
    assertEquals(
        "OMAlertJobGroup",
        EventSubscriptionScheduler.ALERT_JOB_GROUP,
        "Job group should be OMAlertJobGroup");
  }

  @Test
  @DisplayName("Scheduler should use ALERT_TRIGGER_GROUP for trigger grouping")
  void testAlertTriggerGroupConstant() {
    assertEquals(
        "OMAlertJobGroup",
        EventSubscriptionScheduler.ALERT_TRIGGER_GROUP,
        "Trigger group should be OMAlertJobGroup");
  }

  @Test
  @DisplayName("Scheduler constants should be defined")
  void testSchedulerConstantsExist() {
    assertNotNull(EventSubscriptionScheduler.ALERT_JOB_GROUP, "ALERT_JOB_GROUP should be defined");
    assertNotNull(
        EventSubscriptionScheduler.ALERT_TRIGGER_GROUP, "ALERT_TRIGGER_GROUP should be defined");
  }

  @Test
  @DisplayName("Audit log consumer is scheduled and firing when absent")
  void testEnsureAuditLogConsumerSchedulesWhenAbsent() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-absent");
    try {
      EventSubscriptionScheduler.ensureAuditLogConsumerScheduled(scheduler);

      assertTrue(scheduler.checkExists(auditJobKey()), "Audit log consumer job should exist");
      assertEquals(
          Trigger.TriggerState.NORMAL,
          scheduler.getTriggerState(auditTriggerKey()),
          "Trigger should be firing");
    } finally {
      scheduler.shutdown(true);
    }
  }

  @Test
  @DisplayName("Audit log consumer re-arms an abandoned trigger frozen with a past next-fire-time")
  void testEnsureAuditLogConsumerReArmsAbandonedTrigger() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-abandoned");
    try {
      scheduleStaleAuditTrigger(scheduler);
      Date staleNextFire = scheduler.getTrigger(auditTriggerKey()).getNextFireTime();
      assertEquals(
          Trigger.TriggerState.NORMAL,
          scheduler.getTriggerState(auditTriggerKey()),
          "Precondition: an abandoned trigger still reports as NORMAL/WAITING");

      EventSubscriptionScheduler.ensureAuditLogConsumerScheduled(scheduler);

      Date freshNextFire = scheduler.getTrigger(auditTriggerKey()).getNextFireTime();
      assertTrue(
          freshNextFire.after(staleNextFire),
          "A NORMAL-but-frozen trigger must be re-armed with a fresh next-fire-time");
    } finally {
      scheduler.shutdown(true);
    }
  }

  @Test
  @DisplayName("Audit log consumer recovers a paused trigger")
  void testEnsureAuditLogConsumerRecoversPausedTrigger() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-paused");
    try {
      EventSubscriptionScheduler.ensureAuditLogConsumerScheduled(scheduler);
      scheduler.pauseTrigger(auditTriggerKey());
      assertEquals(
          Trigger.TriggerState.PAUSED,
          scheduler.getTriggerState(auditTriggerKey()),
          "Precondition: trigger is paused");

      EventSubscriptionScheduler.ensureAuditLogConsumerScheduled(scheduler);

      assertEquals(
          Trigger.TriggerState.NORMAL,
          scheduler.getTriggerState(auditTriggerKey()),
          "A paused trigger must be re-armed back to NORMAL");
    } finally {
      scheduler.shutdown(true);
    }
  }

  @Test
  @DisplayName("Repeated scheduling keeps a single firing job")
  void testEnsureAuditLogConsumerIsIdempotent() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-idempotent");
    try {
      EventSubscriptionScheduler.ensureAuditLogConsumerScheduled(scheduler);
      EventSubscriptionScheduler.ensureAuditLogConsumerScheduled(scheduler);

      assertEquals(
          1,
          scheduler.getTriggersOfJob(auditJobKey()).size(),
          "Job should have exactly one trigger after repeated scheduling");
      assertEquals(
          Trigger.TriggerState.NORMAL,
          scheduler.getTriggerState(auditTriggerKey()),
          "Trigger should remain firing");
    } finally {
      scheduler.shutdown(true);
    }
  }

  private static void scheduleStaleAuditTrigger(Scheduler scheduler) throws SchedulerException {
    JobDetail jobDetail =
        JobBuilder.newJob(AuditLogConsumer.class)
            .withIdentity(auditJobKey())
            .storeDurably()
            .build();
    Trigger staleTrigger =
        TriggerBuilder.newTrigger()
            .withIdentity(auditTriggerKey())
            .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(5))
            .startAt(Date.from(Instant.now().minus(Duration.ofDays(60))))
            .build();
    scheduler.scheduleJob(jobDetail, staleTrigger);
  }

  private static JobKey auditJobKey() {
    return new JobKey(
        EventSubscriptionScheduler.AUDIT_LOG_JOB_ID,
        EventSubscriptionScheduler.AUDIT_LOG_JOB_GROUP);
  }

  private static TriggerKey auditTriggerKey() {
    return new TriggerKey(
        EventSubscriptionScheduler.AUDIT_LOG_JOB_ID,
        EventSubscriptionScheduler.AUDIT_LOG_JOB_GROUP);
  }

  private static Scheduler newStandbyScheduler(String instanceName) throws SchedulerException {
    Properties properties = new Properties();
    properties.put("org.quartz.scheduler.instanceName", instanceName);
    properties.put("org.quartz.scheduler.skipUpdateCheck", "true");
    properties.put("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
    properties.put("org.quartz.threadPool.threadCount", "1");
    properties.put("org.quartz.jobStore.class", "org.quartz.simpl.RAMJobStore");
    StdSchedulerFactory factory = new StdSchedulerFactory();
    factory.initialize(properties);
    return factory.getScheduler();
  }
}
