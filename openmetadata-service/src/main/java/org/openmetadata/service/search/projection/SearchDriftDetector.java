/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.projection;

import io.micrometer.core.instrument.Metrics;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;

/**
 * Measures how far a stored document has drifted from what the projector would build for it now
 * (§11.4).
 *
 * <p>The reason this matters more than it looks: today the remedy for "search looks wrong" is a full
 * reindex, which is expensive, destroys anything no source repopulates, and tells you nothing about
 * what was actually wrong. A drift measurement turns that into a number per entity type and document
 * path — and with repair it becomes an incremental reconciler, which is what lets the full reindex stop
 * being the standard answer.
 *
 * <p><b>Detection only.</b> Nothing here writes to the index. Repair is the next step and needs the
 * cost of detection measured first, which is exactly why the design wants this off by default in
 * production until someone has looked at the numbers.
 */
@Slf4j
public final class SearchDriftDetector {

  private static final String METRIC = "search.index.drift";

  private final ProjectionSpec spec;
  private final DocumentProjector projector;

  public SearchDriftDetector(ProjectionSpec spec) {
    this.spec = spec;
    this.projector = new DocumentProjector(spec);
  }

  /**
   * Compares one stored document against a fresh projection and reports the drifted paths.
   *
   * <p>Only paths a rebuild is authoritative for are considered, so carried and fenced state is not
   * mistaken for drift — see {@link DocumentDrift}.
   *
   * @return the drifted top-level paths, empty when the document is current
   */
  public Set<String> inspect(
      String entityType, Map<String, Object> storedDoc, SearchIndex index, DocBuildContext ctx) {
    if (!ProjectionRollout.driftDetectionEnabled()) {
      return Set.of();
    }
    try {
      Map<String, Object> projected = projector.projectAll(index, ctx);
      Set<String> drifted =
          DocumentDrift.paths(storedDoc, projected, spec, DocumentProjector.REBUILD_AUTHORITY);
      for (String path : drifted) {
        Metrics.counter(METRIC, "entityType", entityType, "docPath", path).increment();
      }
      if (!drifted.isEmpty()) {
        LOG.debug("Search document drift for {}: {}", entityType, drifted);
      }
      return drifted;
    } catch (Exception e) {
      // A detector that can break the thing it samples is worse than no detector.
      LOG.debug("Drift inspection failed for {}", entityType, e);
      return Set.of();
    }
  }
}
