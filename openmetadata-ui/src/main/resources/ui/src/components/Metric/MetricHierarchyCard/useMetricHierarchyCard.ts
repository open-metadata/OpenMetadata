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
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { METRIC_HIERARCHY_PEER_LIMIT } from '../../../constants/Metric.constants';
import { Metric } from '../../../generated/entity/data/metric';
import { MetricGroup } from '../../../generated/entity/data/metricGroup';
import { getMetricHierarchyContext } from '../../../rest/metricsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';

export const metricHierarchyQueryKey = (metricId: string) => [
  'metric-hierarchy',
  metricId,
];

const asMetric = (value: object): Metric => value as Metric;
const asMetricGroup = (value: object): MetricGroup => value as MetricGroup;

const appendUnique = (current: Metric[], next: Metric[]) => {
  const knownIds = new Set(current.map(({ id }) => id));

  return [...current, ...next.filter(({ id }) => !knownIds.has(id))];
};

export const useMetricHierarchyCard = (metric?: Metric) => {
  const [additionalChildren, setAdditionalChildren] = useState<Metric[]>([]);
  const [additionalSiblings, setAdditionalSiblings] = useState<Metric[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [isLoadingSiblings, setIsLoadingSiblings] = useState(false);

  useEffect(() => {
    setAdditionalChildren([]);
    setAdditionalSiblings([]);
  }, [metric?.id]);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: metricHierarchyQueryKey(metric?.id ?? ''),
    queryFn: () =>
      getMetricHierarchyContext(metric?.id ?? '', {
        childLimit: METRIC_HIERARCHY_PEER_LIMIT,
        childOffset: 0,
        siblingLimit: METRIC_HIERARCHY_PEER_LIMIT,
        siblingOffset: 0,
      }),
    enabled: Boolean(metric?.id),
  });

  const initialChildren = useMemo(
    () => (data?.children ?? []).map(asMetric),
    [data?.children]
  );
  const initialSiblings = useMemo(
    () => (data?.siblings ?? []).map(asMetric),
    [data?.siblings]
  );
  const children = useMemo(
    () => appendUnique(initialChildren, additionalChildren),
    [additionalChildren, initialChildren]
  );
  const allSiblings = useMemo(
    () => appendUnique(initialSiblings, additionalSiblings),
    [additionalSiblings, initialSiblings]
  );
  const siblings = useMemo(
    () => allSiblings.filter(({ id }) => id !== metric?.id),
    [allSiblings, metric?.id]
  );
  const loadedSiblingCount = initialSiblings.length + additionalSiblings.length;
  const loadedChildCount = initialChildren.length + additionalChildren.length;
  const hasMoreSiblings = loadedSiblingCount < (data?.siblingPaging.total ?? 0);
  const hasMoreChildren = loadedChildCount < (data?.childrenPaging.total ?? 0);

  const loadMoreChildren = useCallback(async () => {
    if (!metric?.id || !hasMoreChildren || isLoadingChildren) {
      return;
    }
    setIsLoadingChildren(true);
    try {
      const next = await getMetricHierarchyContext(metric.id, {
        childLimit: METRIC_HIERARCHY_PEER_LIMIT,
        childOffset: loadedChildCount,
        siblingLimit: 0,
        siblingOffset: 0,
      });
      setAdditionalChildren((current) =>
        appendUnique(current, (next.children ?? []).map(asMetric))
      );
    } catch (fetchError) {
      showErrorToast(fetchError as AxiosError);

      throw fetchError;
    } finally {
      setIsLoadingChildren(false);
    }
  }, [hasMoreChildren, isLoadingChildren, loadedChildCount, metric?.id]);

  const loadMoreSiblings = useCallback(async () => {
    if (!metric?.id || !hasMoreSiblings || isLoadingSiblings) {
      return;
    }
    setIsLoadingSiblings(true);
    try {
      const next = await getMetricHierarchyContext(metric.id, {
        childLimit: 0,
        childOffset: 0,
        siblingLimit: METRIC_HIERARCHY_PEER_LIMIT,
        siblingOffset: loadedSiblingCount,
      });
      setAdditionalSiblings((current) =>
        appendUnique(current, (next.siblings ?? []).map(asMetric))
      );
    } catch (fetchError) {
      showErrorToast(fetchError as AxiosError);

      throw fetchError;
    } finally {
      setIsLoadingSiblings(false);
    }
  }, [hasMoreSiblings, isLoadingSiblings, loadedSiblingCount, metric?.id]);

  return {
    group: data?.group ? asMetricGroup(data.group) : undefined,
    ancestors: (data?.ancestors ?? []).map(asMetric),
    siblings,
    children,
    isPending,
    error,
    refetch,
    hasMoreChildren,
    hasMoreSiblings,
    isLoadingChildren,
    isLoadingSiblings,
    loadMoreChildren,
    loadMoreSiblings,
  };
};
