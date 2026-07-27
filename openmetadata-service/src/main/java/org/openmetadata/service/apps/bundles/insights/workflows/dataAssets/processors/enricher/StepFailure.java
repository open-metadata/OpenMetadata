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
 * Record of a single {@link EnrichmentStep} failing for a specific entity. Returned from {@link
 * EnrichmentPipeline#run(EnrichmentTarget)} for tests and inspection; the pipeline already records
 * the failure into its per-step counters and emits a rate-limited log warning.
 */
public record StepFailure(String stepName, String entityFqn, Throwable cause) {}
