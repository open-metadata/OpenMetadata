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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OPEN_METADATA } from '../../../../constants/Services.constant';
import { ServiceCategory } from '../../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineState,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from '../../../../interface/service.interface';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { invalidateQueriesWithoutInitialRace } from '../../../../utils/queryCacheUtils';
import {
  ALL_SERVICES_SEARCH_INDEX,
  ENTITY_TYPE_TO_CATEGORY,
} from '../../../integration/ConnectionsPage/ConnectionsPage.constants';
import { useRouteActivation } from '../../../platform/ai-shell/context/useRouteActivation';

// Lives here rather than alongside the Connections list, which no longer queries Elasticsearch at
// all — it reads the database-backed services overview. This hook is the last consumer of the
// search path, because the health buckets it feeds the landing widget still need the estate and
// there is no aggregate endpoint for them yet.
//
// The must_not clause drops the built-in OpenMetadata metadata service server-side, so it never
// has to be filtered out of the counts afterwards.
const getConnectionsSearchQueryFilter = () => ({
  query: {
    bool: {
      must_not: [
        {
          bool: {
            filter: [
              { term: { entityType: 'metadataService' } },
              { term: { fullyQualifiedName: OPEN_METADATA } },
            ],
          },
        },
      ],
    },
  },
});

export type FailingServiceState = 'failed' | 'partialSuccess';

// One row of the admin Platform Health widget: a connection service whose worst
// pipeline last run failed / partially failed, plus the concise reason we show.
export interface FailingService {
  id: string;
  name: string;
  displayName: string;
  serviceType: string;
  serviceCategory: ServiceCategory;
  fqn: string;
  pipelineType?: PipelineType;
  /** FQN of the culprit pipeline — lets the AI agent pull its run data/logs directly. */
  pipelineFqn?: string;
  state: FailingServiceState;
  reason: string;
  lastRunTs?: number;
}

// The health bucket a service belongs to, used to filter the Connections list.
export type ServiceHealthFilter = 'failing' | 'healthy' | 'notRun';

export interface IngestionPipelineStats {
  connectedServices: number;
  healthyServices: number;
  warningServices: number;
  failedServices: number;
  pendingServices: number;
  failingServices: FailingService[];
  healthyServiceFqns: string[];
  pendingServiceFqns: string[];
  isLoading: boolean;
  isError: boolean;
}

interface IngestionPipelineStatsData {
  connectedServices: number;
  healthyServices: number;
  warningServices: number;
  failedServices: number;
  pendingServices: number;
  failingServices: FailingService[];
  healthyServiceFqns: string[];
  pendingServiceFqns: string[];
}

export const PIPELINE_STATS_QUERY_KEY = [
  'landingPage',
  'ingestionPipeline',
  'stats',
] as const;
const PIPELINE_STATS_TTL_MS = 30_000;
const PIPELINE_STATS_GC_TIME_MS = PIPELINE_STATS_TTL_MS + 5 * 60 * 1000;
const EMPTY_PIPELINE_STATS: IngestionPipelineStatsData = {
  connectedServices: 0,
  failedServices: 0,
  failingServices: [],
  healthyServiceFqns: [],
  healthyServices: 0,
  pendingServiceFqns: [],
  pendingServices: 0,
  warningServices: 0,
};

// Worst-state-wins precedence: a service with several pipelines whose latest
// runs disagree (e.g. metadata pipeline succeeded, profiler failed) is
// counted as failed, matching "any failing agent flags the service failed".
const STATE_SEVERITY: Record<string, number> = {
  [PipelineState.Failed]: 3,
  [PipelineState.PartialSuccess]: 2,
  [PipelineState.Success]: 1,
};

// Short, user-facing label for the pipeline-type tag on a failing row.
const PIPELINE_TYPE_LABEL: Partial<Record<PipelineType, string>> = {
  [PipelineType.Metadata]: 'Metadata',
  [PipelineType.Profiler]: 'Profiler',
  [PipelineType.AutoClassification]: 'Auto Classification',
  [PipelineType.Lineage]: 'Lineage',
  [PipelineType.Usage]: 'Usage',
  [PipelineType.Dbt]: 'dbt',
};

const REASON_MAX_LENGTH = 90;
// Raw messages that carry no signal — we replace them with a typed fallback.
const GENERIC_ERROR_PATTERN = /workflow failed/i;

const withCategory = (
  service: ServicesType,
  category: ServiceCategory
): ServicesType & { serviceCategory: ServiceCategory } => ({
  ...service,
  serviceCategory: category,
});

