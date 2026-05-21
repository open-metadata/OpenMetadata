/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSummary;

/**
 * Per-version input + accumulator handed to each {@link EnrichmentStep}. The {@code entityMap} is
 * the mutable snapshot accumulator: steps add their derived fields to it. {@code
 * windowStartTimestamp} / {@code windowEndTimestamp} describe the version's slice of the backfill
 * window (computed by the version resolver, expanded across days by the materializer). {@code
 * shape} tells steps whether the entity's references are hydrated (have FQN, name, …) or bare
 * (only {@code id} / {@code type}).
 */
public record EnrichmentTarget(
    EntityInterface entity,
    Map<String, Object> entityMap,
    Map<String, ChangeSummary> changeSummary,
    long windowStartTimestamp,
    long windowEndTimestamp,
    EnrichmentContext context,
    VersionShape shape) {}
