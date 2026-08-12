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

import static org.openmetadata.schema.EntityInterface.ENTITY_TYPE_TO_CLASS_MAP;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Walks an entity's version history and slices the backfill window into one {@link
 * VersionedWindow} per applicable version. Pure-output given the same DB state — the same input
 * produces the same windows.
 *
 * <p>Two paths:
 *
 * <ul>
 *   <li><strong>N+1 short-circuit:</strong> if the entity wasn't touched within the backfill
 *       window, the latest hydrated form covers the whole window (one window).
 *   <li><strong>Version walk:</strong> otherwise iterate {@code listVersionsWithOffset} pages,
 *       newest-first, slicing the window at each in-window transition and emitting a final
 *       pre-window slice for the version that bridges into older days.
 * </ul>
 *
 * <p>The {@link VersionShape} marker is set per window: the latest hydrated entity at index 0 of
 * the version list gets {@link VersionShape#LATEST_HYDRATED}; everything else (raw rows from
 * {@code entity_extension}) gets {@link VersionShape#HISTORICAL_RAW}.
 */
public final class VersionResolver {

  private static final int VERSION_PAGE_SIZE = 100;

  /**
   * Compute the per-version windows that cover the configured backfill range for this entity.
   *
   * @param latest the entity as loaded by the workflow's keyset source (hydrated)
   * @param context the workflow window + entity type
   * @return windows in newest-to-oldest order
   */
  public List<VersionedWindow> resolve(EntityInterface latest, EnrichmentContext context) {
    long startTs = context.workflowWindowStartTimestamp();
    long endTs = context.workflowWindowEndTimestamp();

    // N+1 optimization: if the latest entity wasn't touched within the window, one hydrated
    // window covers all days. Skip the listVersionsWithOffset query entirely.
    Long latestUpdatedAt = latest.getUpdatedAt();
    if (latestUpdatedAt != null
        && TimestampUtils.getStartOfDayTimestamp(latestUpdatedAt) < startTs) {
      return List.of(new VersionedWindow(latest, startTs, endTs, VersionShape.LATEST_HYDRATED));
    }

    EntityRepository<?> entityRepository = Entity.getEntityRepository(context.entityType());
    Class<? extends EntityInterface> entityClass =
        ENTITY_TYPE_TO_CLASS_MAP.get(context.entityType().toLowerCase());

    List<VersionedWindow> windows = new ArrayList<>();
    long pointerTimestamp = endTs;
    boolean isFirst = true;
    int nextOffset = 0;

    while (true) {
      EntityRepository.EntityHistoryWithOffset page =
          entityRepository.listVersionsWithOffset(latest.getId(), VERSION_PAGE_SIZE, nextOffset);
      List<Object> versions = page.entityHistory().getVersions();
      if (versions.isEmpty()) {
        return windows;
      }
      nextOffset = page.nextOffset();

      for (Object version : versions) {
        EntityInterface versionEntity = JsonUtils.readOrConvertValue(version, entityClass);
        // Consume isFirst up front: every continue/return below leaves it correctly false.
        boolean wasFirst = isFirst;
        isFirst = false;

        Long versionUpdatedAt = versionEntity.getUpdatedAt();
        if (versionUpdatedAt == null) {
          continue; // degenerate row: no timestamp to slice on
        }
        long versionTimestamp = TimestampUtils.getStartOfDayTimestamp(versionUpdatedAt);
        if (versionTimestamp > pointerTimestamp) {
          continue; // later same-day update; the pointer already covers this row's day
        }

        VersionShape shape = wasFirst ? VersionShape.LATEST_HYDRATED : VersionShape.HISTORICAL_RAW;

        if (versionTimestamp < startTs) {
          // Version older than the window start: covers the remaining days from startTs to pointer.
          windows.add(new VersionedWindow(versionEntity, startTs, pointerTimestamp, shape));
          return windows;
        }

        // In-window version: covers [endOfDay(versionTs), pointer]; advance pointer past its day.
        long windowSliceStart = TimestampUtils.getEndOfDayTimestamp(versionTimestamp);
        windows.add(new VersionedWindow(versionEntity, windowSliceStart, pointerTimestamp, shape));
        pointerTimestamp =
            TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(versionTimestamp, 1));
      }
    }
  }
}
