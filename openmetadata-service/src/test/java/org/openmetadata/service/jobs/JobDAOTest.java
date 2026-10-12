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

package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.Optional;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.ontology.OntologyMemoryDerivationJobHandler;

class JobDAOTest {
  private static final String ONTOLOGY_BULK_FILTER = "'ONTOLOGY_BULK'";
  private static final String RUNNING_FILTER = "status = 'RUNNING'";
  private static final String STALENESS_FILTER = "updatedAt < :staleBefore";

  @Test
  void pendingJobQueriesReserveWorkerCapacityForBothMemoryJobTypes() throws NoSuchMethodException {
    final ConnectionAwareSqlQuery[] queries =
        JobDAO.class
            .getMethod("fetchPendingJobInternal", boolean.class)
            .getAnnotationsByType(ConnectionAwareSqlQuery.class);

    assertEquals(2, queries.length);
    for (ConnectionAwareSqlQuery query : queries) {
      assertTrue(query.value().contains(":includeMemoryJobs = true OR jobType NOT IN"));
      assertTrue(query.value().contains("'CONTEXT_MEMORY_EXTRACTION'"));
      assertTrue(query.value().contains("'ONTOLOGY_MEMORY_DERIVATION'"));
    }
  }

  @Test
  void staleWorkerRecoveryIsHeartbeatScopedAndIncludesOntologyJobs() throws NoSuchMethodException {
    final Method method =
        JobDAO.class.getMethod("markStaleRunningJobsFailed", long.class, long.class);
    final SqlUpdate update = method.getAnnotation(SqlUpdate.class);

    assertNotNull(update);
    assertTrue(update.value().contains(ONTOLOGY_BULK_FILTER));
    assertTrue(update.value().contains(RUNNING_FILTER));
    assertTrue(update.value().contains(STALENESS_FILTER));
    assertEquals(2, method.getParameterCount());
  }

  @Test
  void staleWorkerRecoveryReapsMemoryDerivationJobs() throws NoSuchMethodException {
    final SqlUpdate update =
        JobDAO.class
            .getMethod("markStaleRunningJobsFailed", long.class, long.class)
            .getAnnotation(SqlUpdate.class);

    assertTrue(
        update
            .value()
            .contains("'" + BackgroundJob.JobType.ONTOLOGY_MEMORY_DERIVATION.name() + "'"));
  }

  @Test
  void memoryDerivationJobsTargetTheirRegisteredHandler() {
    assertEquals(
        OntologyMemoryDerivationJobHandler.HANDLER_NAME, JobDAO.ONTOLOGY_MEMORY_DERIVATION_HANDLER);
  }

