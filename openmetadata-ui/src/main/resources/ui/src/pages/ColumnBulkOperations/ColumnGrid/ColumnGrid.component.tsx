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

import {
  DownOutlined,
  EditOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Select,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { debounce } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import DataGrid, { Column, RenderCellProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AsyncSelectList from '../../../components/common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../components/common/RichTextEditor/RichTextEditor.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  ColumnChild,
  ColumnGridItem,
  ColumnOccurrenceRef,
} from '../../../generated/api/data/columnGridResponse';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import {
  BulkColumnUpdateRequest,
  bulkUpdateColumnsAsync,
  ColumnUpdate,
  getColumnGrid,
} from '../../../rest/columnAPI';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  ColumnGridFilters,
  ColumnGridProps,
  ColumnGridRowData,
  ColumnGridState,
} from './ColumnGrid.interface';
import './ColumnGrid.less';
import {
  OccurrencesIcon,
  PendingChangesIcon,
  TagIcon,
  UniqueColumnsIcon,
} from './ColumnGridIcons';

const { Text } = Typography;

const PAGE_SIZE = 25; // Reduced from 100 to minimize OpenSearch load

const ColumnGrid: React.FC<ColumnGridProps> = ({
  filters: externalFilters,
}) => {
  const { t } = useTranslation();
  const [serverFilters, setServerFilters] = useState<ColumnGridFilters>(
    externalFilters || {}
  );
  const [gridState, setGridState] = useState<ColumnGridState>({
    rows: [],
    loading: false,
    hasMore: false,
    totalUniqueColumns: 0,
    totalOccurrences: 0,
    selectedRows: new Set(),
    columnFilters: {},
    quickFilter: '',
    viewSelectedOnly: false,
  });

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedStructRows, setExpandedStructRows] = useState<Set<string>>(
    new Set()
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const [allRows, setAllRows] = useState<ColumnGridRowData[]>([]);
  const [gridItems, setGridItems] = useState<ColumnGridItem[]>([]);
  const [editDrawer, setEditDrawer] = useState<{
    open: boolean;
    rowId: string | null;
  }>({
    open: false,
    rowId: null,
  });
  const editorRef = React.useRef<EditorContentRef>(null);
  const gridWrapperRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Track container width for responsive columns
  useLayoutEffect(() => {
    const gridWrapper = gridWrapperRef.current;
    if (!gridWrapper) {
      return;
    }

    const updateWidth = () => {
      const width = gridWrapper.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    };

    // Initial measurement
    updateWidth();

    // Use ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(gridWrapper);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Helper function to build path from occurrence
  const buildPath = (occurrence: ColumnOccurrenceRef): string => {
    const parts: string[] = [];
    if (occurrence.serviceName) {
      parts.push(occurrence.serviceName);
    }
    if (occurrence.databaseName) {
      parts.push(occurrence.databaseName);
    }
    if (occurrence.schemaName) {
      parts.push(occurrence.schemaName);
    }

    return parts.join(' / ');
  };

  // Helper function to get unique paths from occurrences
  const getUniquePaths = (
    occurrences: ColumnOccurrenceRef[]
  ): { primary: string; additionalCount: number } => {
    const paths = new Set<string>();
    occurrences.forEach((occ) => {
      const path = buildPath(occ);
      if (path) {
        paths.add(path);
      }
    });
    const pathArray = Array.from(paths);

    return {
      primary: pathArray[0] || '',
      additionalCount: Math.max(0, pathArray.length - 1),
    };
  };

  // Calculate coverage for description
  const calculateCoverage = (
    item: ColumnGridItem
  ): { covered: number; total: number } => {
    let covered = 0;
    let total = 0;
    for (const group of item.groups) {
      total += group.occurrenceCount;
      if (group.description && group.description.trim()) {
        covered += group.occurrenceCount;
      }
    }

    return { covered, total };
  };

  // Aggregate tags from all groups for parent rows
  const aggregateTags = (item: ColumnGridItem): TagLabel[] => {
    const tagMap = new Map<string, TagLabel>();
    for (const group of item.groups) {
      if (group.tags) {
        for (const tag of group.tags) {
          if (!tagMap.has(tag.tagFQN)) {
            tagMap.set(tag.tagFQN, tag);
          }
        }
      }
    }

    return Array.from(tagMap.values());
  };

  // Create rows for STRUCT children recursively
  const createStructChildRows = (
    children: ColumnChild[],
    parentRowId: string,
    nestingLevel: number
  ): ColumnGridRowData[] => {
    const rows: ColumnGridRowData[] = [];
    for (const child of children) {
      const childId = `${parentRowId}-struct-${child.name}`;
      const isStructExpanded = expandedStructRows.has(childId);
      const hasChildren = child.children && child.children.length > 0;

      const childRow: ColumnGridRowData = {
        id: childId,
        columnName: child.name || '',
        displayName: child.displayName,
        description: child.description,
        dataType: child.dataType,
        tags: child.tags,
        occurrenceCount: 1,
        hasVariations: false,
        isGroup: false,
        isStructChild: true,
        structParentId: parentRowId,
        nestingLevel,
        children: child.children,
        isExpanded: isStructExpanded,
      };
      rows.push(childRow);

      // Recursively add nested children if expanded
      if (isStructExpanded && hasChildren && child.children) {
        rows.push(
          ...createStructChildRows(child.children, childId, nestingLevel + 1)
        );
      }
    }

    return rows;
  };

  const handleQuickFilterChange = useCallback((value: string) => {
    setGridState((prev) => ({
      ...prev,
      quickFilter: value,
    }));
  }, []);

  const filteredRows = useMemo(() => {
    let filtered = allRows;

    // If viewing selected only, filter to selected rows and their children
    if (gridState.viewSelectedOnly) {
      filtered = filtered.filter((row) => {
        if (row.parentId) {
          return gridState.selectedRows.has(row.parentId);
        }

        return gridState.selectedRows.has(row.id);
      });
    }

    if (gridState.quickFilter) {
      const searchLower = gridState.quickFilter.toLowerCase();
      filtered = filtered.filter(
        (row) =>
          row.columnName?.toLowerCase().includes(searchLower) ||
          row.displayName?.toLowerCase().includes(searchLower) ||
          row.description?.toLowerCase().includes(searchLower) ||
          row.dataType?.toLowerCase().includes(searchLower)
      );
    }

    // Sort alphabetically by column name, keeping parent-child relationships intact
    const parentRows = filtered.filter((row) => !row.parentId);
    const childRows = filtered.filter((row) => row.parentId);

    parentRows.sort((a, b) => a.columnName.localeCompare(b.columnName));

    const sorted: ColumnGridRowData[] = [];
    for (const parent of parentRows) {
      sorted.push(parent);
      const children = childRows.filter(
        (child) => child.parentId === parent.id
      );
      sorted.push(...children);
    }

    return sorted;
  }, [
    allRows,
    gridState.quickFilter,
    gridState.viewSelectedOnly,
    gridState.selectedRows,
  ]);

  const transformGridItemsToRows = useCallback(
    (items: ColumnGridItem[]): ColumnGridRowData[] => {
      const rows: ColumnGridRowData[] = [];

      for (const item of items) {
        const hasMultipleOccurrences = item.totalOccurrences > 1;
        const coverage = calculateCoverage(item);

        // Collect all occurrences for path calculation
        const allOccurrences: ColumnOccurrenceRef[] = [];
        item.groups.forEach((g) => allOccurrences.push(...g.occurrences));
        const pathInfo = getUniquePaths(allOccurrences);

        if (item.hasVariations && item.groups.length > 1) {
          const isExpanded = expandedRows.has(item.columnName);
          const aggregatedTags = aggregateTags(item);
          const parentRow: ColumnGridRowData = {
            id: item.columnName,
            columnName: item.columnName,
            occurrenceCount: item.totalOccurrences,
            hasVariations: true,
            isExpanded,
            isGroup: true,
            gridItem: item,
            tags: aggregatedTags,
            path: pathInfo.primary,
            additionalPathsCount: pathInfo.additionalCount,
            coverageCount: coverage.covered,
            totalCount: coverage.total,
            hasCoverage: true,
          };
          rows.push(parentRow);

          if (isExpanded) {
            for (const group of item.groups) {
              const groupPathInfo = getUniquePaths(group.occurrences);
              const childRowId = `${item.columnName}-${group.groupId}`;
              const hasStructChildren =
                group.children && group.children.length > 0;
              const isStructExpanded = expandedStructRows.has(childRowId);
              const childRow: ColumnGridRowData = {
                id: childRowId,
                columnName: item.columnName,
                displayName: group.displayName,
                description: group.description,
                dataType: group.dataType,
                tags: group.tags,
                occurrenceCount: group.occurrenceCount,
                hasVariations: false,
                groupId: group.groupId,
                isGroup: false,
                parentId: item.columnName,
                group,
                path: groupPathInfo.primary,
                additionalPathsCount: groupPathInfo.additionalCount,
                children: group.children,
                isExpanded: isStructExpanded,
              };
              rows.push(childRow);

              // Add STRUCT children if expanded
              if (isStructExpanded && hasStructChildren && group.children) {
                rows.push(
                  ...createStructChildRows(group.children, childRowId, 1)
                );
              }
            }
          }
        } else if (hasMultipleOccurrences) {
          const isExpanded = expandedRows.has(item.columnName);
          const group = item.groups[0];
          const aggregatedTags = aggregateTags(item);
          const hasStructChildren =
            group?.children && group.children.length > 0;
          const isStructExpanded = expandedStructRows.has(item.columnName);
          const parentRow: ColumnGridRowData = {
            id: item.columnName,
            columnName: item.columnName,
            displayName: group?.displayName,
            description: group?.description,
            dataType: group?.dataType,
            tags: aggregatedTags.length > 0 ? aggregatedTags : group?.tags,
            occurrenceCount: item.totalOccurrences,
            hasVariations: false,
            isExpanded,
            isGroup: true,
            gridItem: item,
            path: pathInfo.primary,
            additionalPathsCount: pathInfo.additionalCount,
            coverageCount: coverage.covered,
            totalCount: coverage.total,
            hasCoverage: true,
            children: group?.children,
          };
          rows.push(parentRow);

          // Add STRUCT children if expanded (for the parent row before occurrence rows)
          if (isStructExpanded && hasStructChildren && group?.children) {
            rows.push(
              ...createStructChildRows(group.children, item.columnName, 1)
            );
          }

          if (isExpanded && group) {
            for (const occurrence of group.occurrences) {
              const occPath = buildPath(occurrence);
              const occurrenceRow: ColumnGridRowData = {
                id: `${item.columnName}-${occurrence.columnFQN}`,
                columnName: item.columnName,
                displayName: group.displayName,
                description: group.description,
                dataType: group.dataType,
                tags: group.tags,
                occurrenceCount: 1,
                hasVariations: false,
                isGroup: false,
                parentId: item.columnName,
                group,
                path: occPath,
                additionalPathsCount: 0,
                children: group.children,
              };
              rows.push(occurrenceRow);
            }
          }
        } else {
          const group = item.groups[0];
          const hasStructChildren =
            group?.children && group.children.length > 0;
          const isStructExpanded = expandedStructRows.has(item.columnName);
          const row: ColumnGridRowData = {
            id: item.columnName,
            columnName: item.columnName,
            displayName: group?.displayName,
            description: group?.description,
            dataType: group?.dataType,
            tags: group?.tags,
            occurrenceCount: item.totalOccurrences,
            hasVariations: false,
            isGroup: false,
            gridItem: item,
            group,
            path: pathInfo.primary,
            additionalPathsCount: pathInfo.additionalCount,
            coverageCount: coverage.covered,
            totalCount: coverage.total,
            hasCoverage: true,
            children: group?.children,
            isExpanded: isStructExpanded,
          };
          rows.push(row);

          // Add STRUCT children if expanded
          if (isStructExpanded && hasStructChildren && group?.children) {
            rows.push(
              ...createStructChildRows(group.children, item.columnName, 1)
            );
          }
        }
      }

      return rows;
    },
    [expandedRows, expandedStructRows]
  );

  const loadMoreData = useCallback(
    async (cursor?: string) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setGridState((prev) => ({ ...prev, loading: true, error: undefined }));

      try {
        const response = await getColumnGrid({
          size: PAGE_SIZE,
          cursor,
          ...serverFilters,
        });

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        setGridItems((prev) =>
          cursor ? [...prev, ...response.columns] : response.columns
        );

        setGridState((prev) => ({
          ...prev,
          cursor: response.cursor,
          hasMore: !!response.cursor,
          totalUniqueColumns: response.totalUniqueColumns,
          totalOccurrences: response.totalOccurrences,
          loading: false,
        }));
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        const message = t('server.entity-fetch-error', {
          entity: t('label.column-plural'),
        });
        showErrorToast(message);
        setGridState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
      }
    },
    [serverFilters, t]
  );

  // Debounced server filter update to prevent rapid API calls
  const debouncedSetServerFilters = useMemo(
    () =>
      debounce((newFilters: ColumnGridFilters) => {
        setServerFilters(newFilters);
      }, 300),
    []
  );

  useEffect(() => {
    setGridItems([]);
    setGridState((prev) => ({
      ...prev,
      cursor: undefined,
      hasMore: false,
    }));
    loadMoreData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [serverFilters, loadMoreData]);

  useEffect(() => {
    const transformedRows = transformGridItemsToRows(gridItems);

    setAllRows((prevRows) => {
      const editedRowsMap = new Map(
        prevRows
          .filter(
            (r) =>
              r.editedDisplayName !== undefined ||
              r.editedDescription !== undefined ||
              r.editedTags !== undefined
          )
          .map((r) => [
            r.id,
            {
              editedDisplayName: r.editedDisplayName,
              editedDescription: r.editedDescription,
              editedTags: r.editedTags,
            },
          ])
      );

      return transformedRows.map((row) => {
        const edits = editedRowsMap.get(row.id);
        if (edits) {
          return { ...row, ...edits };
        }

        return row;
      });
    });
  }, [gridItems, expandedRows, expandedStructRows, transformGridItemsToRows]);

  useEffect(() => {
    const gridWrapper = gridWrapperRef.current;
    if (!gridWrapper) {
      return;
    }

    const setupScrollListener = () => {
      // React-data-grid uses the .rdg element itself as the scroll container
      const rdgElement = gridWrapper.querySelector('.rdg') as HTMLElement;
      if (!rdgElement) {
        return null;
      }

      const handleScrollEvent = () => {
        const { scrollTop, scrollHeight, clientHeight } = rdgElement;
        const scrollThreshold = scrollHeight - clientHeight - 150;

        if (
          scrollTop >= scrollThreshold &&
          !gridState.loading &&
          gridState.hasMore &&
          gridState.cursor
        ) {
          loadMoreData(gridState.cursor);
        }
      };

      rdgElement.addEventListener('scroll', handleScrollEvent);

      return () => {
        rdgElement.removeEventListener('scroll', handleScrollEvent);
      };
    };

    // Try to set up immediately
    let cleanup = setupScrollListener();

    // If element not found, wait a bit and try again
    if (!cleanup) {
      const timeoutId = setTimeout(() => {
        cleanup = setupScrollListener();
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        cleanup?.();
      };
    }

    return cleanup;
  }, [
    gridState.loading,
    gridState.hasMore,
    gridState.cursor,
    loadMoreData,
    filteredRows.length,
  ]);

  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }

      return newSet;
    });
  }, []);

  const toggleStructExpansion = useCallback((rowId: string) => {
    setExpandedStructRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }

      return newSet;
    });
  }, []);

  const toggleRowSelection = useCallback((rowId: string) => {
    setGridState((prev) => {
      const newSelected = new Set(prev.selectedRows);
      if (newSelected.has(rowId)) {
        newSelected.delete(rowId);
      } else {
        newSelected.add(rowId);
      }

      return { ...prev, selectedRows: newSelected };
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setGridState((prev) => {
      const selectableRows = filteredRows.filter((r) => !r.parentId);
      const allSelected = selectableRows.every((r) =>
        prev.selectedRows.has(r.id)
      );

      if (allSelected) {
        return { ...prev, selectedRows: new Set() };
      } else {
        const newSelected = new Set(selectableRows.map((r) => r.id));

        return { ...prev, selectedRows: newSelected };
      }
    });
  }, [filteredRows]);

  const clearSelection = useCallback(() => {
    setGridState((prev) => ({
      ...prev,
      selectedRows: new Set(),
      viewSelectedOnly: false,
    }));
  }, []);

  const toggleViewSelectedOnly = useCallback((checked: boolean) => {
    setGridState((prev) => ({
      ...prev,
      viewSelectedOnly: checked,
    }));
  }, []);

  const updateRowField = useCallback(
    (
      rowId: string,
      field: 'displayName' | 'description' | 'tags',
      value: string | TagLabel[]
    ) => {
      const fieldName = `edited${field.charAt(0).toUpperCase()}${field.slice(
        1
      )}`;

      setAllRows((prev) => {
        const updated = prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                [fieldName]: value,
              }
            : row
        );

        return updated;
      });

      setGridState((prev) => {
        const newSelectedRows = new Set(prev.selectedRows);
        newSelectedRows.add(rowId);

        return { ...prev, selectedRows: newSelectedRows };
      });

      setRenderVersion((v) => v + 1);
    },
    []
  );

  const getColumnLink = useCallback((row: ColumnGridRowData) => {
    let occurrence = null;

    if (row.group?.occurrences && row.group.occurrences.length > 0) {
      occurrence = row.group.occurrences[0];
    } else if (
      row.gridItem?.groups &&
      row.gridItem.groups.length > 0 &&
      row.gridItem.groups[0].occurrences.length > 0
    ) {
      occurrence = row.gridItem.groups[0].occurrences[0];
    }

    if (!occurrence) {
      return null;
    }

    const entityTypeLower = occurrence.entityType.toLowerCase();
    let entityType: EntityType;
    let tab: string;

    switch (entityTypeLower) {
      case 'dashboarddatamodel':
        entityType = EntityType.DASHBOARD_DATA_MODEL;
        tab = EntityTabs.MODEL;

        break;
      case 'table':
        entityType = EntityType.TABLE;
        tab = EntityTabs.SCHEMA;

        break;
      case 'topic':
        entityType = EntityType.TOPIC;
        tab = EntityTabs.SCHEMA;

        break;
      case 'container':
        entityType = EntityType.CONTAINER;
        tab = EntityTabs.SCHEMA;

        break;
      case 'searchindex':
        entityType = EntityType.SEARCH_INDEX;
        tab = EntityTabs.FIELDS;

        break;
      default:
        entityType = entityTypeLower as EntityType;
        tab = EntityTabs.SCHEMA;
    }

    const columnName = occurrence.columnFQN.split('.').pop() || '';

    return getEntityDetailsPath(
      entityType,
      occurrence.entityFQN,
      tab,
      columnName
    );
  }, []);

  const renderColumnNameCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const link = getColumnLink(row);
      const hasStructChildren = row.children && row.children.length > 0;
      const isStructType =
        row.dataType?.toUpperCase() === 'STRUCT' ||
        row.dataType?.toUpperCase() === 'MAP' ||
        row.dataType?.toUpperCase() === 'UNION' ||
        hasStructChildren;

      // STRUCT child rows - show with proper indentation
      if (row.isStructChild) {
        const nestingLevel = row.nestingLevel || 1;
        const indentStyle = { paddingLeft: `${nestingLevel * 20}px` };
        const structExpandButton =
          row.children && row.children.length > 0 ? (
            <Button
              className="expand-button"
              icon={row.isExpanded ? <DownOutlined /> : <RightOutlined />}
              size="small"
              type="text"
              onClick={() => toggleStructExpansion(row.id)}
            />
          ) : null;

        return (
          <div
            className="column-name-cell struct-child-row"
            style={indentStyle}>
            {structExpandButton}
            <Text type="secondary">{row.columnName}</Text>
          </div>
        );
      }

      if (row.isGroup && row.occurrenceCount > 1) {
        const expandButton = (
          <Button
            className="expand-button"
            icon={row.isExpanded ? <DownOutlined /> : <RightOutlined />}
            size="small"
            type="text"
            onClick={() => toggleRowExpansion(row.id)}
          />
        );

        const nameWithCount = `${row.columnName} (${row.occurrenceCount})`;

        // Also show STRUCT expansion button if applicable
        const structButton = isStructType ? (
          <Button
            className="expand-button struct-expand"
            icon={
              expandedStructRows.has(row.id) ? (
                <DownOutlined />
              ) : (
                <RightOutlined />
              )
            }
            size="small"
            title="Expand nested fields"
            type="text"
            onClick={(e) => {
              e.stopPropagation();
              toggleStructExpansion(row.id);
            }}
          />
        ) : null;

        return (
          <div className="column-name-cell">
            {expandButton}
            {link ? (
              <Link className="column-link" to={link}>
                {nameWithCount}
              </Link>
            ) : (
              <Text strong>{nameWithCount}</Text>
            )}
            {structButton}
          </div>
        );
      }

      // Child row or single occurrence
      const indent = row.parentId ? 'child-row' : '';

      // Show STRUCT expansion button for single occurrence STRUCT columns
      const structExpandButton =
        isStructType && !row.parentId ? (
          <Button
            className="expand-button"
            icon={row.isExpanded ? <DownOutlined /> : <RightOutlined />}
            size="small"
            title="Expand nested fields"
            type="text"
            onClick={() => toggleStructExpansion(row.id)}
          />
        ) : null;

      const content = (
        <span className={indent}>
          {link ? (
            <Link className="column-link" to={link}>
              {row.columnName}
            </Link>
          ) : (
            row.columnName
          )}
        </span>
      );

      return (
        <div className="column-name-cell">
          {structExpandButton}
          {content}
        </div>
      );
    },
    [
      getColumnLink,
      toggleRowExpansion,
      toggleStructExpansion,
      expandedStructRows,
    ]
  );

  const renderPathCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;

      if (!row.path) {
        return <Text type="secondary">-</Text>;
      }

      return (
        <div className="path-cell">
          <Text className="path-text">{row.path}</Text>
          {row.additionalPathsCount && row.additionalPathsCount > 0 && (
            <Text className="path-more" type="secondary">
              +{row.additionalPathsCount} more
            </Text>
          )}
        </div>
      );
    },
    []
  );

  const renderDescriptionCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const description = row.editedDescription ?? row.description ?? '';
      const hasEdit = row.editedDescription !== undefined;

      // Show coverage status for parent rows
      if (
        row.hasCoverage &&
        row.coverageCount !== undefined &&
        row.totalCount !== undefined
      ) {
        const isFull = row.coverageCount === row.totalCount;
        const coverageText = isFull
          ? `Full Coverage (${row.coverageCount}/${row.totalCount})`
          : `Partial Coverage (${row.coverageCount}/${row.totalCount})`;

        return (
          <Text className={isFull ? 'coverage-full' : 'coverage-partial'}>
            {coverageText}
          </Text>
        );
      }

      // Show actual description for child rows or single occurrences
      const displayValue = description.replace(/<[^>]*>/g, '').slice(0, 100);

      return (
        <div className={`description-cell ${hasEdit ? 'has-edit' : ''}`}>
          <Text ellipsis>{displayValue || '-'}</Text>
        </div>
      );
    },
    []
  );

  const renderTagsCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const currentTags = row.editedTags ?? row.tags ?? [];
      const classificationTags = currentTags.filter(
        (tag) => tag.source !== TagSource.Glossary
      );

      if (classificationTags.length === 0) {
        return <Text type="secondary">-</Text>;
      }

      const visibleTags = classificationTags.slice(0, 2);
      const remainingCount = classificationTags.length - 2;

      return (
        <div className="tags-cell">
          {visibleTags.map((tag: TagLabel, index: number) => (
            <Tag
              className={`grid-tag ${
                index === 0 ? 'grid-tag-primary' : 'grid-tag-secondary'
              }`}
              key={tag.tagFQN}>
              {index === 0 && <TagIcon className="tag-icon" />}
              {tag.name || tag.tagFQN.split('.').pop()}
            </Tag>
          ))}
          {remainingCount > 0 && (
            <span className="grid-tag-count">+{remainingCount}</span>
          )}
        </div>
      );
    },
    []
  );

  const renderGlossaryTermsCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const currentTags = row.editedTags ?? row.tags ?? [];
      const glossaryTerms = currentTags.filter(
        (tag) => tag.source === TagSource.Glossary
      );

      if (glossaryTerms.length === 0) {
        return <Text type="secondary">-</Text>;
      }

      const visibleTerms = glossaryTerms.slice(0, 1);
      const remainingCount = glossaryTerms.length - 1;

      return (
        <div className="tags-cell">
          {visibleTerms.map((tag: TagLabel) => (
            <Tag className="glossary-tag" key={tag.tagFQN}>
              {tag.name || tag.tagFQN.split('.').pop()}
            </Tag>
          ))}
          {remainingCount > 0 && (
            <span className="grid-tag-count">+{remainingCount}</span>
          )}
        </div>
      );
    },
    []
  );

  const renderCheckboxCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      // Show checkbox for both parent and child rows
      const isSelected = row.parentId
        ? gridState.selectedRows.has(row.parentId) ||
          gridState.selectedRows.has(row.id)
        : gridState.selectedRows.has(row.id);

      return (
        <Checkbox
          checked={isSelected}
          className={row.parentId ? 'child-checkbox' : ''}
          onChange={() => toggleRowSelection(row.parentId || row.id)}
        />
      );
    },
    [gridState.selectedRows, toggleRowSelection]
  );

  const renderCheckboxHeader = useCallback(() => {
    const selectableRows = filteredRows.filter((r) => !r.parentId);
    const allSelected =
      selectableRows.length > 0 &&
      selectableRows.every((r) => gridState.selectedRows.has(r.id));
    const someSelected =
      selectableRows.some((r) => gridState.selectedRows.has(r.id)) &&
      !allSelected;

    return (
      <Checkbox
        checked={allSelected}
        indeterminate={someSelected}
        onChange={toggleSelectAll}
      />
    );
  }, [filteredRows, gridState.selectedRows, toggleSelectAll]);

  const openEditDrawer = useCallback(() => {
    setEditDrawer({
      open: true,
      rowId: null, // We'll edit all selected rows
    });
  }, []);

  const closeEditDrawer = useCallback(() => {
    setEditDrawer({
      open: false,
      rowId: null,
    });
  }, []);

  const columns: readonly Column<ColumnGridRowData>[] = useMemo(() => {
    // Fixed widths for checkbox and minimum column widths
    const checkboxWidth = 50;
    const minColumnName = 150;
    const minPath = 180;
    const minDescription = 150;
    const minDataType = 100;
    const minTags = 140;
    const minGlossary = 140;

    // Total minimum width
    const totalMinWidth =
      checkboxWidth +
      minColumnName +
      minPath +
      minDescription +
      minDataType +
      minTags +
      minGlossary;

    // Available width for distribution (subtract some padding)
    const availableWidth = Math.max(containerWidth - 20, totalMinWidth);

    // Calculate proportional widths based on ratios
    const flexibleWidth = availableWidth - checkboxWidth;
    const columnNameWidth = Math.max(
      minColumnName,
      Math.floor(flexibleWidth * 0.15)
    );
    const pathWidth = Math.max(minPath, Math.floor(flexibleWidth * 0.2));
    const descriptionWidth = Math.max(
      minDescription,
      Math.floor(flexibleWidth * 0.2)
    );
    const dataTypeWidth = Math.max(
      minDataType,
      Math.floor(flexibleWidth * 0.1)
    );
    const tagsWidth = Math.max(minTags, Math.floor(flexibleWidth * 0.17));
    const glossaryWidth = Math.max(
      minGlossary,
      flexibleWidth -
        columnNameWidth -
        pathWidth -
        descriptionWidth -
        dataTypeWidth -
        tagsWidth
    );

    return [
      {
        key: 'select',
        name: '',
        width: checkboxWidth,
        minWidth: checkboxWidth,
        maxWidth: checkboxWidth,
        frozen: true,
        renderCell: renderCheckboxCell,
        renderHeaderCell: renderCheckboxHeader,
      },
      {
        key: 'columnName',
        name: t('label.column-name'),
        width: columnNameWidth,
        minWidth: minColumnName,
        resizable: true,
        renderCell: renderColumnNameCell,
      },
      {
        key: 'path',
        name: t('label.path'),
        width: pathWidth,
        minWidth: minPath,
        resizable: true,
        renderCell: renderPathCell,
      },
      {
        key: 'description',
        name: t('label.description'),
        width: descriptionWidth,
        minWidth: minDescription,
        resizable: true,
        renderCell: renderDescriptionCell,
      },
      {
        key: 'dataType',
        name: t('label.data-type'),
        width: dataTypeWidth,
        minWidth: minDataType,
        resizable: true,
        renderCell: (props) => props.row.dataType || '-',
      },
      {
        key: 'tags',
        name: t('label.tag-plural'),
        width: tagsWidth,
        minWidth: minTags,
        resizable: true,
        renderCell: renderTagsCell,
      },
      {
        key: 'glossaryTerms',
        name: t('label.glossary-term-plural'),
        width: glossaryWidth,
        minWidth: minGlossary,
        resizable: true,
        renderCell: renderGlossaryTermsCell,
      },
    ];
  }, [
    t,
    containerWidth,
    renderCheckboxCell,
    renderCheckboxHeader,
    renderColumnNameCell,
    renderPathCell,
    renderDescriptionCell,
    renderTagsCell,
    renderGlossaryTermsCell,
  ]);

  const handleBulkUpdate = useCallback(async () => {
    const selectedRowsData = allRows.filter((r) =>
      gridState.selectedRows.has(r.id)
    );

    const updatesCount = selectedRowsData.filter(
      (r) =>
        r.editedDisplayName !== undefined ||
        r.editedDescription !== undefined ||
        r.editedTags !== undefined
    ).length;

    if (updatesCount === 0) {
      showErrorToast(t('message.no-changes-to-save'));

      return;
    }

    setIsUpdating(true);

    try {
      const columnUpdates: ColumnUpdate[] = [];

      for (const row of selectedRowsData) {
        if (
          row.editedDisplayName === undefined &&
          row.editedDescription === undefined &&
          row.editedTags === undefined
        ) {
          continue;
        }

        // Collect all occurrences from the row
        const allOccurrences: { columnFQN: string; entityType: string }[] = [];

        // If this is a child row with a specific group, use that group's occurrences
        if (row.group?.occurrences && row.group.occurrences.length > 0) {
          allOccurrences.push(...row.group.occurrences);
        }
        // If this is a parent row (gridItem), iterate through ALL groups
        else if (row.gridItem && row.gridItem.groups.length > 0) {
          for (const group of row.gridItem.groups) {
            if (group.occurrences && group.occurrences.length > 0) {
              allOccurrences.push(...group.occurrences);
            }
          }
        }

        for (const occurrence of allOccurrences) {
          const update: ColumnUpdate = {
            columnFQN: occurrence.columnFQN,
            entityType: occurrence.entityType,
          };

          if (row.editedDisplayName !== undefined) {
            update.displayName = row.editedDisplayName;
          }
          if (row.editedDescription !== undefined) {
            update.description = row.editedDescription;
          }
          if (row.editedTags !== undefined) {
            update.tags = row.editedTags;
          }

          columnUpdates.push(update);
        }
      }

      if (columnUpdates.length === 0) {
        showErrorToast(t('message.no-changes-to-save'));
        setIsUpdating(false);

        return;
      }

      const cleanedUpdates = columnUpdates.map((update) => ({
        columnFQN: update.columnFQN,
        entityType: update.entityType,
        ...(update.displayName !== undefined && {
          displayName: update.displayName,
        }),
        ...(update.description !== undefined && {
          description: update.description,
        }),
        ...(update.tags !== undefined && {
          tags: update.tags
            .filter((tag) => tag.tagFQN)
            .map((tag) => ({
              tagFQN: tag.tagFQN,
              source: tag.source,
              labelType: tag.labelType,
              state: tag.state,
            })),
        }),
      }));

      const request: BulkColumnUpdateRequest = {
        columnUpdates: cleanedUpdates,
      };

      // Log the request for debugging
      // eslint-disable-next-line no-console
      console.log('Bulk update request:', JSON.stringify(request, null, 2));

      const response = await bulkUpdateColumnsAsync(request);

      // Log the response for debugging
      // eslint-disable-next-line no-console
      console.log('Bulk update response:', response);

      showSuccessToast(
        t('message.bulk-update-initiated', {
          entity: t('label.column-plural'),
          count: columnUpdates.length,
        })
      );

      setIsUpdating(false);
      closeEditDrawer();
      setGridState((prev) => ({
        ...prev,
        selectedRows: new Set(),
        viewSelectedOnly: false,
      }));

      // Clear edited state and refresh data from server after a delay
      // to allow the async backend operation to complete
      setAllRows((prev) =>
        prev.map((r) => ({
          ...r,
          editedDisplayName: undefined,
          editedDescription: undefined,
          editedTags: undefined,
        }))
      );

      // Refresh grid data from server after backend processes updates
      setTimeout(() => {
        setGridItems([]);
        setExpandedRows(new Set());
        loadMoreData();
      }, 2000);
    } catch (error) {
      showErrorToast(t('server.entity-updating-error'));
      setIsUpdating(false);
    }
  }, [allRows, gridState.selectedRows, t, loadMoreData]);

  const editedCount = useMemo(() => {
    return allRows.filter(
      (r) =>
        r.editedDisplayName !== undefined ||
        r.editedDescription !== undefined ||
        r.editedTags !== undefined
    ).length;
  }, [allRows]);

  const selectedCount = gridState.selectedRows.size;
  const hasSelection = selectedCount > 0;

  return (
    <div className="column-grid-container">
      {/* Summary Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <UniqueColumnsIcon className="stat-icon" />
          <div className="stat-content">
            <div className="stat-value">
              {gridState.totalUniqueColumns.toLocaleString()}
            </div>
            <div className="stat-label">{t('label.total-unique-columns')}</div>
          </div>
        </div>
        <div className="stat-card">
          <OccurrencesIcon className="stat-icon" />
          <div className="stat-content">
            <div className="stat-value">
              {gridState.totalOccurrences.toLocaleString()}
            </div>
            <div className="stat-label">{t('label.total-occurrences')}</div>
          </div>
        </div>
        <div className="stat-card">
          <PendingChangesIcon className="stat-icon" />
          <div className="stat-content">
            <div className="stat-value">
              {editedCount > 0
                ? `${editedCount}/${selectedCount || editedCount}`
                : '0'}
            </div>
            <div className="stat-label">{t('label.pending-changes')}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-left">
          <Input
            allowClear
            className="search-input"
            placeholder={t('label.search-columns')}
            prefix={<SearchOutlined className="search-icon" />}
            value={gridState.quickFilter}
            onChange={(e) => handleQuickFilterChange(e.target.value)}
          />
          <Select
            allowClear
            className="filter-dropdown"
            dropdownMatchSelectWidth={false}
            mode="multiple"
            placeholder={t('label.asset-type')}
            suffixIcon={<DownOutlined />}
            value={serverFilters.entityTypes}
            onChange={(value) =>
              debouncedSetServerFilters({
                ...serverFilters,
                entityTypes: value,
              })
            }>
            <Select.Option value="table">{t('label.table')}</Select.Option>
            <Select.Option value="dashboardDataModel">
              {t('label.dashboard-data-model')}
            </Select.Option>
            <Select.Option value="topic">{t('label.topic')}</Select.Option>
            <Select.Option value="container">
              {t('label.container')}
            </Select.Option>
            <Select.Option value="searchIndex">
              {t('label.search-index')}
            </Select.Option>
          </Select>
          <Select
            allowClear
            showSearch
            className="filter-dropdown"
            dropdownMatchSelectWidth={false}
            placeholder={t('label.service')}
            suffixIcon={<DownOutlined />}
            value={serverFilters.serviceName}
            onChange={(value) =>
              debouncedSetServerFilters({
                ...serverFilters,
                serviceName: value,
              })
            }
          />
          <Select
            allowClear
            className="filter-dropdown"
            dropdownMatchSelectWidth={false}
            placeholder={t('label.data-type')}
            suffixIcon={<DownOutlined />}>
            <Select.Option value="VARCHAR">VARCHAR</Select.Option>
            <Select.Option value="INT">INT</Select.Option>
            <Select.Option value="BOOLEAN">BOOLEAN</Select.Option>
            <Select.Option value="TIMESTAMP">TIMESTAMP</Select.Option>
          </Select>
          <Select
            allowClear
            className="filter-dropdown"
            dropdownMatchSelectWidth={false}
            placeholder={t('label.metadata-status')}
            suffixIcon={<DownOutlined />}>
            <Select.Option value="complete">
              {t('label.complete')}
            </Select.Option>
            <Select.Option value="partial">{t('label.partial')}</Select.Option>
            <Select.Option value="missing">{t('label.missing')}</Select.Option>
          </Select>
        </div>
        <div className="filter-right">
          {hasSelection ? (
            <>
              <span className="view-selected-label">
                {t('label.view-selected')} ({selectedCount})
              </span>
              <Switch
                checked={gridState.viewSelectedOnly}
                size="small"
                onChange={toggleViewSelectedOnly}
              />
              <Button
                className="edit-button-primary"
                icon={<EditOutlined />}
                loading={isUpdating}
                type="primary"
                onClick={openEditDrawer}>
                {t('label.edit')}
              </Button>
              <Button
                className="cancel-button"
                type="link"
                onClick={clearSelection}>
                {t('label.cancel')}
              </Button>
            </>
          ) : (
            <Button
              className="edit-button"
              icon={<EditOutlined />}
              type="text"
              onClick={openEditDrawer}>
              {t('label.edit')}
            </Button>
          )}
        </div>
      </div>

      {/* Grid Table */}
      <div className="column-grid-wrapper" ref={gridWrapperRef}>
        {gridState.loading && filteredRows.length === 0 ? (
          <div className="loading-container">
            <Spin size="large" tip={t('label.loading')} />
          </div>
        ) : (
          <>
            <DataGrid
              className="column-grid rdg-light fill-grid"
              columns={columns}
              key={renderVersion}
              rowHeight={72}
              rowKeyGetter={(row) => row.id}
              rows={filteredRows}
              style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
            />
            {gridState.loading && filteredRows.length > 0 && (
              <div className="column-grid-loading">
                <Spin size="small" tip={t('label.loading-more')} />
              </div>
            )}
          </>
        )}
      </div>

      {gridState.error && (
        <div className="column-grid-error">
          <Text type="danger">{gridState.error}</Text>
        </div>
      )}

      {/* Edit Drawer */}
      <Drawer
        className="edit-column-drawer"
        extra={
          <Button icon={<span>×</span>} type="text" onClick={closeEditDrawer} />
        }
        footer={
          <div className="drawer-footer">
            <Button onClick={closeEditDrawer}>{t('label.cancel')}</Button>
            <Button
              loading={isUpdating}
              type="primary"
              onClick={handleBulkUpdate}>
              {t('label.update')}
            </Button>
          </div>
        }
        open={editDrawer.open}
        placement="right"
        title={`${t('label.edit-entity', { entity: t('label.column') })} ${
          selectedCount > 0 ? String(selectedCount).padStart(2, '0') : ''
        }`}
        width="33vw"
        onClose={closeEditDrawer}>
        {(() => {
          const selectedRows = allRows.filter((r) =>
            gridState.selectedRows.has(r.id)
          );
          const firstRow = selectedRows[0];
          if (!firstRow && selectedCount === 0) {
            return (
              <Text type="secondary">
                {t('message.select-columns-to-edit')}
              </Text>
            );
          }

          return (
            <div className="drawer-content">
              {/* Column Name */}
              <div className="form-field">
                <label className="field-label">{t('label.column-name')}</label>
                <Input
                  disabled
                  className="readonly-input"
                  value={
                    selectedCount === 1
                      ? firstRow?.columnName
                      : `${selectedCount} columns selected`
                  }
                />
              </div>

              {/* Display Name */}
              <div className="form-field">
                <label className="field-label">{t('label.display-name')}</label>
                <Input
                  placeholder={t('label.enter-display-name')}
                  onChange={(e) => {
                    gridState.selectedRows.forEach((rowId) => {
                      updateRowField(rowId, 'displayName', e.target.value);
                    });
                  }}
                />
              </div>

              {/* Description */}
              <div className="form-field">
                <label className="field-label">{t('label.description')}</label>
                <RichTextEditor
                  initialValue=""
                  placeHolder={t('label.add-entity', {
                    entity: t('label.description'),
                  })}
                  ref={editorRef}
                  onTextChange={(value) => {
                    gridState.selectedRows.forEach((rowId) => {
                      updateRowField(rowId, 'description', value);
                    });
                  }}
                />
              </div>

              {/* Tags */}
              <div className="form-field">
                <label className="field-label">{t('label.tag-plural')}</label>
                <Form>
                  <AsyncSelectList
                    hasNoActionButtons
                    fetchOptions={tagClassBase.getTags}
                    initialOptions={[]}
                    mode="multiple"
                    placeholder={t('label.select-tags')}
                    onChange={(selectedTags) => {
                      const options = (
                        Array.isArray(selectedTags)
                          ? selectedTags
                          : [selectedTags]
                      ) as SelectOption[];
                      const newTags = options
                        .filter((option: SelectOption) => option.data)
                        .map((option: SelectOption) => option.data as TagLabel);
                      gridState.selectedRows.forEach((rowId) => {
                        const row = allRows.find((r) => r.id === rowId);
                        if (row) {
                          const currentTags = row.editedTags ?? row.tags ?? [];
                          const glossaryTerms = currentTags.filter(
                            (t) => t.source === TagSource.Glossary
                          );
                          updateRowField(rowId, 'tags', [
                            ...newTags,
                            ...glossaryTerms,
                          ]);
                        }
                      });
                    }}
                  />
                </Form>
              </div>

              {/* Glossary Terms */}
              <div className="form-field">
                <label className="field-label">
                  {t('label.glossary-term-plural')}
                </label>
                <Form>
                  <TreeAsyncSelectList
                    hasNoActionButtons
                    initialOptions={[]}
                    placeholder={t('label.select-tags')}
                    onChange={(selectedTerms) => {
                      const options = (
                        Array.isArray(selectedTerms)
                          ? selectedTerms
                          : [selectedTerms]
                      ) as SelectOption[];
                      const newTerms = options
                        .filter((option: SelectOption) => option.data)
                        .map((option: SelectOption) => option.data as TagLabel);
                      gridState.selectedRows.forEach((rowId) => {
                        const row = allRows.find((r) => r.id === rowId);
                        if (row) {
                          const currentTags = row.editedTags ?? row.tags ?? [];
                          const classificationTags = currentTags.filter(
                            (t) => t.source !== TagSource.Glossary
                          );
                          updateRowField(rowId, 'tags', [
                            ...classificationTags,
                            ...newTerms,
                          ]);
                        }
                      });
                    }}
                  />
                </Form>
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
};

export default ColumnGrid;
