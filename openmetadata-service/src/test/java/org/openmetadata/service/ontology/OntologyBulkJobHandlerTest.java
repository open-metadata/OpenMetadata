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

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkJobArguments;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.jobs.BackgroundJobException;

class OntologyBulkJobHandlerTest {
  private static final long JOB_ID = 91L;

  @Test
  void executesTypedArgumentsAndCompletesWithTheArtifact() {
    final Fixture fixture = fixture();
    final OntologyBulkResultArtifact artifact = new OntologyBulkResultArtifact().withTotalRows(650);
    when(fixture.service().execute(any(), any(), eq(fixture.arguments().getRequest()), anyString()))
        .thenReturn(artifact);

    fixture.handler().runJob(fixture.job());

    verify(fixture.jobManager()).markRunning(JOB_ID);
    verify(fixture.jobManager()).checkpoint(JOB_ID);
    verify(fixture.jobManager()).complete(JOB_ID, artifact, 650);
  }

  @Test
  void marksCancellationWithoutCreatingAChangeSet() {
    final Fixture fixture = fixture();
    doThrow(new OntologyBulkJobCancelledException(JOB_ID))
        .when(fixture.jobManager())
        .checkpoint(JOB_ID);

    fixture.handler().runJob(fixture.job());

    verify(fixture.jobManager()).cancel(JOB_ID);
    verify(fixture.service(), never()).execute(any(), any(), any(), anyString());
  }

  @Test
  void persistsFailureContextAndSignalsTheWorker() {
    final Fixture fixture = fixture();
    when(fixture.service().execute(any(), any(), any(), anyString()))
        .thenThrow(new IllegalArgumentException("Invalid bulk operation"));

    assertThrows(BackgroundJobException.class, () -> fixture.handler().runJob(fixture.job()));

    verify(fixture.jobManager()).fail(JOB_ID, "Invalid bulk operation");
  }

  private static Fixture fixture() {
    final OntologyBulkExecutionService service = mock(OntologyBulkExecutionService.class);
    final OntologyBulkJobManager jobManager = mock(OntologyBulkJobManager.class);
    final OntologyBulkRequest request =
        OntologyBulkTestFixtures.csvRequest(OntologyBulkTestFixtures.header() + '\n', true);
    final OntologyBulkJobArguments arguments =
        new OntologyBulkJobArguments()
            .withRequest(request)
            .withGlossary(OntologyBulkTestFixtures.glossary().getEntityReference());
    final BackgroundJob job =
        new BackgroundJob().withId(JOB_ID).withCreatedBy(OntologyBulkTestFixtures.USER);
    when(jobManager.arguments(job)).thenReturn(arguments);
    final OntologyBulkJobHandler handler =
        new OntologyBulkJobHandler(service, jobManager, id -> OntologyBulkTestFixtures.glossary());
    return new Fixture(service, jobManager, handler, arguments, job);
  }

  private record Fixture(
      OntologyBulkExecutionService service,
      OntologyBulkJobManager jobManager,
      OntologyBulkJobHandler handler,
      OntologyBulkJobArguments arguments,
      BackgroundJob job) {}
}