// "No state at all" ranks below every known state, so an unrun pipeline never
// displaces one that actually reported something.
const severityOf = (state?: string): number =>
  state === undefined ? -1 : STATE_SEVERITY[state] ?? 0;

const worstStateOf = (pipelines: IngestionPipeline[]): string | undefined =>
  pipelines.reduce<string | undefined>((worst, pipeline) => {
    const state = pipeline.pipelineStatuses?.[0]?.pipelineState;

    return severityOf(state) > severityOf(worst) ? state : worst;
  }, undefined);

// Pull the first step-level failure message off a pipeline's latest run.
const firstFailureMessage = (pipeline: IngestionPipeline): string => {
  const steps = pipeline.pipelineStatuses?.[0]?.status ?? [];
  const failingStep = steps.find((step) => (step.failures?.length ?? 0) > 0);

  return failingStep?.failures?.[0]?.error ?? '';
};

// Turn a raw stack-trace error into one concise, human line — or a typed
// fallback when the raw message is generic ("Workflow failed…") or empty.
const cleanReason = (raw: string, pipeline: IngestionPipeline): string => {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const afterBracket = collapsed.includes(']: ')
    ? collapsed.slice(collapsed.lastIndexOf(']: ') + 3).replace(/^\[|\]$/g, '')
    : collapsed;
  const typeLabel = PIPELINE_TYPE_LABEL[pipeline.pipelineType] ?? 'Ingestion';
  const fallback =
    pipeline.pipelineStatuses?.[0]?.pipelineState ===
    PipelineState.PartialSuccess
      ? `${typeLabel} run partially failed`
      : `${typeLabel} ingestion failed`;
  const usable =
    afterBracket.length > 0 && !GENERIC_ERROR_PATTERN.test(afterBracket);
  const chosen = usable ? afterBracket : fallback;

  return chosen.length > REASON_MAX_LENGTH
    ? `${chosen.slice(0, REASON_MAX_LENGTH).trimEnd()}…`
    : chosen;
};

// The single pipeline that determines a failing service's row: worst state,
// then most recent run among pipelines sharing that state.
const worstFailingPipeline = (
  pipelines: IngestionPipeline[],
  worstState: string
): IngestionPipeline | undefined =>
  pipelines
    .filter((p) => p.pipelineStatuses?.[0]?.pipelineState === worstState)
    .sort(
      (a, b) =>
        (b.pipelineStatuses?.[0]?.timestamp ?? 0) -
        (a.pipelineStatuses?.[0]?.timestamp ?? 0)
    )[0];

const buildFailingService = (
  service: ServicesType & { serviceCategory: ServiceCategory },
  pipelines: IngestionPipeline[],
  worstState: string
): FailingService => {
  const culprit = worstFailingPipeline(pipelines, worstState);
  const state: FailingServiceState =
    worstState === PipelineState.Failed ? 'failed' : 'partialSuccess';

  return {
    displayName: service.displayName || service.name,
    fqn: service.fullyQualifiedName ?? service.name,
    id: service.id,
    lastRunTs: culprit?.pipelineStatuses?.[0]?.timestamp,
    name: service.name,
    pipelineFqn: culprit?.fullyQualifiedName,
    pipelineType: culprit?.pipelineType,
    reason: culprit ? cleanReason(firstFailureMessage(culprit), culprit) : '',
    serviceCategory: service.serviceCategory,
    serviceType: (service.serviceType as string) ?? '',
    state,
  };
};

// Fetch every connection service in ONE search over the same per-tab indexes the
// Connections list uses (reusing its estate-wide query filter, which excludes the
// built-in OpenMetadata service), instead of a REST call per service category. The
// list already renders id/name/fqn/displayName/serviceType/entityType off this
// _source, so the shape carries everything the health buckets need.
const fetchConnectionServices = async (): Promise<
  Array<ServicesType & { serviceCategory: ServiceCategory }>
> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: 1000,
    queryFilter: getConnectionsSearchQueryFilter(),
    searchIndex: ALL_SERVICES_SEARCH_INDEX,
  });

  return response.hits.hits
    .map((hit) => {
      const source = hit._source as ServicesType & { entityType: string };
      const category = ENTITY_TYPE_TO_CATEGORY[source.entityType];

      return category ? withCategory(source, category) : undefined;
    })
    .filter(
      (
        service
      ): service is ServicesType & { serviceCategory: ServiceCategory } =>
        Boolean(service)
    );
};

