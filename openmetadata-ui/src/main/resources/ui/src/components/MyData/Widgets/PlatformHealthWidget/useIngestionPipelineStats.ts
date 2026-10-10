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
import { ServiceCategory } from '../../../../enums/service.enum';
import {
  ServiceHealth,
  ServicesOverview,
  ServiceSummary,
} from '../../../../generated/api/services/servicesOverview';
import {
  IngestionPipeline,
  PipelineState,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import {
  getServicesOverview,
  ServicesOverviewParams,
} from '../../../../rest/serviceAPI';
import { invalidateQueriesWithoutInitialRace } from '../../../../utils/queryCacheUtils';
import {
  CONNECTIONS_ENTITY_TYPES,
  ENTITY_TYPE_TO_CATEGORY,
} from '../../../integration/ConnectionsPage/ConnectionsPage.constants';
import { useRouteActivation } from '../../../platform/ai-shell/context/useRouteActivation';

export type FailingServiceState = 'failed' | 'partialSuccess';

// One row of the Platform Health widget: a connection service whose worst
// pipeline last run failed / partially failed, plus the culprit run's details.
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
  /**
   * The culprit run's own error, condensed to one line. Empty when the server
   * gave nothing usable (no step failure, or only "Workflow failed…"): the row
   * then shows a translated fallback built from `pipelineType` and `state`, so
   * no English sentence is ever composed here.
   */
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
  /**
   * The worst offenders, failed before partially failed — at most
   * {@link MAX_FAILING_ROWS}. Their count is `failedServices + warningServices`,
   * never this array's length.
   */
  failingServices: FailingService[];
  /** When the stats were fetched (epoch ms); 0 until the first response lands. */
  dataUpdatedAt: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

type IngestionPipelineStatsData = Omit<
  IngestionPipelineStats,
  'dataUpdatedAt' | 'isLoading' | 'isError' | 'refetch'
>;

export const PIPELINE_STATS_QUERY_KEY = [
  'landingPage',
  'ingestionPipeline',
  'stats',
] as const;

// Pipeline health moves on the scale of scheduled runs, not seconds; a
// websocket 'dirty' signal still forces a refetch inside the window.
export const PIPELINE_STATS_TTL_MS = 5 * 60 * 1000;
const PIPELINE_STATS_GC_TIME_MS = PIPELINE_STATS_TTL_MS + 5 * 60 * 1000;

/**
 * How many failing services get a detailed row. The card shows three; the rest
 * ride along to the deployment's insight block (see
 * `PlatformHealthInsightProps`), which caps its own prompt at the same ten.
 */
export const MAX_FAILING_ROWS = 10;

/**
 * Pipelines read per failing service when looking for the culprit run. A
 * service carries a handful in practice; the cap only bounds a pathological one.
 */
const PIPELINES_PER_SERVICE = 50;

const EMPTY_PIPELINE_STATS: IngestionPipelineStatsData = {
  connectedServices: 0,
  failedServices: 0,
  failingServices: [],
  healthyServices: 0,
  pendingServices: 0,
  warningServices: 0,
};

const REASON_MAX_LENGTH = 90;
// Raw messages that carry no signal — the row shows a typed fallback instead.
const GENERIC_ERROR_PATTERN = /workflow failed/i;

/**
 * The connection estate, as the Connections page counts it: every service type
 * it tabs over, minus the built-in OpenMetadata service (`excludeProvider`).
 */
const OVERVIEW_PARAMS: ServicesOverviewParams = {
  entityType: CONNECTIONS_ENTITY_TYPES,
  excludeProvider: 'system',
  includeHealth: true,
  offset: 0,
};

const HEALTH_TO_STATE: Partial<Record<ServiceHealth, FailingServiceState>> = {
  [ServiceHealth.Failed]: 'failed',
  [ServiceHealth.PartialSuccess]: 'partialSuccess',
};

const STATE_TO_PIPELINE_STATE: Record<FailingServiceState, PipelineState> = {
  failed: PipelineState.Failed,
  partialSuccess: PipelineState.PartialSuccess,
};

const latestRun = (pipeline: IngestionPipeline) =>
  pipeline.pipelineStatuses?.[0];

// Pull the first step-level failure message off a pipeline's latest run.
const firstFailureMessage = (pipeline: IngestionPipeline): string => {
  const steps = latestRun(pipeline)?.status ?? [];
  const failingStep = steps.find((step) => (step.failures?.length ?? 0) > 0);

  return failingStep?.failures?.[0]?.error ?? '';
};

/**
 * Turn a raw stack-trace error into one concise line, or nothing when the raw
 * message is generic ("Workflow failed…") or empty.
 */
const cleanReason = (raw: string): string => {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const afterBracket = collapsed.includes(']: ')
    ? collapsed.slice(collapsed.lastIndexOf(']: ') + 3).replace(/^\[|\]$/g, '')
    : collapsed;
  const usable = !GENERIC_ERROR_PATTERN.test(afterBracket);
  const chosen = usable ? afterBracket : '';

  return chosen.length > REASON_MAX_LENGTH
    ? `${chosen.slice(0, REASON_MAX_LENGTH).trimEnd()}…`
    : chosen;
};

// The pipeline that explains a failing service's row: the most recent run in
// the service's worst state.
const findCulprit = (
  pipelines: IngestionPipeline[],
  state: FailingServiceState
): IngestionPipeline | undefined =>
  pipelines
    .filter(
      (p) => latestRun(p)?.pipelineState === STATE_TO_PIPELINE_STATE[state]
    )
    .sort(
      (a, b) => (latestRun(b)?.timestamp ?? 0) - (latestRun(a)?.timestamp ?? 0)
    )[0];

/**
 * One request per row, never per estate: only a service already known to be
 * failing has its pipelines read, so the cost is bounded by
 * {@link MAX_FAILING_ROWS} however large the deployment is.
 */
const toFailingService = async (
  summary: ServiceSummary
): Promise<FailingService> => {
  const state = HEALTH_TO_STATE[summary.health as ServiceHealth] ?? 'failed';
  const fqn = summary.fullyQualifiedName ?? summary.name;
  const { data: pipelines = [] } = await getIngestionPipelines({
    arrQueryFields: ['pipelineStatuses'],
    limit: PIPELINES_PER_SERVICE,
    serviceFilter: fqn,
    // A database and a dashboard service may share a name; the type keeps one
    // service's pipelines from bleeding into the other's row.
    serviceType: summary.entityType,
  });
  const culprit = findCulprit(pipelines, state);

  return {
    displayName: summary.displayName || summary.name,
    fqn,
    id: summary.id,
    lastRunTs: culprit ? latestRun(culprit)?.timestamp : undefined,
    name: summary.name,
    pipelineFqn: culprit?.fullyQualifiedName,
    pipelineType: culprit?.pipelineType,
    reason: culprit ? cleanReason(firstFailureMessage(culprit)) : '',
    serviceCategory: ENTITY_TYPE_TO_CATEGORY[summary.entityType],
    serviceType: summary.serviceType ?? '',
    state,
  };
};

// Failed services rank before partial ones; within a state, most recent first.
const sortFailingServices = (services: FailingService[]): FailingService[] =>
  [...services].sort((a, b) => {
    const stateRank = (s: FailingServiceState) => (s === 'failed' ? 0 : 1);
    const byState = stateRank(a.state) - stateRank(b.state);

    return byState !== 0 ? byState : (b.lastRunTs ?? 0) - (a.lastRunTs ?? 0);
  });

/** `healthCounts` is per entity type; the card only wants the estate total. */
const sumHealth = (overview: ServicesOverview, health: ServiceHealth): number =>
  Object.values(overview.healthCounts ?? {}).reduce(
    (total, byHealth) => total + (byHealth[health] ?? 0),
    0
  );

const fetchFailingPage = (health: ServiceHealth, limit: number) =>
  getServicesOverview({ ...OVERVIEW_PARAMS, health: [health], limit });

/**
 * The health buckets come from the server's own tally — the overview endpoint
 * reduces every service's pipelines worst-wins, exactly as this card used to do
 * client-side over the whole estate. Its `health` filter narrows only the page,
 * never the counts, so the first page of failed services and the estate-wide
 * numbers arrive in one response. Partially failed services are only read when
 * the failed ones leave room in the rows.
 */
const fetchPipelineStats = async (): Promise<IngestionPipelineStatsData> => {
  const overview = await fetchFailingPage(
    ServiceHealth.Failed,
    MAX_FAILING_ROWS
  );
  const room = MAX_FAILING_ROWS - overview.data.length;
  const partial =
    room > 0 && sumHealth(overview, ServiceHealth.PartialSuccess) > 0
      ? (await fetchFailingPage(ServiceHealth.PartialSuccess, room)).data
      : [];
  const failingServices = await Promise.all(
    [...overview.data, ...partial].map(toFailingService)
  );

  return {
    connectedServices: overview.total,
    failedServices: sumHealth(overview, ServiceHealth.Failed),
    failingServices: sortFailingServices(failingServices),
    healthyServices: sumHealth(overview, ServiceHealth.Success),
    pendingServices: sumHealth(overview, ServiceHealth.NotRun),
    warningServices: sumHealth(overview, ServiceHealth.PartialSuccess),
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
  const { data, dataUpdatedAt, isError, isPending, refetch } = useQuery(
    getPipelineStatsQueryOptions(enabled)
  );

  // A websocket 'dirty' signal or an aged-out page forces a refetch. A plain
  // activation only revalidates once the TTL has lapsed — `prefetchQuery` is a
  // no-op while the cache is fresh, so flipping between pages costs nothing.
  useRouteActivation(
    (reason) => {
      if (!enabled) {
        return;
      }
      if (reason === 'dirty' || reason === 'maxAge') {
        void invalidateQueriesWithoutInitialRace(queryClient, {
          queryKey: PIPELINE_STATS_QUERY_KEY,
        });

        return;
      }

      void queryClient.prefetchQuery(getPipelineStatsQueryOptions());
    },
    { revalidateOnFocus: false }
  );

  return {
    ...(data ?? EMPTY_PIPELINE_STATS),
    dataUpdatedAt,
    // A disabled query stays pending forever; only an enabled one is loading.
    isLoading: enabled && isPending,
    isError,
    refetch: () => void refetch(),
  };
};
