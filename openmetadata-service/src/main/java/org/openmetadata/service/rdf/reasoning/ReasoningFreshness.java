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
package org.openmetadata.service.rdf.reasoning;

import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.rdf.RdfReasoningFreshness;
import org.openmetadata.schema.api.rdf.RdfReasoningInput;
import org.openmetadata.schema.api.rdf.RdfSourceRevision;

/**
 * Whether a reasoning result still describes the serving graph, ontologies and rules. Freshness is
 * judged apart from job state: a refresh that succeeded can publish a result that is already stale.
 */
public final class ReasoningFreshness {
  private ReasoningFreshness() {}

  /**
   * The serving side now. The enqueued watermark counts every write handed a live-write queue ID,
   * including writes recorded from outside the queue.
   */
  public record Serving(
      UUID datasetGeneration,
      long enqueuedWatermark,
      boolean projectionDegraded,
      String ontologyDigest,
      String ruleBundleDigest) {}

  public static RdfReasoningFreshness of(final RdfReasoningInput input, final Serving now) {
    if (now.projectionDegraded()) {
      // The graph itself is missing writes, so no result computed from it can be vouched for, and
      // refreshing cannot help until a rebuild repairs the projection.
      return RdfReasoningFreshness.UNKNOWN;
    }
    final RdfSourceRevision read = input.getSourceRevision();
    final boolean current =
        now.datasetGeneration().equals(read.getDatasetGeneration())
            && now.enqueuedWatermark() <= read.getLiveWriteWatermark()
            && Objects.equals(now.ontologyDigest(), input.getOntologyDigest())
            && Objects.equals(now.ruleBundleDigest(), input.getRuleBundleDigest());
    return current ? RdfReasoningFreshness.CURRENT : RdfReasoningFreshness.STALE;
  }
}
