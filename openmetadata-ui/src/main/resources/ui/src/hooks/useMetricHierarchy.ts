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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { METRIC_CHILDREN_PAGE_SIZE } from '../constants/Metric.constants';
import { TabSpecificField } from '../enums/entity.enum';
import { Kind } from '../generated/api/data/metricHierarchyItem';
import type { MetricGroup } from '../generated/entity/data/metricGroup';
import type { Paging } from '../generated/type/paging';
import { getMetricGroupMetrics } from '../rest/metricGroupsAPI';
import { getMetricHierarchy, getMetrics } from '../rest/metricsAPI';
import {
  createGroupLoadMoreRow,
  createGroupRow,
  createLoadMoreRow,
  MetricTableRow,
  MetricTreeNode,
} from '../utils/MetricEntityUtils/MetricHierarchyUtils';
import { showErrorToast } from '../utils/ToastUtils';

export const METRIC_TREE_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.PARENT,
  TabSpecificField.CHILDREN_COUNT,
  'metricGroup',
].join(',');

interface ChildPage {
  rows: MetricTreeNode[];
  after?: string;
  total: number;
  parentFqn: string;
}

interface GroupPage {
  rows: MetricTreeNode[];
  paging: Paging;
}

export interface MetricHierarchyNode {
  row: MetricTableRow;
  groupId?: string;
  members?: MetricTreeNode[];
  memberPaging?: Paging;
}

interface MetricHierarchyQueryData {
  nodes: MetricHierarchyNode[];
  paging: Paging;
}

export const metricTreeQueryKey = ({
  page,
  pageSize,
  query,
}: Required<Pick<UseMetricHierarchyParams, 'page' | 'pageSize'>> &
  Pick<UseMetricHierarchyParams, 'query'>) => [
  'metric-tree',
  { page, pageSize, query: query ?? '' },
];

export interface UseMetricHierarchyParams {
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  query?: string;
}

const asMetricTreeNode = (metric: object): MetricTreeNode =>
  metric as MetricTreeNode;

const asMetricGroup = (group: object): MetricGroup => group as MetricGroup;

