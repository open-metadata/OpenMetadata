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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronUp } from '@untitledui/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LINEAGE_CHILD_ITEMS_PER_PAGE } from '../../../../constants/constants';
import { TestSummary } from '../../../../generated/tests/testCase';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import EntityLink from '../../../../utils/EntityLink';
import { ColumnContent } from '../CustomNode.utils';
import { EntityChildren, EntityChildrenItem } from './NodeChildren.interface';

export interface VirtualColumnListProps {
  flatItems: EntityChildren;
  isConnectable: boolean;
  isLoading: boolean;
  nodeId?: string;
  showDataObservabilitySummary: boolean;
  summary?: TestSummary;
  pageSize?: number;
}

const VirtualColumnList = ({
  flatItems,
  isConnectable,
  isLoading,
  nodeId,
  showDataObservabilitySummary,
  summary,
  pageSize = LINEAGE_CHILD_ITEMS_PER_PAGE,
}: VirtualColumnListProps) => {
  const { updateColumnsInCurrentPages, selectedColumn, tracedColumns } =
    useLineageStore();
  const [offset, setOffset] = useState(0);
  const prevColumnFqnsRef = React.useRef<string>('');

  // Reset window to top when flatItems changes (filter/search)
  useEffect(() => {
    setOffset(0);
  }, [flatItems]);

  const endIndex = Math.min(flatItems.length - 1, offset + pageSize - 1);

  const visibleFlatItems = useMemo(
    () => flatItems.slice(offset, endIndex + 1),
    [flatItems, offset, endIndex]
  );

  const outsideFlatItems = useMemo(() => {
    if (tracedColumns.size === 0) {
      return [];
    }

    return [
      ...flatItems.slice(0, offset),
      ...flatItems.slice(endIndex + 1),
    ].filter((fi) => tracedColumns.has(fi.fullyQualifiedName ?? ''));
  }, [flatItems, offset, endIndex, tracedColumns]);

  // Keep edge renderer in sync with the visible window
  useEffect(() => {
    if (!nodeId) {
      return;
    }

    const columnFqns = [...visibleFlatItems, ...outsideFlatItems].map(
      (fi) => fi.fullyQualifiedName ?? ''
    );

    const columnFqnsKey = columnFqns.join(',');

    if (prevColumnFqnsRef.current !== columnFqnsKey) {
      prevColumnFqnsRef.current = columnFqnsKey;
      updateColumnsInCurrentPages(nodeId, columnFqns);
    }

    return () => {
      // clear columns hence edges will be discarded
      updateColumnsInCurrentPages(nodeId, []);
      prevColumnFqnsRef.current = '';
    };
  }, [visibleFlatItems, nodeId, outsideFlatItems, updateColumnsInCurrentPages]);
  const canScrollUp = offset > 0;
  const canScrollDown = endIndex < flatItems.length - 1;

  const handleUp = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setOffset((prev) => Math.max(0, prev - pageSize));
    },
    [pageSize]
  );

  const handleDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setOffset((prev) =>
        Math.min(flatItems.length - pageSize, prev + pageSize)
      );
    },
    [flatItems.length, pageSize]
  );

  const getColumnSummary = useCallback(
    (column: EntityChildrenItem) =>
      summary?.columnTestSummary?.find(
        (data) =>
          EntityLink.getEntityColumnFqn(data.entityLink ?? '') ===
          column.fullyQualifiedName
      ),
    [summary]
  );

  const renderFlatItem = useCallback(
    (column: EntityChildrenItem, className: string) => {
      const { depth = 0 } = 'depth' in column ? column : {};
      const columnSummary = getColumnSummary(column);

      return (
        <ColumnContent
          className={className}
          column={column}
          depth={depth}
          isConnectable={isConnectable}
          isLoading={isLoading}
          key={column.fullyQualifiedName}
          showDataObservabilitySummary={showDataObservabilitySummary}
          summary={columnSummary}
        />
      );
    },
    // selectedColumn triggers re-render when column selection changes
    [
      getColumnSummary,
      isConnectable,
      isLoading,
      showDataObservabilitySummary,
      selectedColumn,
    ]
  );

  if (flatItems.length === 0) {
    return null;
  }

  const needsNavigation = flatItems.length > pageSize;

  return (
    <>
      {needsNavigation && (
        <div className="tw:flex tw:items-center tw:justify-center">
          <ButtonUtility
            color="tertiary"
            data-testid="column-scroll-up"
            disabled={!canScrollUp}
            icon={ChevronUp}
            onClick={handleUp}
          />
        </div>
      )}

      <div className="inside-current-page-items">
        {visibleFlatItems.map((fi) =>
          renderFlatItem(fi, 'inside-current-page-item')
        )}
      </div>

      <div className="outside-current-page-items">
        {outsideFlatItems.map((fi) =>
          renderFlatItem(fi, 'outside-current-page-item')
        )}
      </div>

      {needsNavigation && (
        <div className="tw:flex tw:items-center tw:justify-center">
          <ButtonUtility
            color="tertiary"
            data-testid="column-scroll-down"
            disabled={!canScrollDown}
            icon={ChevronDown}
            onClick={handleDown}
          />
        </div>
      )}
    </>
  );
};

export default VirtualColumnList;
