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

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.lineage.openlineage.FailedEvent;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse.Status;
import org.openmetadata.schema.api.lineage.openlineage.ProcessingSummary;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedEntity;

/**
 * Turns event plans, and the edges actually written for them, into the OpenLineage API response.
 * An event is a failure only when datasets went unresolved and nothing could be written; when some
 * edges were written it is a partial success that still names what was left out.
 */
public final class OpenLineageResponses {

  static final String NO_EDGES_MESSAGE = "Event processed, no lineage edges created";

  private OpenLineageResponses() {}

  public static OpenLineageResponse forEvent(OpenLineageEventPlan plan, int edgesCreated) {
    Status status = statusOf(plan, edgesCreated);
    return new OpenLineageResponse()
        .withStatus(status)
        .withMessage(messageFor(status, plan, edgesCreated))
        .withLineageEdgesCreated(edgesCreated)
        .withUnresolvedDatasets(new ArrayList<>(plan.unresolvedDatasets()))
        .withUnresolvedJobs(new ArrayList<>(plan.unresolvedJobs()));
  }

  static Status statusOf(OpenLineageEventPlan plan, int edgesCreated) {
    Status status = Status.SUCCESS;
    if (!plan.unresolvedDatasets().isEmpty()) {
      status = edgesCreated > 0 ? Status.PARTIAL_SUCCESS : Status.FAILURE;
    }
    return status;
  }

  private static String messageFor(Status status, OpenLineageEventPlan plan, int edgesCreated) {
    int unresolved = plan.unresolvedDatasets().size();
    return switch (status) {
      case SUCCESS -> edgesCreated > 0
          ? String.format("Created %d lineage edge(s)", edgesCreated)
          : NO_EDGES_MESSAGE;
      case PARTIAL_SUCCESS -> String.format(
          "Created %d lineage edge(s); %d dataset(s) could not be resolved",
          edgesCreated, unresolved);
      case FAILURE -> String.format(
          "No lineage edges created: %d dataset(s) could not be resolved", unresolved);
    };
  }

  /** Accumulates the per-event results of a batch request into one response. */
  public static final class BatchOutcome {
    private final int received;
    private final List<FailedEvent> failedEvents = new ArrayList<>();
    private final List<UnresolvedEntity> unresolvedDatasets = new ArrayList<>();
    private final List<UnresolvedEntity> unresolvedJobs = new ArrayList<>();
    private int successful;
    private int partial;
    private int failed;
    private int skipped;
    private int edgesCreated;

    public BatchOutcome(int received) {
      this.received = received;
    }

    public void record(int index, OpenLineageEventPlan plan, int eventEdgesCreated) {
      edgesCreated += eventEdgesCreated;
      unresolvedDatasets.addAll(atEventIndex(plan.unresolvedDatasets(), index));
      unresolvedJobs.addAll(atEventIndex(plan.unresolvedJobs(), index));
      Status status = statusOf(plan, eventEdgesCreated);
      switch (status) {
        case SUCCESS -> countWritten(eventEdgesCreated);
        case PARTIAL_SUCCESS -> partial++;
        case FAILURE -> recordFailure(index, messageFor(status, plan, eventEdgesCreated));
      }
    }

    public void recordFailure(int index, String reason) {
      failed++;
      failedEvents.add(new FailedEvent().withIndex(index).withReason(reason).withRetriable(false));
    }

    public boolean allFailed() {
      return received > 0 && failed == received;
    }

    public OpenLineageResponse toResponse() {
      return new OpenLineageResponse()
          .withStatus(overallStatus())
          .withMessage(
              String.format(
                  "Processed %d events: %d successful, %d partial, %d failed, %d skipped. "
                      + "Created %d lineage edges.",
                  received, successful, partial, failed, skipped, edgesCreated))
          .withSummary(
              new ProcessingSummary()
                  .withReceived(received)
                  .withSuccessful(successful)
                  .withPartial(partial)
                  .withFailed(failed)
                  .withSkipped(skipped))
          .withFailedEvents(failedEvents.isEmpty() ? null : failedEvents)
          .withUnresolvedDatasets(unresolvedDatasets)
          .withUnresolvedJobs(unresolvedJobs)
          .withLineageEdgesCreated(edgesCreated);
    }

    private void countWritten(int eventEdgesCreated) {
      if (eventEdgesCreated > 0) {
        successful++;
      } else {
        skipped++;
      }
    }

    private Status overallStatus() {
      Status status = Status.SUCCESS;
      if (failed > 0 || partial > 0) {
        status = successful + partial > 0 ? Status.PARTIAL_SUCCESS : Status.FAILURE;
      }
      return status;
    }

    private static List<UnresolvedEntity> atEventIndex(List<UnresolvedEntity> entities, int index) {
      return entities.stream()
          .map(
              entity ->
                  new UnresolvedEntity()
                      .withEventIndex(index)
                      .withNamespace(entity.getNamespace())
                      .withName(entity.getName())
                      .withReason(entity.getReason())
                      .withMessage(entity.getMessage()))
          .toList();
    }
  }
}
