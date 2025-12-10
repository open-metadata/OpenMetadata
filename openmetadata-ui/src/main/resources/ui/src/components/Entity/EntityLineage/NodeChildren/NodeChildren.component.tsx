/*
 *  Copyright 2024 Collate.
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
import { SearchOutlined } from '@ant-design/icons';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { IconButton, Stack, Typography } from '@mui/material';
import { Collapse, Input } from 'antd';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BORDER_COLOR,
  LINEAGE_CHILD_ITEMS_PER_PAGE,
} from '../../../../constants/constants';
import {
  DATATYPES_HAVING_SUBFIELDS,
  LINEAGE_COLUMN_NODE_SUPPORTED,
} from '../../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../../enums/entity.enum';
import { Column, Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import {
  EntityReference,
  TestSummary,
} from '../../../../generated/tests/testCase';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageUtils';
import EntityLink from '../../../../utils/EntityLink';
import { getEntityName } from '../../../../utils/EntityUtils';
import { ColumnContent } from '../CustomNode.utils';
import {
  EntityChildren,
  EntityChildrenItem,
  NodeChildrenProps,
} from './NodeChildren.interface';

interface CustomPaginatedListProps {
  children: EntityChildren;
  isOnlyShowColumnsWithLineageFilterActive?: boolean;
  items: React.ReactNode[];
  nodeId?: string;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

const CustomPaginatedList = ({
  children,
  isOnlyShowColumnsWithLineageFilterActive,
  items,
  nodeId,
  page,
  setPage,
}: CustomPaginatedListProps) => {
  const allColumnsInCurrentNode = Object.values(children ?? {});
  const { t } = useTranslation();
  const { setColumnsInCurrentPages, useUpdateNodeInternals } =
    useLineageProvider();
  const updateNodeInternals = useUpdateNodeInternals();

  const getAllNestedChildrenInFlatArray = useCallback(
    (item: EntityChildrenItem): string[] => {
      const result: string[] = [];

      if (item.fullyQualifiedName) {
        result.push(item.fullyQualifiedName);
      }

      if (
        'children' in item &&
        Array.isArray(item.children) &&
        item.children.length > 0
      ) {
        for (const child of item.children) {
          result.push(...getAllNestedChildrenInFlatArray(child));
        }
      }

      return result;
    },
    []
  );

  const currentNodeAllPagesItems = useMemo(
    () =>
      allColumnsInCurrentNode.flatMap((item) =>
        getAllNestedChildrenInFlatArray(item)
      ),
    [allColumnsInCurrentNode, getAllNestedChildrenInFlatArray]
  );

  const {
    totalPages,
    insideCurrentPageItems,
    outsideCurrentPageItems,
    currentNodeCurrentPageItems,
  } = useMemo(() => {
    const totalPages = Math.ceil(items.length / LINEAGE_CHILD_ITEMS_PER_PAGE);
    const startIdx = (page - 1) * LINEAGE_CHILD_ITEMS_PER_PAGE;
    const endIdx = startIdx + LINEAGE_CHILD_ITEMS_PER_PAGE;

    const insideCurrentPageItems: React.ReactNode[] = [];
    const outsideCurrentPageItems: React.ReactNode[] = [];

    items.forEach((item, i) => {
      const wrappedItem = (
        <div
          className={
            i >= startIdx && i < endIdx
              ? 'inside-current-page-item'
              : 'outside-current-page-item'
          }>
          {item}
        </div>
      );

      if (i >= startIdx && i < endIdx) {
        insideCurrentPageItems.push(wrappedItem);
      } else {
        outsideCurrentPageItems.push(wrappedItem);
      }
    });

    const currentNodeCurrentPageItems = allColumnsInCurrentNode
      .slice(startIdx, endIdx)
      .filter(Boolean)
      .flatMap((item) => getAllNestedChildrenInFlatArray(item));

    return {
      totalPages,
      insideCurrentPageItems,
      outsideCurrentPageItems,
      currentNodeCurrentPageItems,
    };
  }, [
    items,
    page,
    allColumnsInCurrentNode,
    getAllNestedChildrenInFlatArray,
    isOnlyShowColumnsWithLineageFilterActive,
  ]);

  /**
   * This updates `columnsInCurrentPages` object for current node
   *
   * When page or filter is changed, this effect is called
   * When filter is activated
   *  - entry for nodeid is updated with `currentNodeAllPagesItems`
   *  - `currentNodeAllPagesItems` is updated using `filteredColumns`
   *  - `filteredColumns` is updated to only include columns having lineage
   * When filter is deactivated
   *  - entry is updated with `currentNodeCurrentPageItems`.
   *  - `currentNodeCurrentPageItems` is updated using `filteredColumns`
   *  - `filteredColumns` is updated to include all columns of current node
   */
  useEffect(() => {
    setColumnsInCurrentPages((prev) => {
      const updated = { ...prev };
      if (nodeId) {
        updated[nodeId] = isOnlyShowColumnsWithLineageFilterActive
          ? currentNodeAllPagesItems
          : currentNodeCurrentPageItems;
      }
      return updated;
    });
  }, [isOnlyShowColumnsWithLineageFilterActive, page]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      if (nodeId) {
        updateNodeInternals(nodeId);
      }
    },
    [currentNodeCurrentPageItems, nodeId, updateNodeInternals]
  );

  const handlePrev = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      handlePageChange(Math.max(page - 1, 1));
    },
    [page, handlePageChange]
  );

  const handleNext = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      handlePageChange(Math.min(page + 1, totalPages));
    },
    [page, totalPages, handlePageChange]
  );

  if (isOnlyShowColumnsWithLineageFilterActive) {
    return items;
  }

  return (
    <>
      <Stack className="inside-current-page-items" spacing={1}>
        {insideCurrentPageItems}
      </Stack>
      <Stack className="outside-current-page-items" spacing={1}>
        {outsideCurrentPageItems}
      </Stack>

      {!isOnlyShowColumnsWithLineageFilterActive && (
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="center"
          mt={2}
          spacing={1}>
          <IconButton
            data-testid="prev-btn"
            disabled={page === 1}
            size="small"
            onClick={handlePrev}>
            <ChevronLeftIcon />
          </IconButton>

          <Typography variant="body2">
            {page} {t('label.slash-symbol')} {totalPages}
          </Typography>

          <IconButton
            data-testid="next-btn"
            disabled={page === totalPages}
            size="small"
            onClick={handleNext}>
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      )}
    </>
  );
};

