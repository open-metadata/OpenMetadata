/*
 *  Copyright 2025 Collate.
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
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
// Type-only import of the shared Lineage interface, same bridge pattern already
// used by useLineageStore.ts — relocating it to a lower layer is out of scope
// for this task.
// eslint-disable-next-line openmetadata-imports/no-hook-ui-imports
import type { EntityLineageResponse } from '../../components/Lineage/Lineage.interface';
import { DEFAULT_DOMAIN_VALUE } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import {
  LineagePlatformView,
  LineageTimeRange,
} from '../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import type { LineageConfig } from '../../interface/lineage.interface';
import type { SourceType } from '../../interface/source.interface';
import {
  getDataQualityLineage,
  getLineageDataByFQN,
  getPlatformLineage,
} from '../../rest/lineageAPI';
import { getEntityTypeFromPlatformView } from '../../utils/EntityLineageNodeUtils';
import { parseLineageData } from '../../utils/EntityLineagePureUtils';
import { getQuickFilterQuery } from '../../utils/ExplorePureUtils';
import tableClassBase from '../../utils/TableClassBase';
import { useDomainStore } from '../useDomainStore';
import { useLineageStore } from '../useLineageStore';

interface UseLineageDataLoaderArgs {
  entity?: SourceType;
  entityType?: EntityType;
  entityFqn: string;
  isPlatformLineage: boolean;
}

// Mirrors LineageProvider.tsx's getLineageFetchKey (module-private there) so the
// dedupe key derivation stays identical without exporting a new public surface.
const getLineageFetchKey = (
  fqn: string,
  entityType: string,
  config: LineageConfig | undefined,
  queryFilter: string,
  timeFilter: LineageTimeRange
): string =>
  JSON.stringify({
    downstreamDepth: config?.downstreamDepth,
    endTime: timeFilter.endTime,
    entityType,
    fqn,
    nodesPerLayer: config?.nodesPerLayer,
    pipelineViewMode: config?.pipelineViewMode,
    queryFilter,
    startTime: timeFilter.startTime,
    upstreamDepth: config?.upstreamDepth,
  });

/**
 * Owns the lineage fetch orchestration extracted from LineageProvider.tsx:
 * the main entity/platform lineage fetch (with key-based dedupe), the data
 * quality lineage fetch, and the tour mock-data injection. All results are
 * written to useLineageStore — this hook returns void.
 */
export const useLineageDataLoader = (args: UseLineageDataLoaderArgs): void => {
  const { entityType, entityFqn, isPlatformLineage } = args;
  const lastFetchedLineageKeyRef = useRef<string>('');
  const { activeDomain, isDomainRestricted } = useDomainStore();
  const { isTourOpen, isTourPage, tourMockDatasetData } = useTourProvider();

  const {
    lineageConfig,
    platformView,
    timeFilter,
    isDQEnabled,
    selectedQuickFilters,
  } = useLineageStore(
    useShallow((s) => ({
      lineageConfig: s.lineageConfig,
      platformView: s.platformView,
      timeFilter: s.timeFilter,
      isDQEnabled: s.isDQEnabled,
      selectedQuickFilters: s.selectedQuickFilters,
    }))
  );

  // Reuses LineageProvider.tsx's queryFilter derivation verbatim: quick
  // filters, scoped to the active domain when domain-restricted.
  const queryFilter = useMemo(() => {
    const quickFilterQuery = getQuickFilterQuery(selectedQuickFilters);
    const shouldScopeToDomain =
      isDomainRestricted && activeDomain !== DEFAULT_DOMAIN_VALUE;

    if (!shouldScopeToDomain) {
      return JSON.stringify(quickFilterQuery) ?? '';
    }

    const domainClause = {
      bool: {
        should: [
          { term: { 'domains.fullyQualifiedName': activeDomain } },
          { prefix: { 'domains.fullyQualifiedName': `${activeDomain}.` } },
        ],
        minimum_should_match: 1,
      },
    };

    const mustArray = [...(quickFilterQuery?.query?.bool?.must ?? [])];

    const scopedQuery = {
      query: {
        bool: {
          ...quickFilterQuery?.query?.bool,
          must: [...mustArray, domainClause],
        },
      },
    };

    return JSON.stringify(scopedQuery);
  }, [selectedQuickFilters, activeDomain, isDomainRestricted]);

  // Main fetch effect — mirrors LineageProvider.tsx's onPlatformViewUpdate +
  // fetchLineageData/fetchPlatformLineage, narrowed to the binary
  // platformView switch this hook's signature supports (no entity-scoped
  // Service/Domain/DataProduct platform-view branch — see task report).
  useEffect(() => {
    const runEntityFetch = async () => {
      if (!entityFqn || !entityType || isTourOpen) {
        return;
      }

      const fetchKey = getLineageFetchKey(
        entityFqn,
        entityType,
        lineageConfig,
        queryFilter,
        timeFilter
      );

      if (lastFetchedLineageKeyRef.current === fetchKey) {
        return;
      }

      useLineageStore.getState().beginLoad();
      try {
        const res = await getLineageDataByFQN({
          fqn: entityFqn,
          entityType,
          config: lineageConfig,
          queryFilter,
          startTime: timeFilter.startTime,
          endTime: timeFilter.endTime,
        });
        lastFetchedLineageKeyRef.current = fetchKey;
        const parsed = parseLineageData(
          res,
          entityFqn,
          entityFqn,
          lineageConfig?.pipelineViewMode
        );
        useLineageStore.getState().setLineageData(parsed);
      } catch {
        useLineageStore.getState().setLoadError();
      }
    };

    const runPlatformFetch = async () => {
      useLineageStore.getState().beginLoad();
      try {
        const res = await getPlatformLineage({
          config: lineageConfig,
          view: getEntityTypeFromPlatformView(platformView),
        });
        const parsed = parseLineageData(
          res,
          '',
          entityFqn,
          lineageConfig?.pipelineViewMode
        );
        useLineageStore.getState().setLineageData(parsed);
      } catch {
        useLineageStore.getState().setLoadError();
      }
    };

    if (platformView === LineagePlatformView.None) {
      runEntityFetch();
    } else if (isPlatformLineage) {
      runPlatformFetch();
    }
  }, [
    entityType,
    entityFqn,
    lineageConfig,
    platformView,
    queryFilter,
    isPlatformLineage,
    timeFilter.startTime,
    timeFilter.endTime,
    isTourOpen,
  ]);

  // DQ fetch effect — mirrors LineageProvider.tsx's fetchDataQualityLineage
  // effect, including its dependency list (queryFilter/isTourOpen are read
  // from the closure but intentionally not deps, matching the original).
  useEffect(() => {
    if (!isDQEnabled) {
      return;
    }
    if (isTourOpen || !tableClassBase.getAlertEnableStatus()) {
      return;
    }

    getDataQualityLineage(entityFqn, lineageConfig, queryFilter)
      .then((res) => {
        useLineageStore.getState().setDQLineage(res);
      })
      .catch(() => {
        useLineageStore.getState().setDQLineage(undefined);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDQEnabled, entityFqn, lineageConfig]);

  // Tour mock injection — takes priority over fetching, matching
  // LineageProvider.tsx's tour effect.
  useEffect(() => {
    if (!(isTourOpen && isTourPage)) {
      return;
    }

    const mock = tourMockDatasetData as { entityLineage: unknown } | undefined;

    useLineageStore.setState({
      init: true,
      loading: false,
      ...(mock?.entityLineage
        ? { entityLineage: mock.entityLineage as EntityLineageResponse }
        : {}),
    });
  }, [isTourOpen, isTourPage, tourMockDatasetData]);
};
