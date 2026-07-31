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

import org.openmetadata.schema.EntityInterface;

/**
 * One version's coverage within the backfill window: an entity (at a specific version) plus the
 * inclusive day-range it's responsible for, plus a hint about whether its references are hydrated
 * or bare.
 *
 * <p>Produced by {@code VersionResolver}, consumed by the enrichment pipeline (which writes
 * derived fields into the snapshot) and by {@code SnapshotMaterializer} (which fans the snapshot
 * out across the days in the range).
 */
public record VersionedWindow(
    EntityInterface entity,
    long windowStartTimestamp,
    long windowEndTimestamp,
    VersionShape shape) {}
