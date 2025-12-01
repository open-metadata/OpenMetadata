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
import { BORDER_COLOR } from '../../../../constants/constants';
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
import { getColumnContent } from '../CustomNode.utils';
import {
  EntityChildren,
  EntityChildrenItem,
  NodeChildrenProps,
} from './NodeChildren.interface';

interface CustomPaginatedListProps {
  items: React.ReactNode[];
  filteredColumns: EntityChildren;
  nodeId?: string;
}

const CustomPaginatedList = ({
  items,
  filteredColumns,
  nodeId,
}: CustomPaginatedListProps) => {
  const ITEMS_PER_PAGE = 5;
  const [page, setPage] = useState(1);
  const [itemsOfPreviousPage, setItemsOfPreviousPage] = useState<string[]>([]);
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

  const {
    totalPages,
    insideCurrentPageItems,
    outsideCurrentPageItems,
    itemsOfCurrentPage,
  } = useMemo(() => {
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;

    const insideCurrentPageItems: React.ReactNode[] = [];
    const outsideCurrentPageItems: React.ReactNode[] = [];

    items.forEach((item, i) => {
      const wrappedItem = (
        <div
          className={
            i >= startIdx && i < endIdx
              ? 'inside-current-page'
              : 'outside-current-page'
          }
          key={i}>
          {item}
        </div>
      );

      if (i >= startIdx && i < endIdx) {
        insideCurrentPageItems.push(wrappedItem);
      } else {
        outsideCurrentPageItems.push(wrappedItem);
      }
    });

    const itemsOfCurrentPage = filteredColumns
      .slice(startIdx, endIdx)
      .filter(Boolean)
      .flatMap((item) => getAllNestedChildrenInFlatArray(item));

    return {
      totalPages,
      insideCurrentPageItems,
      outsideCurrentPageItems,
      itemsOfCurrentPage,
    };
  }, [items, page, filteredColumns, getAllNestedChildrenInFlatArray]);

  useEffect(() => {
    setColumnsInCurrentPages((prev) => {
      const filtered = prev.filter(
        (item) => !itemsOfPreviousPage.includes(item)
      );

      const updated = new Set(filtered);
      itemsOfCurrentPage.forEach((item) => updated.add(item));

      return Array.from(updated);
    });
  }, [itemsOfPreviousPage, itemsOfCurrentPage, setColumnsInCurrentPages]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setItemsOfPreviousPage(itemsOfCurrentPage);
      setPage(newPage);
      if (nodeId) {
        updateNodeInternals(nodeId);
      }
    },
    [itemsOfCurrentPage, nodeId, updateNodeInternals]
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

  return (
    <>
      <Stack className="inside-current-page-items" spacing={1}>
        {insideCurrentPageItems}
      </Stack>
      <Stack className="outside-current-page-items" spacing={1}>
        {outsideCurrentPageItems}
      </Stack>

      <Stack
        alignItems="center"
        direction="row"
        justifyContent="center"
        mt={2}
        spacing={1}>
        <IconButton disabled={page === 1} size="small" onClick={handlePrev}>
          <ChevronLeftIcon />
        </IconButton>

        <Typography variant="body2">
          {page} {t('label.slash-symbol')} {totalPages}
        </Typography>

        <IconButton
          disabled={page === totalPages}
          size="small"
          onClick={handleNext}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>
    </>
  );
};

const NodeChildren = ({
  node,
  isConnectable,
  isChildrenListExpanded,
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

      if (value.trim() === '') {
        // If search value is empty, show all columns
        const filterColumns = Object.values(children ?? {});
        setFilteredColumns(filterColumns);
        setShowAllColumns(false);
      } else {
        // Filter columns based on search value
        const filtered = Object.values(children ?? {}).filter((column) =>
          getEntityName(column).toLowerCase().includes(value.toLowerCase())
        );
        setFilteredColumns(filtered);
        setShowAllColumns(true);
      }
    },
    [children]
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

  useEffect(() => {
    if (!isEmpty(children)) {
      setFilteredColumns(children);
    }
  }, [children]);

  useEffect(() => {
    setShowAllColumns(expandAllColumns);
  }, [expandAllColumns]);

  useEffect(() => {
    if (node.id) {
      updateNodeInternals?.(node.id);
    }
  }, [selectedColumn, updateNodeInternals, tracedColumns, node.id]);

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

      const headerContent = getColumnContent(
        record,
        isColumnTraced,
        selectedColumn,
        isConnectable,
        onColumnClick,
        onColumnMouseEnter,
        onColumnMouseLeave,
        showDataObservabilitySummary,
        isLoading,
        columnSummary
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

          return getColumnContent(
            child,
            isColumnTraced,
            selectedColumn,
            isConnectable,
            onColumnClick,
            onColumnMouseEnter,
            onColumnMouseLeave,
            showDataObservabilitySummary,
            isLoading,
            columnSummary
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

        return getColumnContent(
          column,
          isColumnTraced,
          selectedColumn,
          isConnectable,
          onColumnClick,
          onColumnMouseEnter,
          onColumnMouseLeave,
          showDataObservabilitySummary,
          isLoading,
          columnSummary
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

  const tracedColumnsForThisNode = useMemo(() => {
    return filteredColumns
      .filter((record) =>
        tracedColumns.includes(record.fullyQualifiedName ?? '')
      )
      .filter(Boolean)
      .map((column) => renderColumnsData(column as Column));
  }, [filteredColumns, renderColumnsData, tracedColumns]);

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
      <>
        {isChildrenListExpanded && !isEmpty(children) && (
          <div
            className={classNames(
              'column-container',
              selectedColumn && 'any-column-selected',
              isCreatingEdge && 'creating-edge'
            )}
            data-testid="column-container">
            <div className="search-box">
              {isChildrenListExpanded && (
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
              )}

              {isChildrenListExpanded && !isEmpty(renderedColumns) && (
                <section className="m-t-md" id="table-columns">
                  <div className="rounded-4 overflow-hidden">
                    <CustomPaginatedList
                      filteredColumns={filteredColumns}
                      items={renderedColumns}
                      nodeId={node.id}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {!isChildrenListExpanded && (
          <div
            className={classNames(
              'column-container',
              'columns-collapsed',
              selectedColumn && 'any-column-selected'
            )}>
            {tracedColumnsForThisNode}
          </div>
        )}
      </>
    );
  } else {
    return null;
  }
};

export default NodeChildren;
