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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.db.DataSourceFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.audit.AuditLogConsumer;
import org.openmetadata.service.events.consumer.ConsumerJob;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.impl.StdSchedulerFactory;
import org.quartz.spi.OperableTrigger;

class EventSubscriptionSchedulerTest {

  @Test
  void configuresClusteredJdbcStore() {
    DataSourceFactory postgres = new DataSourceFactory();
    postgres.setDriverClass("org.postgresql.Driver");
    postgres.setUrl("jdbc:postgresql://localhost/openmetadata_db");
    postgres.setUser("openmetadata_user");
    postgres.setPassword("openmetadata_password");

    Properties quartz = EventSubscriptionScheduler.quartzProperties(postgres);

    assertEquals(
        "org.quartz.impl.jdbcjobstore.JobStoreTX", quartz.get("org.quartz.jobStore.class"));
    assertEquals("true", quartz.get("org.quartz.jobStore.isClustered"));
    assertEquals(
        "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate",
        quartz.get("org.quartz.jobStore.driverDelegateClass"));
    assertEquals("10", quartz.get("org.quartz.threadPool.threadCount"));
    assertEquals("OMEventSubSchedulerDS", quartz.get("org.quartz.jobStore.dataSource"));
    assertTrue(
        quartz.stringPropertyNames().stream()
            .noneMatch(name -> name.startsWith("org.quartz.dataSource.")),
        "the pool is the server's own, so Quartz is given no data source of its own to build");
  }

