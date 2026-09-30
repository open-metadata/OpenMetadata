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
import type { Metric } from '../../generated/entity/data/metric';
import type { MetricGroup } from '../../generated/entity/data/metricGroup';

/**
 * A metric row as the list table sees it.
 *
 * `children` is narrowed from the API's flat `EntityReference[]` to fully hydrated nodes: the tree
 * is assembled client-side from separately fetched metrics, and the table needs each child's own
 * `childrenCount` and status to render its row.
 */
export interface MetricTreeNode extends Omit<Metric, 'children'> {
  children?: MetricTreeNode[];
}

/**
 * A synthetic row appended under a parent whose children are paginated. It is not a metric, so it
 * must be excluded from selection and from anything that assumes a real entity.
 */
export interface MetricLoadMoreRow {
  id: string;
  isLoadMoreRow: true;
  scope: 'children' | 'group';
  parentId: string;
  parentFqn: string;
  remaining: number;
  after?: string;
}

/**
 * A group banner row. It spans the whole table rather than filling columns, is never selectable,
 * and is not a metric — so anything that treats a row as an entity has to skip it.
 */
export interface MetricGroupRow {
  id: string;
  isGroupRow: true;
  group: MetricGroup;
  memberCount: number;
}

export type MetricTableRow =
  | MetricTreeNode
  | MetricLoadMoreRow
  | MetricGroupRow;

export interface VisibleMetricTableRow {
  row: MetricTableRow;
  depth: number;
}

export const LOAD_MORE_ROW_PREFIX = 'load-more:';
export const GROUP_ROW_PREFIX = 'group:';

export const isGroupRow = (row: MetricTableRow): row is MetricGroupRow =>
  (row as MetricGroupRow).isGroupRow === true;

export const isLoadMoreRow = (row: MetricTableRow): row is MetricLoadMoreRow =>
  (row as MetricLoadMoreRow).isLoadMoreRow === true;

/** A row that stands in for something other than a metric, so it can never be acted on. */
export const isSyntheticRow = (row: MetricTableRow): boolean =>
  isLoadMoreRow(row) || isGroupRow(row);

/** Narrows a table row to a real metric, which is the only kind that can be selected or opened. */
export const isMetricRow = (row: MetricTableRow): row is MetricTreeNode =>
  !isLoadMoreRow(row) && !isGroupRow(row);

export const createGroupRow = (group: MetricGroup): MetricGroupRow => ({
  id: `${GROUP_ROW_PREFIX}${group.id}`,
  isGroupRow: true,
  group,
  memberCount: group.metricCount ?? group.metrics?.length ?? 0,
});

export const createLoadMoreRow = ({
  parentId,
  parentFqn,
  remaining,
  after,
}: Omit<
  MetricLoadMoreRow,
  'id' | 'isLoadMoreRow' | 'scope'
>): MetricLoadMoreRow => ({
  id: `${LOAD_MORE_ROW_PREFIX}${parentId}`,
  isLoadMoreRow: true,
  scope: 'children',
  parentId,
  parentFqn,
  remaining,
  after,
});

export const createGroupLoadMoreRow = ({
  groupId,
  remaining,
}: {
  groupId: string;
  remaining: number;
}): MetricLoadMoreRow => ({
  id: `${LOAD_MORE_ROW_PREFIX}group:${groupId}`,
  isLoadMoreRow: true,
  scope: 'group',
  parentId: groupId,
  parentFqn: '',
  remaining,
});

export const hasMetricChildren = (metric: MetricTreeNode): boolean =>
  (metric.childrenCount ?? 0) > 0 || (metric.children?.length ?? 0) > 0;

/**
 * Every real metric in the tree, at any depth, in render order.
 *
 * Anything resolving a selection has to use this rather than the top-level rows: a user can select
 * an expanded child, whose row is nested inside its parent and invisible to a flat scan.
 */
export const flattenMetricRows = (rows: MetricTableRow[]): MetricTreeNode[] => {
  const flat: MetricTreeNode[] = [];

  const visit = (current: MetricTableRow[]) => {
    current.forEach((row) => {
      if (!isMetricRow(row)) {
        return;
      }
      flat.push(row);
      visit(row.children ?? []);
    });
  };

  visit(rows);

  return flat;
};

/**
 * Flattens the currently expanded hierarchy for renderers that do not support nested rows.
 * Group members start one level below their banner; recursively loaded variants retain their
 * depth so table and card views expose the same hierarchy.
 */
export const flattenVisibleMetricRows = (
  rows: MetricTableRow[]
): VisibleMetricTableRow[] => {
  const visibleRows: VisibleMetricTableRow[] = [];
  let groupIsActive = false;

  const visitMetric = (row: MetricTreeNode, depth: number) => {
    visibleRows.push({ row, depth });
    row.children?.forEach((child) => {
      if (isMetricRow(child)) {
        visitMetric(child, depth + 1);
      } else {
        visibleRows.push({ row: child, depth: depth + 1 });
      }
    });
  };

  rows.forEach((row) => {
    if (isGroupRow(row)) {
      groupIsActive = true;
      visibleRows.push({ row, depth: 0 });

      return;
    }

    if (isLoadMoreRow(row)) {
      visibleRows.push({ row, depth: row.scope === 'group' ? 1 : 0 });

      return;
    }

    const belongsToActiveGroup = groupIsActive && Boolean(row.metricGroup);
    if (!row.metricGroup) {
      groupIsActive = false;
    }
    visitMetric(row, belongsToActiveGroup ? 1 : 0);
  });

  return visibleRows;
};

/**
 * Replaces one node's children in place, returning a new tree. Used when a parent's children finish
 * loading, so React sees a changed reference for that branch only.
 */
export const attachChildren = (
  nodes: MetricTableRow[],
  parentId: string,
  children: MetricTableRow[]
): MetricTableRow[] =>
  nodes.map((row) => {
    if (!isMetricRow(row)) {
      return row;
    }
    if (row.id === parentId) {
      return { ...row, children } as MetricTreeNode;
    }
    if (row.children?.length) {
      return {
        ...row,
        children: attachChildren(row.children, parentId, children),
      } as MetricTreeNode;
    }

    return row;
  });
