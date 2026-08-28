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

/**
 * A single enrichment concern (e.g. owner→team resolution, tag/tier source counting). Steps
 * contribute additive fields to the {@link EnrichmentTarget#entityMap()} and never read each
 * other's output, so failures in one step do not corrupt sibling steps' work. The {@link
 * EnrichmentPipeline} wraps each {@link #apply(EnrichmentTarget)} invocation in try/catch — a step
 * that throws produces no fields on the snapshot but does not abort the entity's enrichment.
 */
public interface EnrichmentStep {

  /**
   * Stable, unique identifier for this step. Used as the key in per-step {@link
   * org.openmetadata.schema.system.StepStats} so operators can attribute failures to a specific
   * enrichment concern.
   */
  String name();

  /**
   * Apply this step's enrichment to {@code target.entityMap()}. Implementations are additive
   * only: they may put new keys, but must never read keys written by sibling steps and must
   * never remove keys. This invariant is what lets the pipeline order steps freely and lets a
   * failing step degrade only its own contribution. Read inputs from
   * {@link EnrichmentTarget#entity()}, {@link EnrichmentTarget#changeSummary()}, or
   * {@link EnrichmentTarget#context()}. Reading passthrough fields seeded into
   * {@link EnrichmentTarget#entityMap()} by {@code buildTarget} (e.g. {@code extension}) is
   * allowed — those are not sibling contributions. Exceptions are caught by the pipeline;
   * implementations are not expected to swallow them.
   */
  void apply(EnrichmentTarget target);
}
