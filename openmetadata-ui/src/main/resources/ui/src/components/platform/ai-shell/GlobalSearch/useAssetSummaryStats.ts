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
import { get } from 'lodash';
import { useEffect, useState } from 'react';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getLineagePagingData } from '../../../../rest/lineageAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityCountAtDepth } from '../../../../utils/EntityLineageNodeUtils';

export interface AssetSummaryCounts {
  upstream?: number;
  downstream?: number;
  /** Incidents on the asset in the last 30 days, as Explore's summary counts them. */
  incidents?: number;
}

/**
 * Lineage and incident counts for the summary panel. Undefined while loading
 * or when a call fails, so the panel shows a dash rather than a wrong zero.
 */
export const useAssetSummaryStats = (
  source?: SearchSourceAlias
): AssetSummaryCounts => {
  const [counts, setCounts] = useState<AssetSummaryCounts>({});
  const fqn = source?.fullyQualifiedName ?? '';
  const entityType = source?.entityType as EntityType | undefined;
  const hasColumns = Array.isArray(get(source, 'columns'));

  useEffect(() => {
    setCounts({});
    if (!fqn || !entityType || entityType === EntityType.TABLE_COLUMN) {
      return;
    }
    let isCurrent = true;

    Promise.allSettled([
      getLineagePagingData({ fqn, type: entityType }),
      hasColumns
        ? getListTestCaseIncidentStatus({
            originEntityFQN: fqn,
            latest: true,
            limit: 0,
            startTs: getEpochMillisForPastDays(
              PROFILER_FILTER_RANGE.last30days.days
            ),
            endTs: getCurrentMillis(),
          })
        : Promise.reject(new Error('no incidents for this type')),
    ]).then(([lineage, incidents]) => {
      if (!isCurrent) {
        return;
      }
      setCounts({
        upstream:
          lineage.status === 'fulfilled'
            ? getEntityCountAtDepth(lineage.value.upstreamDepthInfo, 1)
            : undefined,
        downstream:
          lineage.status === 'fulfilled'
            ? getEntityCountAtDepth(lineage.value.downstreamDepthInfo, 1)
            : undefined,
        incidents:
          incidents.status === 'fulfilled'
            ? incidents.value.paging.total
            : undefined,
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [fqn, entityType, hasColumns]);

  return counts;
};
