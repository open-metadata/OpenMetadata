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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

/**
 * An alert's job follows the commit of the unit of work that changed its row, and is named in the
 * one form that is read back as that alert.
 */
class AlertJobsTest {
  private final UUID alertId = UUID.randomUUID();

  @AfterEach
  void closeTheUnitOfWork() {
    PostCommitActionQueue.clear();
  }

  @Test
  void convergesOnlyOnceTheUnitOfWorkCommits() {
    try (MockedStatic<AlertJobs> jobs = mockStatic(AlertJobs.class, CALLS_REAL_METHODS)) {
      jobs.when(() -> AlertJobs.converge(any())).thenAnswer(ask -> null);
      PostCommitActionQueue.begin();

      AlertJobs.convergeAfterCommit(alertId);
      jobs.verify(() -> AlertJobs.converge(alertId), never());

      PostCommitActionQueue.run(PostCommitActionQueue.drain());
      jobs.verify(() -> AlertJobs.converge(alertId));
    }
  }

  @Test
  void aUnitOfWorkThatRollsBackConvergesNothing() {
    try (MockedStatic<AlertJobs> jobs = mockStatic(AlertJobs.class, CALLS_REAL_METHODS)) {
      jobs.when(() -> AlertJobs.converge(any())).thenAnswer(ask -> null);
      PostCommitActionQueue.begin();

      AlertJobs.convergeAfterCommit(alertId);
      PostCommitActionQueue.clear();

      jobs.verify(() -> AlertJobs.converge(alertId), never());
    }
  }

  // Jobs stored by earlier releases live under these names, and must still be found.
  @Test
  void jobsLiveWhereEarlierReleasesStoredThem() {
    assertEquals("OMAlertJobGroup", AlertJobs.JOB_GROUP);
    assertEquals("OMAlertJobGroup", AlertJobs.TRIGGER_GROUP);
  }

  // With no unit of work open, the row is already committed.
  @Test
  void withNoUnitOfWorkItConvergesAtOnce() {
    try (MockedStatic<AlertJobs> jobs = mockStatic(AlertJobs.class, CALLS_REAL_METHODS)) {
      jobs.when(() -> AlertJobs.converge(any())).thenAnswer(ask -> null);

      AlertJobs.convergeAfterCommit(alertId);

      jobs.verify(() -> AlertJobs.converge(alertId));
    }
  }

  // UUID.fromString reads every one of these, but each is another key than the one written.
  @Test
  void onlyTheCanonicalTextOfAnIdNamesAnAlert() {
    assertEquals(Optional.of(alertId), AlertJobs.alertIdOf(AlertJobs.jobKey(alertId)));
    String canonical = alertId.toString();
    for (String other :
        List.of(canonical.toUpperCase(Locale.ROOT), " " + canonical, "1-2-3-4-5", "stray", "")) {
      assertEquals(Optional.empty(), AlertJobs.alertIdOf(new JobKey(other, AlertJobs.JOB_GROUP)));
    }
    assertEquals(Optional.empty(), AlertJobs.alertIdOf((String) null));
    assertEquals(Optional.empty(), AlertJobs.alertIdOf(new JobKey(canonical, "OtherGroup")));
  }

  // A case-insensitive store reads a case variant as the alert's own row; a strict one does not.
  @Test
  void aVariantIsTheAlertsJobOnlyWhenTheStoreReadsItAsOne() throws SchedulerException {
    JobKey variant = new JobKey(alertId.toString().toUpperCase(Locale.ROOT), AlertJobs.JOB_GROUP);

    assertEquals(Optional.of(alertId), AlertJobs.alertOf(tick(variant, storing(variant))));
    assertEquals(
        Optional.empty(), AlertJobs.alertOf(tick(variant, storing(AlertJobs.jobKey(alertId)))));
    assertEquals(Optional.empty(), AlertJobs.alertOf(tick(variant, storing(null))));
  }

  @Test
  void aStoreThatCannotAnswerLeavesTheTickUndecided() throws SchedulerException {
    Scheduler scheduler = mock(Scheduler.class);
    when(scheduler.getJobDetail(any())).thenThrow(new SchedulerException("store down"));
    JobKey variant = new JobKey(alertId.toString().toUpperCase(Locale.ROOT), AlertJobs.JOB_GROUP);

    assertThrows(SchedulerException.class, () -> AlertJobs.alertOf(tick(variant, scheduler)));
  }

  @Test
  void aKeyInALogLineIsBoundedAndCannotStartALine() {
    assertEquals("stray?line", AlertJobs.printable("stray\nline"));
    assertEquals(67, AlertJobs.printable("x".repeat(190)).length());
  }

  private Scheduler storing(JobKey stored) throws SchedulerException {
    Scheduler scheduler = mock(Scheduler.class);
    JobDetail job =
        stored == null
            ? null
            : JobBuilder.newJob(AlertPublisher.class).withIdentity(stored).build();
    when(scheduler.getJobDetail(AlertJobs.jobKey(alertId))).thenReturn(job);
    return scheduler;
  }

  private static JobExecutionContext tick(JobKey key, Scheduler scheduler) {
    JobExecutionContext tick = mock(JobExecutionContext.class);
    when(tick.getJobDetail())
        .thenReturn(JobBuilder.newJob(AlertPublisher.class).withIdentity(key).build());
    when(tick.getScheduler()).thenReturn(scheduler);
    return tick;
  }
}
