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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkJobArguments;
import org.openmetadata.schema.api.data.OntologyBulkJobStatus;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.JobDAO;

class OntologyBulkJobManagerTest {
  private static final long JOB_ID = 71L;

  @Test
  void schedulesTypedArgumentsAndMapsThePersistedJob() {
    final JobDAO jobDao = mock(JobDAO.class);
    final OntologyBulkRequest request =
        OntologyBulkTestFixtures.csvRequest(OntologyBulkTestFixtures.header() + '\n', true);
    final BackgroundJob backgroundJob = backgroundJob(request, BackgroundJob.Status.PENDING, null);
    when(jobDao.insertTrackedJobInternal(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            isNull(),
            anyInt(),
            anyInt(),
            anyString()))
        .thenReturn(JOB_ID);
    when(jobDao.findOntologyBulkJobById(JOB_ID)).thenReturn(backgroundJob);
    final OntologyBulkJobManager manager = manager(jobDao);

    final OntologyBulkJob job =
        manager.schedule(
            OntologyBulkTestFixtures.glossary(), request, 620, OntologyBulkTestFixtures.USER);

    assertEquals(JOB_ID, job.getId());
    assertEquals(OntologyBulkJobStatus.QUEUED, job.getStatus());
    assertEquals(620, job.getTotal());
    assertFalse(job.getCancelRequested());
    final ArgumentCaptor<String> arguments = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .insertTrackedJobInternal(
            eq(BackgroundJob.JobType.ONTOLOGY_BULK.name()),
            eq(OntologyBulkJobManager.HANDLER_NAME),
            arguments.capture(),
            eq(OntologyBulkTestFixtures.USER),
            isNull(),
            eq(0),
            eq(620),
            anyString());
    final OntologyBulkJobArguments persisted =
        JsonUtils.readValue(arguments.getValue(), OntologyBulkJobArguments.class);
    assertEquals(request.getGlossaryId(), persisted.getRequest().getGlossaryId());
  }

  @Test
  void returnsTypedArtifactsAndForwardsCancellation() {
    final JobDAO jobDao = mock(JobDAO.class);
    final OntologyBulkRequest request =
        OntologyBulkTestFixtures.csvRequest(OntologyBulkTestFixtures.header() + '\n', true);
    final OntologyBulkResultArtifact artifact =
        new OntologyBulkResultArtifact()
            .withId(UUID.randomUUID())
            .withOperation(request.getOperation());
    final BackgroundJob backgroundJob =
        backgroundJob(request, BackgroundJob.Status.COMPLETED, JsonUtils.pojoToJson(artifact));
    when(jobDao.findOntologyBulkJobById(JOB_ID)).thenReturn(backgroundJob);
    final OntologyBulkJobManager manager = manager(jobDao);

    assertEquals(artifact.getId(), manager.artifact(JOB_ID).getId());
    assertSame(backgroundJob, jobDao.findOntologyBulkJobById(JOB_ID));
    manager.requestCancel(JOB_ID);

    verify(jobDao).requestCancel(JOB_ID, "Cancellation requested.", OntologyBulkTestFixtures.NOW);
  }

  @Test
  void completesWithACompactTypedResultAndRecoversStaleJobs() {
    final JobDAO jobDao = mock(JobDAO.class);
    final OntologyBulkJobManager manager = manager(jobDao);
    final OntologyBulkResultArtifact artifact =
        new OntologyBulkResultArtifact().withId(UUID.randomUUID());

    manager.complete(JOB_ID, artifact, 640);
    manager.markStaleJobsFailed();

    verify(jobDao)
        .completeJob(
            eq(JOB_ID),
            eq(BackgroundJob.Status.COMPLETED.name()),
            anyString(),
            anyString(),
            eq(640),
            eq(640),
            eq(OntologyBulkTestFixtures.NOW),
            eq(OntologyBulkTestFixtures.NOW));
    verify(jobDao).markStaleRunningOntologyBulkJobsFailed(OntologyBulkTestFixtures.NOW);
  }

  private static OntologyBulkJobManager manager(final JobDAO jobDao) {
    return new OntologyBulkJobManager(jobDao, OntologyBulkTestFixtures.clock());
  }

  private static BackgroundJob backgroundJob(
      final OntologyBulkRequest request, final BackgroundJob.Status status, final String result) {
    final OntologyBulkJobArguments arguments =
        new OntologyBulkJobArguments()
            .withRequest(request)
            .withGlossary(OntologyBulkTestFixtures.glossary().getEntityReference());
    return new BackgroundJob()
        .withId(JOB_ID)
        .withJobType(BackgroundJob.JobType.ONTOLOGY_BULK)
        .withMethodName(OntologyBulkJobManager.HANDLER_NAME)
        .withJobArgs(arguments)
        .withStatus(status)
        .withProgress(0)
        .withTotal(620)
        .withResult(result)
        .withCancelRequested(false)
        .withCreatedBy(OntologyBulkTestFixtures.USER)
        .withCreatedAt(OntologyBulkTestFixtures.NOW)
        .withUpdatedAt(OntologyBulkTestFixtures.NOW);
  }
}
