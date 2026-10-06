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

import java.util.List;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedEntity;

/**
 * What one OpenLineage event turns into: the lineage edges to write, plus the datasets and job that
 * could not be resolved. A skipped event (filtered type, or no inputs or outputs) plans nothing and
 * is not an error.
 */
public record OpenLineageEventPlan(
    boolean skipped,
    List<AddLineage> lineageRequests,
    List<UnresolvedEntity> unresolvedDatasets,
    List<UnresolvedEntity> unresolvedJobs) {

  public OpenLineageEventPlan {
    lineageRequests = List.copyOf(lineageRequests);
    unresolvedDatasets = List.copyOf(unresolvedDatasets);
    unresolvedJobs = List.copyOf(unresolvedJobs);
  }

  public static OpenLineageEventPlan skippedEvent() {
    return new OpenLineageEventPlan(true, List.of(), List.of(), List.of());
  }
}