  @Test
  void memoryBatchAppendsToAnOpenPendingJob() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockMemoryForOntologyQueue("memory-id")).thenReturn("memory-id");
    when(jobDao.lockOpenOntologyMemoryBatch(
            "contextFile:file-id",
            JobDAO.ONTOLOGY_MEMORY_BATCH_LIMIT,
            JobDAO.ONTOLOGY_MEMORY_BATCH_APPEND_MARGIN_MS))
        .thenReturn(7L);
    when(jobDao.appendToOntologyMemoryBatch(7L, "memory-id")).thenReturn(1);

    assertEquals(
        Optional.of(7L),
        jobDao.enqueueOntologyMemoryDerivationBatch(
            "memory-id", "contextFile:file-id", "{}", "admin", 100L));
    verify(jobDao, never()).insertJobInternal(any(), any(), any(), any(), any());
  }

  @Test
  void memoryBatchStartsANewDelayedJobWhenNoneIsOpen() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockMemoryForOntologyQueue("memory-id")).thenReturn("memory-id");
    when(jobDao.insertJobInternal(
            BackgroundJob.JobType.ONTOLOGY_MEMORY_DERIVATION.name(),
            JobDAO.ONTOLOGY_MEMORY_DERIVATION_HANDLER,
            "{}",
            "admin",
            100L))
        .thenReturn(8L);

    assertEquals(
        Optional.of(8L),
        jobDao.enqueueOntologyMemoryDerivationBatch(
            "memory-id", "contextFile:file-id", "{}", "admin", 100L));
  }

  @Test
  void memoryBatchSkipsAMemoryAlreadyInFlight() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockMemoryForOntologyQueue("memory-id")).thenReturn("memory-id");
    when(jobDao.countInFlightOntologyMemoryJobs("memory-id")).thenReturn(1);

    assertTrue(
        jobDao
            .enqueueOntologyMemoryDerivationBatch(
                "memory-id", "contextFile:file-id", "{}", "admin", 100L)
            .isEmpty());
    verify(jobDao, never()).insertJobInternal(any(), any(), any(), any(), any());
  }

  @Test
  void pageQueueReschedulesAnExistingPendingJob() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockPageForMemoryQueue("page-id")).thenReturn("page-id");
    when(jobDao.findPendingMemoryJobId("page:page-id")).thenReturn(42L);
    when(jobDao.reschedulePendingMemoryJob(42L, 100L, 50L)).thenReturn(1);

    jobDao.enqueuePageMemoryJob(
        "page-id", "page:page-id", "{\"jobKey\":\"page:page-id\"}", "admin", 100L, 50L);

    verify(jobDao, never())
        .insertJobInternal(
            BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
            "ContextMemoryExtractionJobHandler",
            "{\"jobKey\":\"page:page-id\"}",
            "admin",
            100L);
  }

  @Test
  void pageQueueInsertsWhenNoPendingJobExists() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockPageForMemoryQueue("page-id")).thenReturn("page-id");

    jobDao.enqueuePageMemoryJob(
        "page-id", "page:page-id", "{\"jobKey\":\"page:page-id\"}", "admin", 100L, 50L);

    verify(jobDao)
        .insertJobInternal(
            BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
            "ContextMemoryExtractionJobHandler",
            "{\"jobKey\":\"page:page-id\"}",
            "admin",
            100L);
  }

  @Test
  void pageQueueInsertsWhenThePendingJobWasClaimed() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockPageForMemoryQueue("page-id")).thenReturn("page-id");
    when(jobDao.findPendingMemoryJobId("page:page-id")).thenReturn(42L);

    jobDao.enqueuePageMemoryJob(
        "page-id", "page:page-id", "{\"jobKey\":\"page:page-id\"}", "admin", 100L, 50L);

    verify(jobDao)
        .insertJobInternal(
            BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
            "ContextMemoryExtractionJobHandler",
            "{\"jobKey\":\"page:page-id\"}",
            "admin",
            100L);
  }

  @Test
  void pageQueueSkipsADeletedSource() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);

    jobDao.enqueuePageMemoryJob(
        "missing", "page:missing", "{\"jobKey\":\"page:missing\"}", "admin", 100L, 50L);

    verify(jobDao, never()).findPendingMemoryJobId("page:missing");
  }

  @Test
  void fileQueueInsertsOnlyWhenTheContentHasNoActiveJob() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockFileForMemoryQueue("file-id")).thenReturn("file-id");

    jobDao.enqueueFileMemoryJob("file-id", "contextFile:file-id:content-id", "{}", "admin", true);

    when(jobDao.countInFlightMemoryJobs("contextFile:file-id:content-id", true)).thenReturn(1);
    jobDao.enqueueFileMemoryJob("file-id", "contextFile:file-id:content-id", "{}", "admin", true);

    verify(jobDao, times(2)).countInFlightMemoryJobs("contextFile:file-id:content-id", true);
    verify(jobDao)
        .insertJobInternal(
            BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
            "ContextMemoryExtractionJobHandler",
            "{}",
            "admin",
            null);
  }

  @Test
  void fileRetryCanQueueWhileTheOriginalJobIsRunning() {
    JobDAO jobDao = mock(JobDAO.class, CALLS_REAL_METHODS);
    when(jobDao.lockFileForMemoryQueue("file-id")).thenReturn("file-id");

    jobDao.enqueueFileMemoryJob("file-id", "contextFile:file-id:content-id", "{}", "admin", false);

    verify(jobDao).countInFlightMemoryJobs("contextFile:file-id:content-id", false);
    verify(jobDao)
        .insertJobInternal(
            BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
            "ContextMemoryExtractionJobHandler",
            "{}",
            "admin",
            null);
  }
}
