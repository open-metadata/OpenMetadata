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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkExecutionMode;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkMatchField;
import org.openmetadata.schema.api.data.OntologyBulkMatchMode;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkSubmission;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.service.ontology.OntologyBulkExecutionService.JobScheduler;

class OntologyBulkExecutionServiceTest {
  private static final UUID CREATED_TERM_ID =
      UUID.fromString("45f3e2b4-8262-4a41-a6ba-c178c5959b56");

  @Test
  void persistsOneDraftForAValidNonDrySynchronousPlan() {
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final JobScheduler scheduler = mock(JobScheduler.class);
    final OntologyBulkExecutionService service = service(List.of(), stored, scheduler);

    final OntologyBulkSubmission submission =
        service.submit(
            null,
            OntologyBulkTestFixtures.glossary(),
            OntologyBulkTestFixtures.csvRequest(createCsv(), false),
            OntologyBulkTestFixtures.USER);

    assertEquals(OntologyBulkExecutionMode.SYNCHRONOUS, submission.getExecutionMode());
    assertNotNull(stored.get());
    assertEquals(CREATED_TERM_ID, stored.get().getOperations().getFirst().getTargetId());
    assertEquals(1, stored.get().getUndoCursor());
    assertEquals(stored.get().getId(), submission.getResult().getChangeSet().getId());
    verify(scheduler, never()).schedule(any(), any(), anyInt(), anyString());
  }

  @Test
  void dryRunProducesTheSameTypedCountsWithoutPersistingADraft() {
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final OntologyBulkExecutionService service =
        service(List.of(), stored, mock(JobScheduler.class));

    final OntologyBulkSubmission submission =
        service.submit(
            null,
            OntologyBulkTestFixtures.glossary(),
            OntologyBulkTestFixtures.csvRequest(createCsv(), true),
            OntologyBulkTestFixtures.USER);

    assertEquals(1, submission.getResult().getCreateCount());
    assertNull(submission.getResult().getChangeSet());
    assertNull(stored.get());
  }

  @Test
  void queuesPlansAboveFiveHundredCandidates() {
    final List<GlossaryTerm> terms = manyTerms(501);
    final AtomicReference<OntologyChangeSet> stored = new AtomicReference<>();
    final JobScheduler scheduler = mock(JobScheduler.class);
    final OntologyBulkJob queued = new OntologyBulkJob().withId(41L);
    when(scheduler.schedule(any(), any(), anyInt(), anyString())).thenReturn(queued);
    final OntologyBulkExecutionService service = service(terms, stored, scheduler);
    final OntologyBulkRequest request =
        OntologyBulkTestFixtures.findRequest(
            OntologyBulkMatchField.DESCRIPTION,
            OntologyBulkMatchMode.CONTAINS,
            "customer",
            "client",
            false,
            false);

    final OntologyBulkSubmission submission =
        service.submit(
            null, OntologyBulkTestFixtures.glossary(), request, OntologyBulkTestFixtures.USER);

    assertEquals(OntologyBulkExecutionMode.BACKGROUND, submission.getExecutionMode());
    assertSame(queued, submission.getJob());
    assertNull(stored.get());
    verify(scheduler).schedule(any(), any(), eq(501), anyString());
  }

  private static OntologyBulkExecutionService service(
      final List<GlossaryTerm> terms,
      final AtomicReference<OntologyChangeSet> stored,
      final JobScheduler scheduler) {
    final RelationshipTypeResolver relationshipTypes = mock(RelationshipTypeResolver.class);
    final OntologyBulkPlanner planner =
        new OntologyBulkPlanner(
            glossary -> terms,
            new OntologyBulkCsvPlanner(
                new OntologyBulkCsvParser(),
                new OntologyIriMinter(),
                OntologyBulkTestFixtures.clock()),
            new OntologyFindReplacePlanner(),
            new OntologyRelationshipRetypePlanner(relationshipTypes));
    final OntologyBulkDraftFactory draftFactory =
        new OntologyBulkDraftFactory(
            (uriInfo, changeSet, user, impersonatedBy) -> persist(changeSet, stored));
    return new OntologyBulkExecutionService(
        new OntologyBulkRequestValidator(),
        planner,
        draftFactory,
        new OntologyBulkArtifactFactory(OntologyBulkTestFixtures.clock()),
        scheduler);
  }

  private static OntologyChangeSet persist(
      final OntologyChangeSet changeSet, final AtomicReference<OntologyChangeSet> stored) {
    final OntologyChangeSet persisted =
        changeSet.withFullyQualifiedName(changeSet.getName()).withVersion(0.1D);
    stored.set(persisted);
    return persisted;
  }

  private static List<GlossaryTerm> manyTerms(final int count) {
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                OntologyBulkTestFixtures.term(
                    UUID.nameUUIDFromBytes(("bulk-term-" + index).getBytes(StandardCharsets.UTF_8)),
                    "Customer" + index,
                    "Customer record " + index,
                    null))
        .toList();
  }

  private static String createCsv() {
    return OntologyBulkTestFixtures.header()
        + "\nCREATE,"
        + CREATED_TERM_ID
        + ",Organization,Organization,Organization concept,,\n";
  }
}