// Failed services rank before partial ones; within a state, most recent first.
const sortFailingServices = (services: FailingService[]): FailingService[] =>
  [...services].sort((a, b) => {
    const stateRank = (s: FailingServiceState) => (s === 'failed' ? 0 : 1);
    const byState = stateRank(a.state) - stateRank(b.state);

    return byState !== 0 ? byState : (b.lastRunTs ?? 0) - (a.lastRunTs ?? 0);
  });

const PIPELINE_PAGE_SIZE = 1000;

/**
 * Hard stop on the paging loop. A cursor the server never clears would
 * otherwise spin forever; twenty pages is already far past any real install.
 */
const MAX_PIPELINE_PAGES = 20;

/**
 * Every ingestion pipeline, followed page by page.
 *
 * A single capped read left every pipeline beyond the first page out of
 * `pipelinesByServiceId`, so the services owning them fell into "not run yet"
 * whatever state they were actually in -- wrong precisely on the large
 * deployments whose admins lean on this card hardest.
 */
const fetchAllIngestionPipelines = async (): Promise<IngestionPipeline[]> => {
  const pipelines: IngestionPipeline[] = [];
  let after: string | undefined;
  let pages = 0;

  do {
    // Sequential by necessity: the next cursor is only known once the current
    // page lands. This is cursor paging, not a request per item -- the
    // iteration is over pages, and the page size is the batch.
    const response = await getIngestionPipelines({
      arrQueryFields: ['pipelineStatuses'],
      limit: PIPELINE_PAGE_SIZE,
      ...(after ? { paging: { after } } : {}),
    });

    pipelines.push(...(response.data ?? []));
    after = response.paging?.after;
    pages += 1;
  } while (after && pages < MAX_PIPELINE_PAGES);

  return pipelines;
};

const fetchPipelineStats = async (): Promise<IngestionPipelineStatsData> => {
  const [services, pipelines] = await Promise.all([
    fetchConnectionServices(),
    fetchAllIngestionPipelines(),
  ]);

  const pipelinesByServiceId = new Map<string, IngestionPipeline[]>();
  pipelines.forEach((p) => {
    const serviceId = p.service?.id;
    if (!serviceId) {
      return;
    }
    const existing = pipelinesByServiceId.get(serviceId) ?? [];
    existing.push(p);
    pipelinesByServiceId.set(serviceId, existing);
  });

  let warning = 0;
  let failed = 0;
  const failingServices: FailingService[] = [];
  const healthyServiceFqns: string[] = [];
  const pendingServiceFqns: string[] = [];
  services.forEach((service) => {
    const servicePipelines = pipelinesByServiceId.get(service.id) ?? [];
    const worstState = worstStateOf(servicePipelines);
    const fqn = service.fullyQualifiedName ?? service.name;
    if (worstState === PipelineState.Failed) {
      failed += 1;
      failingServices.push(
        buildFailingService(service, servicePipelines, worstState)
      );
    } else if (worstState === PipelineState.PartialSuccess) {
      warning += 1;
      failingServices.push(
        buildFailingService(service, servicePipelines, worstState)
      );
    } else if (worstState === PipelineState.Success) {
      healthyServiceFqns.push(fqn);
    } else {
      pendingServiceFqns.push(fqn);
    }
  });

  const total = services.length;

  return {
    connectedServices: total,
    failedServices: failed,
    failingServices: sortFailingServices(failingServices),
    healthyServiceFqns,
    healthyServices: healthyServiceFqns.length,
    pendingServiceFqns,
    pendingServices: pendingServiceFqns.length,
    warningServices: warning,
  };
};

const getPipelineStatsQueryOptions = (enabled = true) => ({
  enabled,
  gcTime: PIPELINE_STATS_GC_TIME_MS,
  queryFn: fetchPipelineStats,
  queryKey: PIPELINE_STATS_QUERY_KEY,
  staleTime: PIPELINE_STATS_TTL_MS,
});

export const useIngestionPipelineStats = (options?: {
  enabled?: boolean;
}): IngestionPipelineStats => {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const { data, isError, isPending } = useQuery(
    getPipelineStatsQueryOptions(enabled)
  );

  // Re-validate when this page becomes visible again or the tab refocuses; the cache
  // TTL decides no-op-vs-refetch. Force a refetch on websocket-driven dirty / max-age.
  useRouteActivation((reason) => {
    if (reason === 'dirty' || reason === 'maxAge') {
      void invalidateQueriesWithoutInitialRace(queryClient, {
        queryKey: PIPELINE_STATS_QUERY_KEY,
      });

      return;
    }

    void queryClient.prefetchQuery(getPipelineStatsQueryOptions());
  });

  return {
    ...(data ?? EMPTY_PIPELINE_STATS),
    isLoading: isPending,
    isError,
  };
};
