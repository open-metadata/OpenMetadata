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
import java.util.UUID;

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
 * which are slices of this overall window. A non-null {@code snapshotTimestamp} captures only
 * the currently hydrated entity on that collection day, without reconstructing version history.
 * Parent table IDs are resolved once per source batch, never looked up per enrichment step.
 */
public record EnrichmentContext(
    String entityType,
    List<String> entityTypeFields,
    long workflowWindowStartTimestamp,
    long workflowWindowEndTimestamp,
    Long snapshotTimestamp,
    Map<String, UUID> parentTableIds) {

  public static final String SNAPSHOT_TIMESTAMP_KEY = "snapshotTimestamp";
  public static final String PARENT_TABLE_IDS_KEY = "parentTableIds";

  public EnrichmentContext {
    parentTableIds = Map.copyOf(parentTableIds);
  }

  public EnrichmentContext(
      String entityType, List<String> entityTypeFields, long startTimestamp, long endTimestamp) {
    this(entityType, entityTypeFields, startTimestamp, endTimestamp, null, Map.of());
  }

  @SuppressWarnings("unchecked")
  public static EnrichmentContext from(Map<String, Object> contextData) {
    return new EnrichmentContext(
        (String) contextData.get(ENTITY_TYPE_KEY),
        (List<String>) contextData.get(ENTITY_TYPE_FIELDS_KEY),
        (Long) contextData.get(START_TIMESTAMP_KEY),
        (Long) contextData.get(END_TIMESTAMP_KEY),
        (Long) contextData.get(SNAPSHOT_TIMESTAMP_KEY),
        (Map<String, UUID>) contextData.getOrDefault(PARENT_TABLE_IDS_KEY, Map.of()));
  }
}