  @Test
  @DisplayName("Audit log consumer is scheduled and firing when absent")
  void testEnsureAuditLogConsumerSchedulesWhenAbsent() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-absent");
    try {
      AuditLogSchedule.ensureScheduled(scheduler);

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

      AuditLogSchedule.ensureScheduled(scheduler);

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
      AuditLogSchedule.ensureScheduled(scheduler);
      scheduler.pauseTrigger(auditTriggerKey());
      assertEquals(
          Trigger.TriggerState.PAUSED,
          scheduler.getTriggerState(auditTriggerKey()),
          "Precondition: trigger is paused");

      AuditLogSchedule.ensureScheduled(scheduler);

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
      AuditLogSchedule.ensureScheduled(scheduler);
      AuditLogSchedule.ensureScheduled(scheduler);

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

  @Test
  @DisplayName("A trigger waiting for a free thread stays acquirable for ten minutes")
  void testQuartzPropertiesKeepAWaitingTriggerAcquirable() {
    Properties quartz =
        EventSubscriptionScheduler.quartzProperties(database(ConnectionType.MYSQL.label));

    assertEquals(
        "600000",
        quartz.get("org.quartz.jobStore.misfireThreshold"),
        "Far above a time budget plus one slow event, so an alert that waits keeps its turn");
  }

  @Test
  @DisplayName("An alert whose tick ended past its next slot runs one interval after that tick")
  void testLateAlertTriggerRestartsOneIntervalAfterTheTick() {
    EventSubscription subscription = subscription(60);
    OperableTrigger stored = (OperableTrigger) AlertJobs.trigger(subscription);
    stored.setNextFireTime(new Date(NOW - Duration.ofMinutes(3).toMillis()));

    SimpleTrigger restarted =
        (SimpleTrigger) AlertJobs.restarted(stored, subscription, NOW).orElseThrow();

    assertEquals(new Date(NOW + 60_000L), restarted.getStartTime());
    assertEquals(stored.getKey(), restarted.getKey());
    assertEquals(60_000L, restarted.getRepeatInterval());
    assertEquals(
        SimpleTrigger.MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT,
        restarted.getMisfireInstruction());
  }

  @Test
  @DisplayName("An alert whose next slot is still ahead keeps its timetable")
  void testOnTimeAlertTriggerIsLeftAlone() {
    EventSubscription subscription = subscription(60);
    OperableTrigger stored = (OperableTrigger) AlertJobs.trigger(subscription);
    stored.setNextFireTime(new Date(NOW + 30_000L));

    assertTrue(AlertJobs.restarted(stored, subscription, NOW).isEmpty());
  }

  @Test
  @DisplayName("A switched-off or deleted alert is not restarted")
  void testAlertWithNothingToScheduleIsNotRestarted() {
    EventSubscription subscription = subscription(60);
    OperableTrigger stored = (OperableTrigger) AlertJobs.trigger(subscription);
    stored.setNextFireTime(new Date(NOW - 60_000L));

    assertTrue(AlertJobs.restarted(stored, subscription.withEnabled(false), NOW).isEmpty());
    assertTrue(AlertJobs.restarted(stored, null, NOW).isEmpty());
    assertTrue(AlertJobs.restarted(null, subscription(60), NOW).isEmpty());
  }

  @Test
  @DisplayName("The audit log consumer runs one interval after a run that ended past its slot")
  void testLateAuditLogTriggerRestartsOneIntervalAfterTheRun() {
    OperableTrigger stored =
        (OperableTrigger)
            AuditLogSchedule.restarted(behindBy(Duration.ofMinutes(2)), NOW).orElseThrow();

    assertEquals(new Date(NOW + 5_000L), stored.getStartTime());
    assertEquals(auditTriggerKey(), stored.getKey());
    assertTrue(AuditLogSchedule.restarted(aheadBy(Duration.ofSeconds(3)), NOW).isEmpty());
  }

  @Test
  @DisplayName("Quartz uses the server's pool for its clustered job store")
  void testQuartzPropertiesUseServerPoolForClusteredStore() {
    Properties quartz =
        EventSubscriptionScheduler.quartzProperties(database(ConnectionType.POSTGRES.label));

    assertEquals(
        "org.quartz.impl.jdbcjobstore.JobStoreTX", quartz.get("org.quartz.jobStore.class"));
    assertEquals("true", quartz.get("org.quartz.jobStore.isClustered"));
    assertEquals("10", quartz.get("org.quartz.threadPool.threadCount"));
    assertEquals("OMEventSubSchedulerDS", quartz.get("org.quartz.jobStore.dataSource"));
    assertTrue(
        quartz.stringPropertyNames().stream()
            .noneMatch(name -> name.startsWith("org.quartz.dataSource.")),
        "Quartz must not build a pool of its own");
  }

  @ParameterizedTest
  @CsvSource({
    "com.mysql.cj.jdbc.Driver, org.quartz.impl.jdbcjobstore.StdJDBCDelegate",
    "org.postgresql.Driver, org.quartz.impl.jdbcjobstore.PostgreSQLDelegate"
  })
  @DisplayName("Quartz picks the delegate that matches the database driver")
  void testQuartzPropertiesPickDelegateFromDriver(String driverClass, String delegate) {
    Properties quartz = EventSubscriptionScheduler.quartzProperties(database(driverClass));

    assertEquals(delegate, quartz.get("org.quartz.jobStore.driverDelegateClass"));
  }

  @Test
  @DisplayName("An alert trigger fires at once after a misfire")
  void testAlertTriggerFiresNowAfterMisfire() {
    EventSubscription subscription = subscription(30);

    SimpleTrigger trigger = (SimpleTrigger) AlertJobs.trigger(subscription);

    assertEquals(
        SimpleTrigger.MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT,
        trigger.getMisfireInstruction());
    assertEquals(
        AlertJobs.triggerKey(subscription.getId()),
        trigger.getKey(),
        "The key must stay the same so rescheduling replaces the stored trigger");
    assertEquals(30_000L, trigger.getRepeatInterval());
    assertEquals(SimpleTrigger.REPEAT_INDEFINITELY, trigger.getRepeatCount());
  }

  @Test
  @DisplayName("A stalled alert trigger fires now instead of waiting for its next slot")
  void testStalledAlertTriggerFiresAtOnceInsteadOfNextSlot() {
    OperableTrigger trigger = (OperableTrigger) AlertJobs.trigger(subscription(60));
    trigger.setNextFireTime(Date.from(Instant.now().minus(Duration.ofMinutes(10))));

    trigger.updateAfterMisfire(null);

    assertFalse(
        trigger.getNextFireTime().after(new Date()),
        "A late poller must run now, not up to a full poll interval later");
  }

  @Test
  @DisplayName("The audit log trigger fires at once after a misfire")
  void testAuditLogTriggerFiresNowAfterMisfire() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-misfire");
    try {
      AuditLogSchedule.ensureScheduled(scheduler);

      assertEquals(
          SimpleTrigger.MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT,
          scheduler.getTrigger(auditTriggerKey()).getMisfireInstruction());
    } finally {
      scheduler.shutdown(true);
    }
  }

