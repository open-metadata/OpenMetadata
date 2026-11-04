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

import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PipelineStatus } from '../generated/entity/data/pipeline';
import {
  LastRunStatus,
  PipelineSummary,
} from '../generated/type/pipelineSummary';
import { getPipelineStatus, listPipelineSummaries } from '../rest/pipelineAPI';
import { DAY_MS } from './useDataEstate';

export const PIPELINE_STATUS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'pipelineStatus',
];
export const PIPELINE_RUNS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'pipelineRuns',
];
// ADR:2026-10-16-landing-task-and-pipeline-cards-read-one-page
/** Rows the card lists per bucket. */
export const PIPELINE_STATUS_PAGE_SIZE = 10;
/** Runs the history strip draws per pipeline. */
export const PIPELINE_RUN_HISTORY_SIZE = 10;
// The status endpoint requires a window; a month covers ten runs of anything
// scheduled at least every three days.
const PIPELINE_RUN_WINDOW_DAYS = 30;
const PIPELINE_STATUS_TTL_MS = 5 * 60 * 1000;

export const ALL_PIPELINES = 'all';

/**
 * The buckets the card offers, most urgent first: that order is also how the
 * "All" view ranks its rows. `Running` has no chip — a run in flight is not
 * yet news — but those pipelines still show under All.
 */
export const PIPELINE_STATUS_BUCKETS = [
  LastRunStatus.Failed,
  LastRunStatus.Skipped,
  LastRunStatus.Pending,
  LastRunStatus.Successful,
] as const;

export type PipelineStatusBucket =
  | typeof ALL_PIPELINES
  | (typeof PIPELINE_STATUS_BUCKETS)[number];

interface BucketPage {
  rows: PipelineSummary[];
  total: number;
}

type PipelineStatusPages = Record<PipelineStatusBucket, BucketPage>;

export interface PipelineStatusOverview {
  /** Rows per bucket; `all` ranks failures first rather than by name. */
  rows: Record<PipelineStatusBucket, PipelineSummary[]>;
  /** Server totals per bucket, not counts over the rows in hand. */
  counts: Record<PipelineStatusBucket, number>;
  dataUpdatedAt: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

const toPage = (response: {
  data: PipelineSummary[];
  paging?: { total?: number };
}): BucketPage => ({
  rows: response.data ?? [],
  total: response.paging?.total ?? response.data?.length ?? 0,
});

/**
 * One page per status bucket plus one unfiltered. The summary endpoint orders
 * by name, so the unfiltered page alone would show whichever pipelines sort
 * first; the per-status pages are what lets "All" lead with failures, and
 * their totals are the chip counts.
 */
const fetchPipelineStatusPages = async (): Promise<PipelineStatusPages> => {
  const [all, ...byStatus] = await Promise.all([
    listPipelineSummaries({ limit: PIPELINE_STATUS_PAGE_SIZE }),
    ...PIPELINE_STATUS_BUCKETS.map((status) =>
      listPipelineSummaries({ limit: PIPELINE_STATUS_PAGE_SIZE, status })
    ),
  ]);

  return PIPELINE_STATUS_BUCKETS.reduce(
    (pages, status, index) => ({ ...pages, [status]: toPage(byStatus[index]) }),
    { [ALL_PIPELINES]: toPage(all) } as PipelineStatusPages
  );
};

/**
 * "All": every bucket in urgency order, then the name-ordered page to fill in
 * pipelines that are running or have never run.
 */
export const rankAllPipelines = (
  pages: PipelineStatusPages
): PipelineSummary[] => {
  const seen = new Set<string>();

  return [
    ...PIPELINE_STATUS_BUCKETS.flatMap((status) => pages[status].rows),
    ...pages[ALL_PIPELINES].rows,
  ]
    .filter((row) => {
      const isNew = !seen.has(row.pipelineId);
      seen.add(row.pipelineId);

      return isNew;
    })
    .slice(0, PIPELINE_STATUS_PAGE_SIZE);
};

const EMPTY_PAGE: BucketPage = { rows: [], total: 0 };

export const derivePipelineStatus = (
  pages: PipelineStatusPages | undefined
): Pick<PipelineStatusOverview, 'counts' | 'rows'> => {
  const bucketPage = (bucket: PipelineStatusBucket) =>
    pages?.[bucket] ?? EMPTY_PAGE;
  const buckets: PipelineStatusBucket[] = [
    ALL_PIPELINES,
    ...PIPELINE_STATUS_BUCKETS,
  ];

  return {
    counts: Object.fromEntries(
      buckets.map((bucket) => [bucket, bucketPage(bucket).total])
    ) as Record<PipelineStatusBucket, number>,
    rows: Object.fromEntries(
      buckets.map((bucket) => [
        bucket,
        bucket === ALL_PIPELINES && pages
          ? rankAllPipelines(pages)
          : bucketPage(bucket).rows,
      ])
    ) as Record<PipelineStatusBucket, PipelineSummary[]>,
  };
};

/** Pipelines with their latest run, bucketed by that run's status. */
export const usePipelineStatus = (): PipelineStatusOverview => {
  const { data, dataUpdatedAt, isPending, isFetching, isError, refetch } =
    useQuery({
      queryFn: fetchPipelineStatusPages,
      queryKey: PIPELINE_STATUS_QUERY_KEY,
      staleTime: PIPELINE_STATUS_TTL_MS,
    });

  return useMemo(
    () => ({
      ...derivePipelineStatus(data),
      dataUpdatedAt,
      isError,
      isFetching,
      isLoading: isPending,
      refetch: () => {
        void refetch();
      },
    }),
    [data, dataUpdatedAt, isPending, isFetching, isError, refetch]
  );
};

const fetchRunHistory = async (fqn: string): Promise<PipelineStatus[]> => {
  const endTs = Date.now();
  const { data } = await getPipelineStatus(fqn, {
    endTs,
    limit: PIPELINE_RUN_HISTORY_SIZE,
    startTs: endTs - PIPELINE_RUN_WINDOW_DAYS * DAY_MS,
  });

  // The endpoint answers newest first; the strip reads left to right in time.
  return [...(data ?? [])].reverse();
};

/**
 * Recent runs for the pipelines on screen, oldest first, keyed by FQN. One
 * request per visible row — the card lists at most a page, and a row whose
 * history fails simply draws an empty strip rather than failing the card.
 */
export const usePipelineRunHistory = (
  fqns: string[]
): Record<string, PipelineStatus[]> =>
  useQueries({
    queries: fqns.map((fqn) => ({
      queryFn: () => fetchRunHistory(fqn),
      queryKey: [...PIPELINE_RUNS_QUERY_KEY, fqn],
      staleTime: PIPELINE_STATUS_TTL_MS,
    })),
    // combine's output is memoised against the query results, so the map keeps
    // its identity across unrelated re-renders of the landing page.
    combine: useCallback(
      (results: Array<{ data?: PipelineStatus[] }>) =>
        Object.fromEntries(
          fqns.map((fqn, index) => [fqn, results[index]?.data ?? []])
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [fqns.join('|')]
    ),
  });
