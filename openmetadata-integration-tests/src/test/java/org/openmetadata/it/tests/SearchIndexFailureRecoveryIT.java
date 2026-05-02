/*
 *  Copyright 2024 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord;

/**
 * Integration tests for the SearchIndexingApplication's orphaned-job recovery mechanism.
 *
 * <p>Each test inserts a stale job record into the database to simulate a crash or hang,
 * then triggers a fresh reindex to verify that the recovery manager detects and cleans up
 * the orphan before the new job proceeds successfully.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SearchIndexFailureRecoveryIT extends SearchIndexTestBase {

  private static CollectionDAO collectionDAO;
  private static SearchIndexJobDAO jobDAO;

  private static final long TWO_HOURS_MS = 2L * 60L * 60L * 1000L;
  private static final long ONE_MINUTE_MS = 60L * 1000L;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
    collectionDAO = Entity.getCollectionDAO();
    jobDAO = collectionDAO.searchIndexJobDAO();
  }

  @Test
  @Order(1)
  void orphanedOldJob_isMarkedFailed_onFreshTrigger(TestNamespace ns) {
    waitForIdle();

    String orphanId = UUID.randomUUID().toString();
    long twoHoursAgo = System.currentTimeMillis() - TWO_HOURS_MS;
    jobDAO.insert(
        orphanId,
        "RUNNING",
        "{}",
        null,
        0L,
        0L,
        0L,
        0L,
        null,
        "test",
        twoHoursAgo,
        twoHoursAgo,
        null);

    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Fresh job should succeed, got: " + statusOf(run));

    List<SearchIndexJobRecord> activeJobs =
        jobDAO.findByStatuses(List.of("RUNNING", "INITIALIZING"));
    boolean orphanStillActive = activeJobs.stream().anyMatch(j -> j.id().equals(orphanId));
    assertFalse(
        orphanStillActive,
        "Orphaned RUNNING job should have been cleaned up and must not remain active");

    SearchIndexJobRecord orphan = jobDAO.findById(orphanId);
    assertNotNull(orphan, "Orphaned job record should still exist in the DB");
    assertTrue(
        "FAILED".equals(orphan.status()) || "STOPPED".equals(orphan.status()),
        "Orphaned old RUNNING job should be FAILED or STOPPED after recovery, got: "
            + orphan.status());
  }

  @Test
  @Order(2)
  void orphanedInitializingJob_isMarkedFailed_onFreshTrigger(TestNamespace ns) {
    waitForIdle();

    String orphanId = UUID.randomUUID().toString();
    long twoHoursAgo = System.currentTimeMillis() - TWO_HOURS_MS;
    jobDAO.insert(
        orphanId,
        "INITIALIZING",
        "{}",
        null,
        0L,
        0L,
        0L,
        0L,
        null,
        "test",
        twoHoursAgo,
        twoHoursAgo,
        null);

    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Fresh job should succeed, got: " + statusOf(run));

    List<SearchIndexJobRecord> activeJobs =
        jobDAO.findByStatuses(List.of("RUNNING", "INITIALIZING"));
    boolean orphanStillActive = activeJobs.stream().anyMatch(j -> j.id().equals(orphanId));
    assertFalse(
        orphanStillActive, "Orphaned INITIALIZING job should not remain active after recovery");

    SearchIndexJobRecord orphan = jobDAO.findById(orphanId);
    if (orphan != null) {
      assertTrue(
          "FAILED".equals(orphan.status()) || "STOPPED".equals(orphan.status()),
          "Orphaned INITIALIZING job should be FAILED or STOPPED, got: " + orphan.status());
    }
  }

  @Test
  @Order(3)
  void cleanStartup_noOrphanedJobs_freshTriggerSucceeds(TestNamespace ns) {
    waitForIdle();

    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Clean trigger should succeed, got: " + statusOf(run));
  }

  @Test
  @Order(4)
  void stoppingJobOrphan_isForceCompleted(TestNamespace ns) {
    waitForIdle();

    String stoppingJobId = UUID.randomUUID().toString();
    long sixtySecondsAgo = System.currentTimeMillis() - ONE_MINUTE_MS;
    jobDAO.insert(
        stoppingJobId,
        "STOPPING",
        "{}",
        null,
        0L,
        0L,
        0L,
        0L,
        null,
        "test",
        sixtySecondsAgo,
        sixtySecondsAgo,
        null);

    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Fresh job should succeed, got: " + statusOf(run));

    List<SearchIndexJobRecord> activeJobs =
        jobDAO.findByStatuses(List.of("RUNNING", "STOPPING", "INITIALIZING"));
    boolean orphanStillActive = activeJobs.stream().anyMatch(j -> j.id().equals(stoppingJobId));
    assertFalse(orphanStillActive, "Stale STOPPING job should not remain active after recovery");

    SearchIndexJobRecord stoppingOrphan = jobDAO.findById(stoppingJobId);
    if (stoppingOrphan != null) {
      assertTrue(
          "STOPPED".equals(stoppingOrphan.status()) || "FAILED".equals(stoppingOrphan.status()),
          "Stale STOPPING orphan should be force-completed to STOPPED or FAILED, got: "
              + stoppingOrphan.status());
    }
  }

  private boolean isSuccessful(AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return false;
    }
    String status = run.getStatus().value();
    return "success".equals(status) || "completed".equals(status);
  }

  private String statusOf(AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return "null";
    }
    return run.getStatus().value();
  }
}