const NodeChildren = ({
  node,
  isConnectable,
  isChildrenListExpanded,
  isOnlyShowColumnsWithLineageFilterActive,
}: NodeChildrenProps) => {
  const { t } = useTranslation();
  const { Panel } = Collapse;
  const {
    tracedColumns,
    activeLayer,
    onColumnClick,
    onColumnMouseEnter,
    onColumnMouseLeave,
    columnsHavingLineage,
    isEditMode,
    expandAllColumns,
    selectedColumn,
    useUpdateNodeInternals,
    isCreatingEdge,
  } = useLineageProvider();
  const updateNodeInternals = useUpdateNodeInternals();
  const { entityType } = node;
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<EntityChildren>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [summary, setSummary] = useState<TestSummary>();
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const { isColumnLayerEnabled, showDataObservability } = useMemo(() => {
    return {
      isColumnLayerEnabled: activeLayer.includes(
        LineageLayer.ColumnLevelLineage
      ),
      showDataObservability: activeLayer.includes(
        LineageLayer.DataObservability
      ),
    };
  }, [activeLayer]);

  const getColumnSummary = useCallback(
    (column: Column) => {
      const { fullyQualifiedName } = column;

      return summary?.columnTestSummary?.find(
        (data) =>
          EntityLink.getEntityColumnFqn(data.entityLink ?? '') ===
          fullyQualifiedName
      );
    },
    [summary]
  );

  const showDataObservabilitySummary = useMemo(() => {
    return Boolean(
      showDataObservability &&
        entityType === EntityType.TABLE &&
        (node as Table).testSuite
    );
  }, [node, showDataObservability, entityType]);

  const supportsColumns = useMemo(() => {
    return (
      node &&
      LINEAGE_COLUMN_NODE_SUPPORTED.includes(node.entityType as EntityType)
    );
  }, [node]);

  const { children, childrenHeading } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const value = e.target.value;
      setSearchValue(value);
      const allColumnsInCurrentNode = Object.values(children ?? {});
      const allColumsHavingLineageInCurrentNode =
        allColumnsInCurrentNode.filter((item) =>
          columnsHavingLineage.includes(item.fullyQualifiedName ?? '')
        );
      const allColumnsForSearchDomainInCurrentNode =
        isOnlyShowColumnsWithLineageFilterActive
          ? allColumsHavingLineageInCurrentNode
          : allColumnsInCurrentNode;

      if (value.trim() === '') {
        // If search value is empty, show all columns
        setFilteredColumns(allColumnsForSearchDomainInCurrentNode);
        setShowAllColumns(false);
      } else {
        // Filter columns based on search value
        const filteredColumnsInCurrentNode =
          allColumnsForSearchDomainInCurrentNode.filter((column) =>
            getEntityName(column).toLowerCase().includes(value.toLowerCase())
          );
        setFilteredColumns(filteredColumnsInCurrentNode);
        setShowAllColumns(true);
      }
    },
    [children, isOnlyShowColumnsWithLineageFilterActive]
  );

  const isColumnVisible = useCallback(
    (record: Column) => {
      if (
        expandAllColumns ||
        isEditMode ||
        showAllColumns ||
        isChildrenListExpanded
      ) {
        return true;
      }

      return columnsHavingLineage.includes(record.fullyQualifiedName ?? '');
    },
    [
      isEditMode,
      columnsHavingLineage,
      expandAllColumns,
      showAllColumns,
      isChildrenListExpanded,
    ]
  );

  /**
   * This updates `filteredColumns` with `columnsHavingLineageInCurrentNode` when filter is activated
   * or with `children` when filter is deactivated.
   * `columnsHavingLineageInCurrentNode` is created using `allColumnsInCurrentNode`
   * `allColumnsInCurrentNode` is created using `children`
   */
  useEffect(() => {
    if (!isEmpty(children)) {
      const allColumnsInCurrentNode = Object.values(children ?? {});
      if (isOnlyShowColumnsWithLineageFilterActive) {
        const columnsHavingLineageInCurrentNode =
          allColumnsInCurrentNode.filter((item) =>
            columnsHavingLineage.includes(item.fullyQualifiedName ?? '')
          );
        setFilteredColumns(columnsHavingLineageInCurrentNode);
      } else {
        setFilteredColumns(allColumnsInCurrentNode);
      }
    }
  }, [
    children,
    isOnlyShowColumnsWithLineageFilterActive,
    columnsHavingLineage,
  ]);

  useEffect(() => {
    setShowAllColumns(expandAllColumns);
  }, [expandAllColumns]);

  useEffect(() => {
    if (node.id) {
      updateNodeInternals?.(node.id);
    }
  }, [
    selectedColumn,
    updateNodeInternals,
    tracedColumns,
    node.id,
    isOnlyShowColumnsWithLineageFilterActive,
  ]);

  const fetchTestSuiteSummary = async (testSuite: EntityReference) => {
    setIsLoading(true);
    try {
      const response = await getTestCaseExecutionSummary(testSuite.id);
      setSummary(response);
    } catch {
      setSummary(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const testSuite = (node as Table)?.testSuite;
    if (showDataObservabilitySummary && testSuite && isUndefined(summary)) {
      fetchTestSuiteSummary(testSuite);
    } else {
      setIsLoading(false);
    }
  }, [node, showDataObservabilitySummary, summary]);

  const renderRecord = useCallback(
    (record: Column) => {
      const isColumnTraced = tracedColumns.includes(
        record.fullyQualifiedName ?? ''
      );

      const columnSummary = getColumnSummary(record);

      const headerContent = (
        <ColumnContent
          column={record}
          isColumnTraced={isColumnTraced}
          isConnectable={isConnectable}
          isLoading={isLoading}
          showDataObservabilitySummary={showDataObservabilitySummary}
          summary={columnSummary}
        />
      );

      if (!record.children || record.children.length === 0) {
        if (!isColumnVisible(record)) {
          return null;
        }

        return headerContent;
      }

      const childRecords = record?.children?.map((child) => {
        const { fullyQualifiedName, dataType } = child;

        const columnSummary = getColumnSummary(child);

        if (DATATYPES_HAVING_SUBFIELDS.includes(dataType)) {
          return renderRecord(child);
        } else {
          const isColumnTraced = tracedColumns.includes(
            fullyQualifiedName ?? ''
          );

          if (!isColumnVisible(child)) {
            return null;
          }

          return (
            <ColumnContent
              column={child}
              isColumnTraced={isColumnTraced}
              isConnectable={isConnectable}
              isLoading={isLoading}
              key={fullyQualifiedName}
              showDataObservabilitySummary={showDataObservabilitySummary}
              summary={columnSummary}
            />
          );
        }
      });

      const result = childRecords.filter((child) => child !== null);

      if (result.length === 0) {
        return null;
      }

      return (
        <Collapse
          destroyInactivePanel
          className="lineage-collapse-column"
          defaultActiveKey={record.fullyQualifiedName}
          expandIcon={() => null}
          key={record.fullyQualifiedName}>
          <Panel header={headerContent} key={record.fullyQualifiedName ?? ''}>
            {result}
          </Panel>
        </Collapse>
      );
    },
    [
      tracedColumns,
      getColumnSummary,
      selectedColumn,
      isConnectable,
      onColumnClick,
      onColumnMouseEnter,
      onColumnMouseLeave,
      showDataObservabilitySummary,
      isLoading,
      Panel,
      isColumnVisible,
    ]
  );
  const renderColumnsData = useCallback(
    (column: Column) => {
      const { fullyQualifiedName, dataType } = column;
      const columnSummary = getColumnSummary(column);

      if (DATATYPES_HAVING_SUBFIELDS.includes(dataType)) {
        return renderRecord(column);
      } else {
        const isColumnTraced = tracedColumns.includes(fullyQualifiedName ?? '');
        if (!isColumnVisible(column)) {
          return null;
        }

        return (
          <ColumnContent
            column={column}
            isColumnTraced={isColumnTraced}
            isConnectable={isConnectable}
            isLoading={isLoading}
            showDataObservabilitySummary={showDataObservabilitySummary}
            summary={columnSummary}
          />
        );
      }
    },
    [
      getColumnSummary,
      renderRecord,
      tracedColumns,
      isColumnVisible,
      selectedColumn,
      isConnectable,
      onColumnClick,
      onColumnMouseEnter,
      onColumnMouseLeave,
      showDataObservabilitySummary,
      isLoading,
    ]
  );

  // Pre-render column data outside of the return statement
  const renderedColumns = useMemo(() => {
    return filteredColumns
      .map((column) => renderColumnsData(column as Column))
      .filter(Boolean);
  }, [filteredColumns, renderColumnsData]);

  if (
    supportsColumns &&
    (isColumnLayerEnabled || showDataObservability || isChildrenListExpanded)
  ) {
    return (
      isChildrenListExpanded &&
      !isEmpty(children) && (
        <div
          className={classNames(
            'column-container',
            selectedColumn && 'any-column-selected',
            isCreatingEdge && 'creating-edge'
          )}
          data-testid="column-container">
          <div className="search-box">
            <Input
              data-testid="search-column-input"
              placeholder={t('label.search-entity', {
                entity: childrenHeading,
              })}
              suffix={<SearchOutlined color={BORDER_COLOR} />}
              value={searchValue}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
            />

            {!isEmpty(renderedColumns) && (
              <section className="m-t-md" id="table-columns">
                <div className="rounded-4 overflow-hidden">
                  <CustomPaginatedList
                    children={children}
                    isOnlyShowColumnsWithLineageFilterActive={
                      isOnlyShowColumnsWithLineageFilterActive
                    }
                    items={renderedColumns}
                    nodeId={node.id}
                    page={page}
                    setPage={setPage}
                  />
                </div>
              </section>
            )}
          </div>
        </div>
      )
    );
  } else {
    return null;
  }
};

export default NodeChildren;

/**
 * Rename for columnshavinglineage to be consistent
 */