export const useMetricHierarchy = ({
  enabled = true,
  page = 1,
  pageSize = 20,
  query,
}: UseMetricHierarchyParams = {}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [expandedGroupRowIds, setExpandedGroupRowIds] = useState<string[]>([]);
  const [childrenByParentId, setChildrenByParentId] = useState<
    Record<string, ChildPage>
  >({});
  const [groupPageOverrides, setGroupPageOverrides] = useState<
    Record<string, GroupPage>
  >({});
  const [loadingParentIds, setLoadingParentIds] = useState<string[]>([]);
  const [loadingGroupIds, setLoadingGroupIds] = useState<string[]>([]);
  const requestGeneration = useRef(0);
  const queryClient = useQueryClient();
  const normalizedQuery = query?.trim() || undefined;
  const queryKey = metricTreeQueryKey({
    page,
    pageSize,
    query: normalizedQuery,
  });

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<MetricHierarchyQueryData> => {
      const hierarchy = await getMetricHierarchy({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(normalizedQuery ? { q: normalizedQuery } : {}),
      });

      const nodes = (hierarchy.data ?? []).map((item): MetricHierarchyNode => {
        if (item.kind === Kind.MetricGroup && item.group) {
          const group = asMetricGroup(item.group);

          return {
            row: createGroupRow(group),
            groupId: group.id,
          };
        }

        if (item.kind === Kind.Metric && item.metric) {
          return { row: asMetricTreeNode(item.metric) };
        }

        throw new Error(`Invalid metric hierarchy item: ${item.kind}`);
      });

      return { nodes, paging: hierarchy.paging };
    },
    enabled,
  });

  useEffect(() => {
    requestGeneration.current += 1;
    setExpandedRowKeys([]);
    setExpandedGroupRowIds([]);
    setChildrenByParentId({});
    setGroupPageOverrides({});
    setLoadingParentIds([]);
    setLoadingGroupIds([]);
  }, [page, pageSize, normalizedQuery]);

  const fetchChildren = useCallback(
    async (parent: MetricTreeNode, after?: string) => {
      const parentFqn = parent.fullyQualifiedName;
      if (!parentFqn) {
        return;
      }
      const generation = requestGeneration.current;
      setLoadingParentIds((ids) => [...ids, parent.id]);
      try {
        const response = await getMetrics({
          parent: parentFqn,
          fields: METRIC_TREE_FIELDS,
          limit: METRIC_CHILDREN_PAGE_SIZE,
          ...(after ? { after } : {}),
        });

        if (requestGeneration.current !== generation) {
          return;
        }
        setChildrenByParentId((current) => {
          const existing = after ? current[parent.id]?.rows ?? [] : [];

          return {
            ...current,
            [parent.id]: {
              rows: [...existing, ...(response.data as MetricTreeNode[])],
              after: response.paging?.after,
              total: response.paging?.total ?? response.data.length,
              parentFqn,
            },
          };
        });
      } catch (fetchError) {
        if (requestGeneration.current === generation) {
          showErrorToast(fetchError as AxiosError);
        }

        throw fetchError;
      } finally {
        if (requestGeneration.current === generation) {
          setLoadingParentIds((ids) => ids.filter((id) => id !== parent.id));
        }
      }
    },
    []
  );

  const toggleExpand = useCallback(
    (expanded: boolean, metric: MetricTreeNode) => {
      if (expanded) {
        setExpandedRowKeys((keys) =>
          keys.includes(metric.id) ? keys : [...keys, metric.id]
        );
        if (!childrenByParentId[metric.id]) {
          fetchChildren(metric).catch(() => undefined);
        }
      } else {
        setExpandedRowKeys((keys) => keys.filter((key) => key !== metric.id));
      }
    },
    [childrenByParentId, fetchChildren]
  );

  const loadMoreChildren = useCallback(
    async (parentId: string) => {
      const childPage = childrenByParentId[parentId];
      if (childPage?.after) {
        await fetchChildren(
          {
            id: parentId,
            fullyQualifiedName: childPage.parentFqn,
          } as MetricTreeNode,
          childPage.after
        );
      }
    },
    [childrenByParentId, fetchChildren]
  );

  const initialNodes = useMemo(() => data?.nodes ?? [], [data?.nodes]);

  const fetchInitialGroupMembers = useCallback(
    async (groupId: string) => {
      const generation = requestGeneration.current;
      setLoadingGroupIds((ids) =>
        ids.includes(groupId) ? ids : [...ids, groupId]
      );
      try {
        const response = await getMetricGroupMetrics(groupId, {
          limit: METRIC_CHILDREN_PAGE_SIZE,
          offset: 0,
          rootOnly: true,
          ...(normalizedQuery ? { q: normalizedQuery } : {}),
        });
        if (requestGeneration.current !== generation) {
          return;
        }
        setGroupPageOverrides((current) => ({
          ...current,
          [groupId]: {
            rows: (response.data ?? []).map(asMetricTreeNode),
            paging: response.paging,
          },
        }));
      } catch (fetchError) {
        if (requestGeneration.current === generation) {
          showErrorToast(fetchError as AxiosError);
        }

        throw fetchError;
      } finally {
        if (requestGeneration.current === generation) {
          setLoadingGroupIds((ids) => ids.filter((id) => id !== groupId));
        }
      }
    },
    [normalizedQuery]
  );

  const toggleGroup = useCallback(
    (groupRowId: string) => {
      const node = initialNodes.find(({ row }) => row.id === groupRowId);
      if (!node?.groupId) {
        return;
      }
      if (expandedGroupRowIds.includes(groupRowId)) {
        setExpandedGroupRowIds((ids) => ids.filter((id) => id !== groupRowId));

        return;
      }

      setExpandedGroupRowIds((ids) =>
        ids.includes(groupRowId) ? ids : [...ids, groupRowId]
      );
      if (
        !groupPageOverrides[node.groupId] &&
        !loadingGroupIds.includes(node.groupId)
      ) {
        fetchInitialGroupMembers(node.groupId).catch(() => undefined);
      }
    },
    [
      expandedGroupRowIds,
      fetchInitialGroupMembers,
      groupPageOverrides,
      initialNodes,
      loadingGroupIds,
    ]
  );

  const loadMoreGroupMembers = useCallback(
    async (groupId: string) => {
      const node = initialNodes.find(
        (candidate) => candidate.groupId === groupId
      );
      const initialPage = node?.members
        ? { rows: node.members, paging: node.memberPaging ?? { total: 0 } }
        : undefined;
      const currentPage = groupPageOverrides[groupId] ?? initialPage;
      if (!currentPage || currentPage.rows.length >= currentPage.paging.total) {
        return;
      }

      setLoadingGroupIds((ids) => [...ids, groupId]);
      const generation = requestGeneration.current;
      try {
        const response = await getMetricGroupMetrics(groupId, {
          limit: METRIC_CHILDREN_PAGE_SIZE,
          offset: currentPage.rows.length,
          rootOnly: true,
          ...(normalizedQuery ? { q: normalizedQuery } : {}),
        });
        if (requestGeneration.current !== generation) {
          return;
        }
        setGroupPageOverrides((current) => ({
          ...current,
          [groupId]: {
            rows: [
              ...currentPage.rows,
              ...(response.data ?? []).map(asMetricTreeNode),
            ],
            paging: response.paging,
          },
        }));
      } catch (fetchError) {
        if (requestGeneration.current === generation) {
          showErrorToast(fetchError as AxiosError);
        }

        throw fetchError;
      } finally {
        if (requestGeneration.current === generation) {
          setLoadingGroupIds((ids) => ids.filter((id) => id !== groupId));
        }
      }
    },
    [groupPageOverrides, initialNodes, normalizedQuery]
  );

  const withChildren = useCallback(
    (metric: MetricTreeNode): MetricTableRow => {
      const hydrateNode = (node: MetricTreeNode): MetricTableRow => {
        const childPage = childrenByParentId[node.id];
        if (!childPage || !expandedRowKeys.includes(node.id)) {
          return { ...node, children: undefined };
        }
        const childRows: MetricTableRow[] = childPage.rows.map(hydrateNode);
        if (childPage.after) {
          childRows.push(
            createLoadMoreRow({
              parentId: node.id,
              parentFqn: childPage.parentFqn,
              remaining: Math.max(0, childPage.total - childPage.rows.length),
              after: childPage.after,
            })
          );
        }

        return { ...node, children: childRows } as MetricTreeNode;
      };

      return hydrateNode(metric);
    },
    [childrenByParentId, expandedRowKeys]
  );

  const topLevelNodes = useMemo(
    () =>
      initialNodes.map((node) => {
        if (!node.groupId) {
          return node;
        }
        const pageOverride = groupPageOverrides[node.groupId];

        return pageOverride
          ? {
              ...node,
              members: pageOverride.rows,
              memberPaging: pageOverride.paging,
            }
          : node;
      }),
    [groupPageOverrides, initialNodes]
  );

  const buildRows = useCallback(
    (nodes: MetricHierarchyNode[]): MetricTableRow[] => {
      const rows: MetricTableRow[] = [];
      nodes.forEach(({ row, groupId, members, memberPaging }) => {
        if (!groupId) {
          rows.push(withChildren(row as MetricTreeNode));

          return;
        }

        rows.push(row);
        if (!expandedGroupRowIds.includes(row.id)) {
          return;
        }
        (members ?? []).forEach((member) => rows.push(withChildren(member)));
        const remaining =
          (memberPaging?.total ?? members?.length ?? 0) -
          (members?.length ?? 0);
        if (remaining > 0) {
          rows.push(createGroupLoadMoreRow({ groupId, remaining }));
        }
      });

      return rows;
    },
    [expandedGroupRowIds, withChildren]
  );

  const collapsedGroupIds = useMemo(
    () =>
      topLevelNodes
        .filter(({ groupId }) => Boolean(groupId))
        .map(({ row }) => row.id)
        .filter((rowId) => !expandedGroupRowIds.includes(rowId)),
    [expandedGroupRowIds, topLevelNodes]
  );

  const expandAll = useCallback(() => {
    const groupNodes = topLevelNodes.filter(
      (node): node is MetricHierarchyNode & { groupId: string } =>
        Boolean(node.groupId)
    );
    setExpandedGroupRowIds(groupNodes.map(({ row }) => row.id));
    groupNodes.forEach(({ groupId }) => {
      if (!groupPageOverrides[groupId] && !loadingGroupIds.includes(groupId)) {
        fetchInitialGroupMembers(groupId).catch(() => undefined);
      }
    });
  }, [
    fetchInitialGroupMembers,
    groupPageOverrides,
    loadingGroupIds,
    topLevelNodes,
  ]);
  const collapseAll = useCallback(() => setExpandedGroupRowIds([]), []);

  const reset = useCallback(() => {
    requestGeneration.current += 1;
    setExpandedRowKeys([]);
    setExpandedGroupRowIds([]);
    setChildrenByParentId({});
    setGroupPageOverrides({});
    setLoadingParentIds([]);
    setLoadingGroupIds([]);
    queryClient.invalidateQueries({ queryKey: ['metric-tree'] });
  }, [queryClient]);

  return {
    topLevelNodes,
    buildRows,
    paging: data?.paging ?? { offset: 0, limit: pageSize, total: 0 },
    isPending,
    isFetching,
    error,
    refetch,
    expandedRowKeys,
    collapsedGroupIds,
    loadingParentIds,
    loadingGroupIds,
    toggleExpand,
    toggleGroup,
    loadMoreChildren,
    loadMoreGroupMembers,
    expandAll,
    collapseAll,
    reset,
  };
};
