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

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.util.List;
import java.util.Map;

/**
 * Typed view of the workflow's contextData map. Built once per enrichment call so steps do not
 * pass a stringly-typed {@code Map<String, Object>} around. Internal to the enricher package; the
 * downstream processors and {@link
 * org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow} continue
 * to use the {@code Map<String, Object> contextData} contract.
 *
 * <p>{@code workflowWindowStartTimestamp} / {@code workflowWindowEndTimestamp} are the full
 * backfill window — used by {@code VersionResolver} to decide which versions of an entity matter.
 * They are distinct from the per-version-window timestamps carried on {@link VersionedWindow},
 * which are slices of this overall window.
 */
public record EnrichmentContext(
    String entityType,
    List<String> entityTypeFields,
    long workflowWindowStartTimestamp,
    long workflowWindowEndTimestamp) {

  @SuppressWarnings("unchecked")
  public static EnrichmentContext from(Map<String, Object> contextData) {
    return new EnrichmentContext(
        (String) contextData.get(ENTITY_TYPE_KEY),
        (List<String>) contextData.get(ENTITY_TYPE_FIELDS_KEY),
        (Long) contextData.get(START_TIMESTAMP_KEY),
        (Long) contextData.get(END_TIMESTAMP_KEY));
  }
}