  @Test
  @DisplayName("Re-arming the audit log consumer upgrades a stored trigger's misfire policy")
  void testEnsureAuditLogConsumerUpgradesPersistedMisfirePolicy() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("audit-upgrade");
    try {
      scheduleStaleAuditTrigger(scheduler);
      assertEquals(
          Trigger.MISFIRE_INSTRUCTION_SMART_POLICY,
          scheduler.getTrigger(auditTriggerKey()).getMisfireInstruction(),
          "Precondition: a trigger stored by an older version uses the default policy");

      AuditLogSchedule.ensureScheduled(scheduler);

      assertEquals(
          SimpleTrigger.MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT,
          scheduler.getTrigger(auditTriggerKey()).getMisfireInstruction());
    } finally {
      scheduler.shutdown(true);
    }
  }

  @Test
  @DisplayName("Rescheduling an alert replaces its stored trigger with one that fires at once")
  void testAlertTriggerReplacesPersistedTriggerInPlace() throws SchedulerException {
    Scheduler scheduler = newStandbyScheduler("alert-upgrade");
    try {
      EventSubscription subscription = subscription(10);
      JobDetail job = alertJob(subscription);
      scheduler.scheduleJob(job, olderVersionTrigger(subscription));

      scheduler.scheduleJob(job, Set.of(AlertJobs.trigger(subscription)), true);

      assertEquals(1, scheduler.getTriggersOfJob(job.getKey()).size());
      assertEquals(
          SimpleTrigger.MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT,
          scheduler.getTriggersOfJob(job.getKey()).getFirst().getMisfireInstruction());
    } finally {
      scheduler.shutdown(true);
    }
  }

  private static JobDetail alertJob(EventSubscription subscription) {
    return JobBuilder.newJob(ConsumerJob.class)
        .withIdentity(AlertJobs.jobKey(subscription.getId()))
        .build();
  }

  private static Trigger olderVersionTrigger(EventSubscription subscription) {
    return TriggerBuilder.newTrigger()
        .withIdentity(AlertJobs.triggerKey(subscription.getId()))
        .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(subscription.getPollInterval()))
        .startNow()
        .build();
  }

  private static DataSourceFactory database(String driverClass) {
    DataSourceFactory database = new DataSourceFactory();
    database.setDriverClass(driverClass);
    return database;
  }

  private static final long NOW = Instant.parse("2026-09-29T12:00:00Z").toEpochMilli();

  private static Trigger behindBy(Duration behind) {
    return auditTriggerNextFiringAt(NOW - behind.toMillis());
  }

  private static Trigger aheadBy(Duration ahead) {
    return auditTriggerNextFiringAt(NOW + ahead.toMillis());
  }

  private static Trigger auditTriggerNextFiringAt(long at) {
    OperableTrigger trigger =
        (OperableTrigger)
            TriggerBuilder.newTrigger()
                .withIdentity(auditTriggerKey())
                .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(5))
                .build();
    trigger.setNextFireTime(new Date(at));
    return trigger;
  }

  private static EventSubscription subscription(int pollSeconds) {
    return new EventSubscription().withId(UUID.randomUUID()).withPollInterval(pollSeconds);
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
    return new JobKey(AuditLogSchedule.AUDIT_LOG_JOB_ID, AuditLogSchedule.AUDIT_LOG_JOB_GROUP);
  }

  private static TriggerKey auditTriggerKey() {
    return new TriggerKey(AuditLogSchedule.AUDIT_LOG_JOB_ID, AuditLogSchedule.AUDIT_LOG_JOB_GROUP);
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
