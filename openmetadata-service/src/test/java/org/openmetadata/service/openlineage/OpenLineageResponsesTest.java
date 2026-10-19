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

package org.openmetadata.service.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.openlineage.FailedEvent;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse.Status;
import org.openmetadata.schema.api.lineage.openlineage.ProcessingSummary;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedEntity;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason;

class OpenLineageResponsesTest {

  private static final UnresolvedEntity MISSING_TABLE =
      new UnresolvedEntity()
          .withNamespace("postgres://host:5432")
          .withName("db.public.missing")
          .withReason(UnresolvedReason.NAMESPACE_NOT_MAPPED);
  private static final UnresolvedEntity MISSING_JOB =
      new UnresolvedEntity()
          .withNamespace("spark")
          .withName("nightly_job")
          .withReason(UnresolvedReason.PIPELINE_NOT_FOUND);

  @Test
  void eventWithEverythingResolvedIsSuccess() {
    OpenLineageResponse response = OpenLineageResponses.forEvent(plan(List.of(), List.of()), 2);

    assertEquals(Status.SUCCESS, response.getStatus());
    assertEquals("Created 2 lineage edge(s)", response.getMessage());
    assertEquals(2, response.getLineageEdgesCreated());
    assertTrue(response.getUnresolvedDatasets().isEmpty());
  }

  @Test
  void eventThatWroteSomeEdgesButLeftDatasetsOutIsPartialSuccess() {
    OpenLineageResponse response =
        OpenLineageResponses.forEvent(plan(List.of(MISSING_TABLE), List.of()), 1);

    assertEquals(Status.PARTIAL_SUCCESS, response.getStatus());
    assertEquals(List.of(MISSING_TABLE), response.getUnresolvedDatasets());
  }

  @Test
  void eventThatWroteNothingBecauseDatasetsDidNotResolveIsFailure() {
    OpenLineageResponse response =
        OpenLineageResponses.forEvent(plan(List.of(MISSING_TABLE), List.of()), 0);

    assertEquals(Status.FAILURE, response.getStatus());
    assertEquals(
        "No lineage edges created: 1 dataset(s) could not be resolved", response.getMessage());
  }

  @Test
  void skippedEventIsSuccessWithNoEdges() {
    OpenLineageResponse response =
        OpenLineageResponses.forEvent(OpenLineageEventPlan.skippedEvent(), 0);

    assertEquals(Status.SUCCESS, response.getStatus());
    assertEquals(OpenLineageResponses.NO_EDGES_MESSAGE, response.getMessage());
  }

  @Test
  void unresolvedJobAloneDoesNotFailTheEvent() {
    OpenLineageResponse response =
        OpenLineageResponses.forEvent(plan(List.of(), List.of(MISSING_JOB)), 1);

    assertEquals(Status.SUCCESS, response.getStatus());
    assertEquals(List.of(MISSING_JOB), response.getUnresolvedJobs());
  }

  @Test
  void batchCountsEachOutcomeAndIndexesWhatDidNotResolve() {
    OpenLineageResponses.BatchOutcome outcome = new OpenLineageResponses.BatchOutcome(5);
    outcome.record(0, plan(List.of(), List.of()), 2);
    outcome.record(1, plan(List.of(MISSING_TABLE), List.of(MISSING_JOB)), 1);
    outcome.record(2, plan(List.of(MISSING_TABLE), List.of()), 0);
    outcome.record(3, OpenLineageEventPlan.skippedEvent(), 0);
    outcome.recordFailure(4, "boom");

    OpenLineageResponse response = outcome.toResponse();
    ProcessingSummary summary = response.getSummary();

    assertEquals(Status.PARTIAL_SUCCESS, response.getStatus());
    assertEquals(5, summary.getReceived());
    assertEquals(1, summary.getSuccessful());
    assertEquals(1, summary.getPartial());
    assertEquals(2, summary.getFailed());
    assertEquals(1, summary.getSkipped());
    assertEquals(3, response.getLineageEdgesCreated());
    assertEquals(
        List.of(2, 4), response.getFailedEvents().stream().map(FailedEvent::getIndex).toList());
    assertEquals(
        List.of(1, 2),
        response.getUnresolvedDatasets().stream().map(UnresolvedEntity::getEventIndex).toList());
    assertEquals(1, response.getUnresolvedJobs().getFirst().getEventIndex());
    assertNull(MISSING_TABLE.getEventIndex(), "the plan's own entries must not be modified");
    assertFalse(outcome.allFailed());
  }

  @Test
  void batchWhereEveryEventFailedIsFailure() {
    OpenLineageResponses.BatchOutcome outcome = new OpenLineageResponses.BatchOutcome(2);
    outcome.record(0, plan(List.of(MISSING_TABLE), List.of()), 0);
    outcome.recordFailure(1, "boom");

    assertEquals(Status.FAILURE, outcome.toResponse().getStatus());
    assertTrue(outcome.allFailed());
  }

  @Test
  void batchWithOnlyFailuresAndSkipsIsFailureButNotAllFailed() {
    OpenLineageResponses.BatchOutcome outcome = new OpenLineageResponses.BatchOutcome(2);
    outcome.record(0, OpenLineageEventPlan.skippedEvent(), 0);
    outcome.record(1, plan(List.of(MISSING_TABLE), List.of()), 0);

    assertEquals(Status.FAILURE, outcome.toResponse().getStatus());
    assertFalse(outcome.allFailed());
  }

  private static OpenLineageEventPlan plan(
      List<UnresolvedEntity> unresolvedDatasets, List<UnresolvedEntity> unresolvedJobs) {
    return new OpenLineageEventPlan(false, List.of(), unresolvedDatasets, unresolvedJobs);
  }
}
