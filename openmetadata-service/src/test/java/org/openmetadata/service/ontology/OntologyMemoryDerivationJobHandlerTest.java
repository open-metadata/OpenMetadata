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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.OntologyMemoryDerivationOutcome;
import org.openmetadata.schema.api.data.OntologyMemoryDerivationResult;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobDAO;

class OntologyMemoryDerivationJobHandlerTest {
  private final OntologyMemoryDerivationService service =
      mock(OntologyMemoryDerivationService.class);
  private final JobDAO jobDao = mock(JobDAO.class);

  @Test
  void disabledFeatureFailsQueuedJobsWithoutCallingTheModel() {
    final OntologyMemoryDerivationJobHandler handler =
        new OntologyMemoryDerivationJobHandler(service, jobDao, () -> false);

    assertThrows(BackgroundJobException.class, () -> handler.runJob(job(1L, UUID.randomUUID())));

    final ArgumentCaptor<String> error = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .failJob(eq(1L), eq("FAILED"), error.capture(), error.capture(), anyLong(), anyLong());
    assertTrue(error.getValue().contains(OntologyMemoryDerivationJobHandler.DISABLED_MESSAGE));
    verifyNoInteractions(service);
  }

  @Test
  void runsWithTheBatchAsStoredWhenTheWorkerStarts() throws BackgroundJobException {
    final UUID first = UUID.randomUUID();
    final UUID appended = UUID.randomUUID();
    when(jobDao.fetchJobById(2L)).thenReturn(Optional.of(job(2L, first, appended)));
    when(service.derive(2L, null, List.of(first, appended), "admin")).thenReturn(Optional.empty());

    new OntologyMemoryDerivationJobHandler(service, jobDao, () -> true).runJob(job(2L, first));

    final ArgumentCaptor<String> result = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .completeJob(
            eq(2L),
            eq("COMPLETED"),
            result.capture(),
            eq("No new glossary terms proposed"),
            eq(1),
            eq(1),
            anyLong(),
            anyLong());
    assertNull(
        JsonUtils.readValue(result.getValue(), OntologyMemoryDerivationJobHandler.Result.class)
            .changeSetId());
  }

  @Test
  void outcomeDistinguishesProposalsEmptyResultsAndFailures() {
    final BackgroundJob proposed =
        finished(BackgroundJob.Status.COMPLETED)
            .withResult(
                JsonUtils.pojoToJson(
                    new OntologyMemoryDerivationJobHandler.Result(UUID.randomUUID())));
    final BackgroundJob empty =
        finished(BackgroundJob.Status.COMPLETED)
            .withResult(JsonUtils.pojoToJson(new OntologyMemoryDerivationJobHandler.Result(null)));
    final BackgroundJob failed =
        finished(BackgroundJob.Status.FAILED).withMessage("Job stopped responding");

    assertEquals(
        OntologyMemoryDerivationResult.PROPOSED,
        OntologyMemoryDerivationJobHandler.outcome(proposed).getResult());
    assertEquals(
        OntologyMemoryDerivationResult.NO_NEW_TERMS,
        OntologyMemoryDerivationJobHandler.outcome(empty).getResult());
    final OntologyMemoryDerivationOutcome failure =
        OntologyMemoryDerivationJobHandler.outcome(failed);
    assertEquals(OntologyMemoryDerivationResult.FAILED, failure.getResult());
    assertEquals("Job stopped responding", failure.getMessage());
    assertEquals(5L, failure.getCompletedAt());
  }

  private static BackgroundJob finished(final BackgroundJob.Status status) {
    return new BackgroundJob().withId(3L).withStatus(status).withCompletedAt(5L);
  }

  private static BackgroundJob job(final long id, final UUID... memoryIds) {
    return new BackgroundJob()
        .withId(id)
        .withCreatedBy("admin")
        .withJobType(BackgroundJob.JobType.ONTOLOGY_MEMORY_DERIVATION)
        .withJobArgs(Map.of("memoryIds", List.of(memoryIds).stream().map(UUID::toString).toList()));
  }
}
