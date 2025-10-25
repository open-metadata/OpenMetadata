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

import { DownOutlined, EditOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Col, Drawer, Form, Input, Modal, Row, Select, Space, Spin, Statistic, Tag, Tooltip, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DataGrid, { Column, RenderCellProps, RenderHeaderCellProps } from 'react-data-grid';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AsyncSelectList from '../../../components/common/AsyncSelectList/AsyncSelectList';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../components/common/RichTextEditor/RichTextEditor.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import {
  ColumnGridItem,
  ColumnMetadataGroup,
} from '../../../generated/api/data/columnGridResponse';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  BulkColumnUpdateRequest,
  ColumnUpdate,
  getColumnGrid,
  bulkUpdateColumnsAsync,
} from '../../../rest/columnAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  ColumnGridFilters,
  ColumnGridProps,
  ColumnGridRowData,
  ColumnGridState,
} from './ColumnGrid.interface';
import { SelectOption } from '../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import { TagSource } from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import 'react-data-grid/lib/styles.css';
import './ColumnGrid.less';

const { Text } = Typography;

const PAGE_SIZE = 100;

const ColumnGrid: React.FC<ColumnGridProps> = ({ filters: externalFilters }) => {
  const { t } = useTranslation();
  const [serverFilters, setServerFilters] = useState<ColumnGridFilters>(externalFilters || {});
  const [gridState, setGridState] = useState<ColumnGridState>({
    rows: [],
    loading: false,
    hasMore: false,
    totalUniqueColumns: 0,
    totalOccurrences: 0,
    selectedRows: new Set(),
    columnFilters: {},
    quickFilter: '',
  });

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
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

  const handleColumnFilterChange = useCallback((column: string, value: string) => {
    setGridState((prev) => ({
      ...prev,
      columnFilters: {
        ...prev.columnFilters,
        [column]: value,
      },
    }));
  }, []);

  const handleQuickFilterChange = useCallback((value: string) => {
    setGridState((prev) => ({
      ...prev,
      quickFilter: value,
    }));
  }, []);

  const filteredRows = useMemo(() => {
    let filtered = allRows;

    if (gridState.quickFilter) {
      const searchLower = gridState.quickFilter.toLowerCase();
      filtered = filtered.filter((row) =>
        row.columnName?.toLowerCase().includes(searchLower) ||
        row.displayName?.toLowerCase().includes(searchLower) ||
        row.description?.toLowerCase().includes(searchLower) ||
        row.dataType?.toLowerCase().includes(searchLower)
      );
    }

    if (gridState.columnFilters.columnName) {
      const searchLower = gridState.columnFilters.columnName.toLowerCase();
      filtered = filtered.filter((row) =>
        row.columnName?.toLowerCase().includes(searchLower)
      );
    }

    if (gridState.columnFilters.displayName) {
      const searchLower = gridState.columnFilters.displayName.toLowerCase();
      filtered = filtered.filter((row) =>
        row.displayName?.toLowerCase().includes(searchLower)
      );
    }

    if (gridState.columnFilters.description) {
      const searchLower = gridState.columnFilters.description.toLowerCase();
      filtered = filtered.filter((row) =>
        row.description?.toLowerCase().includes(searchLower)
      );
    }

    if (gridState.columnFilters.dataType) {
      const searchLower = gridState.columnFilters.dataType.toLowerCase();
      filtered = filtered.filter((row) =>
        row.dataType?.toLowerCase().includes(searchLower)
      );
    }

    // Sort alphabetically by column name, keeping parent-child relationships intact
    const parentRows = filtered.filter((row) => !row.parentId);
    const childRows = filtered.filter((row) => row.parentId);

    // Sort parent rows alphabetically
    parentRows.sort((a, b) => a.columnName.localeCompare(b.columnName));

    // Rebuild the list with children immediately following their parents
    const sorted: ColumnGridRowData[] = [];
    for (const parent of parentRows) {
      sorted.push(parent);
      // Add children of this parent in order
      const children = childRows.filter((child) => child.parentId === parent.id);
      sorted.push(...children);
    }

    return sorted;
  }, [allRows, gridState.quickFilter, gridState.columnFilters]);

  const transformGridItemsToRows = useCallback(
    (items: ColumnGridItem[]): ColumnGridRowData[] => {
      const rows: ColumnGridRowData[] = [];

      for (const item of items) {
        const hasMultipleOccurrences = item.totalOccurrences > 1;

        if (item.hasVariations && item.groups.length > 1) {
          const isExpanded = expandedRows.has(item.columnName);
          const parentRow: ColumnGridRowData = {
            id: item.columnName,
            columnName: item.columnName,
            occurrenceCount: item.totalOccurrences,
            hasVariations: true,
            isExpanded,
            isGroup: true,
            gridItem: item,
          };
          rows.push(parentRow);

          if (isExpanded) {
            for (const group of item.groups) {
              const childRow: ColumnGridRowData = {
                id: `${item.columnName}-${group.groupId}`,
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
              };
              rows.push(childRow);
            }
          }
        } else if (hasMultipleOccurrences) {
          const isExpanded = expandedRows.has(item.columnName);
          const group = item.groups[0];
          const parentRow: ColumnGridRowData = {
            id: item.columnName,
            columnName: item.columnName,
            displayName: group?.displayName,
            description: group?.description,
            dataType: group?.dataType,
            tags: group?.tags,
            occurrenceCount: item.totalOccurrences,
            hasVariations: false,
            isExpanded,
            isGroup: true,
            gridItem: item,
          };
          rows.push(parentRow);

          if (isExpanded && group) {
            for (const occurrence of group.occurrences) {
              const occurrenceRow: ColumnGridRowData = {
                id: `${item.columnName}-${occurrence.columnFQN}`,
                columnName: occurrence.columnFQN,
                displayName: group.displayName,
                description: group.description,
                dataType: group.dataType,
                tags: group.tags,
                occurrenceCount: 1,
                hasVariations: false,
                isGroup: false,
                parentId: item.columnName,
                group,
              };
              rows.push(occurrenceRow);
            }
          }
        } else {
          const group = item.groups[0];
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
          };
          rows.push(row);
        }
      }

      return rows;
    },
    [expandedRows]
  );

  const loadMoreData = useCallback(
    async (cursor?: string) => {
      setGridState((prev) => ({ ...prev, loading: true, error: undefined }));

      try {
        const response = await getColumnGrid({
          size: PAGE_SIZE,
          cursor,
          ...serverFilters,
        });

        // eslint-disable-next-line no-console
        console.log('API Response:', {
          columnsReturned: response.columns.length,
          totalUniqueColumns: response.totalUniqueColumns,
          totalOccurrences: response.totalOccurrences,
          hasCursor: !!response.cursor,
          cursor: response.cursor,
        });

        setGridItems((prev) => cursor ? [...prev, ...response.columns] : response.columns);

        setGridState((prev) => ({
          ...prev,
          cursor: response.cursor,
          hasMore: !!response.cursor,
          totalUniqueColumns: response.totalUniqueColumns,
          totalOccurrences: response.totalOccurrences,
          loading: false,
        }));
      } catch (error) {
        showErrorToast(
          error as Error,
          t('server.entity-fetch-error', { entity: t('label.column-plural') })
        );
        setGridState((prev) => ({
          ...prev,
          loading: false,
          error: (error as Error).message,
        }));
      }
    },
    [serverFilters, t]
  );

  useEffect(() => {
    setGridItems([]);
    setGridState((prev) => ({
      ...prev,
      cursor: undefined,
      hasMore: false,
    }));
    loadMoreData();
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
  }, [gridItems, expandedRows, transformGridItemsToRows]);

  useEffect(() => {
    const gridWrapper = gridWrapperRef.current;
    if (!gridWrapper) return;

    const rdgElement = gridWrapper.querySelector('.rdg');
    if (!rdgElement) return;

    const handleScrollEvent = (event: Event) => {
      const target = event.target as HTMLElement;
      const scrollThreshold = target.scrollHeight - target.clientHeight - 100;

      if (
        target.scrollTop >= scrollThreshold &&
        !gridState.loading &&
        gridState.hasMore
      ) {
        loadMoreData(gridState.cursor);
      }
    };

    rdgElement.addEventListener('scroll', handleScrollEvent);

    return () => {
      rdgElement.removeEventListener('scroll', handleScrollEvent);
    };
  }, [gridState.loading, gridState.hasMore, gridState.cursor, loadMoreData]);

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
      const allSelected = selectableRows.every((r) => prev.selectedRows.has(r.id));

      if (allSelected) {
        return { ...prev, selectedRows: new Set() };
      } else {
        const newSelected = new Set(selectableRows.map((r) => r.id));

        return { ...prev, selectedRows: newSelected };
      }
    });
  }, [filteredRows]);

  const updateRowField = useCallback(
    (rowId: string, field: 'displayName' | 'description' | 'tags', value: string | TagLabel[]) => {
      const fieldName = `edited${field.charAt(0).toUpperCase()}${field.slice(1)}`;
      // eslint-disable-next-line no-console
      console.log(`updateRowField called: rowId=${rowId}, field=${field}, fieldName=${fieldName}, value=`, value);

      setAllRows((prev) => {
        const updated = prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                [fieldName]: value,
              }
            : row
        );
        // eslint-disable-next-line no-console
        console.log('Updated allRows, finding row:', updated.find(r => r.id === rowId));
        return updated;
      });

      setGridState((prev) => {
        const newSelectedRows = new Set(prev.selectedRows);
        newSelectedRows.add(rowId);
        return { ...prev, selectedRows: newSelectedRows };
      });

      // Force re-render by incrementing version
      setRenderVersion(v => v + 1);
    },
    []
  );

  const renderTagsCell = useCallback((props: RenderCellProps<ColumnGridRowData>) => {
    const { tags } = props.row;
    if (!tags || tags.length === 0) {
      return <span>-</span>;
    }

    return (
      <Space size={4} wrap>
        {tags.map((tag: TagLabel) => (
          <Tag key={tag.tagFQN} className="column-grid-tag">
            {tag.tagFQN}
          </Tag>
        ))}
      </Space>
    );
  }, []);

  const renderColumnNameCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;

      const getColumnLink = () => {
        // Try to get occurrence from the row's group, or from gridItem's first group
        let occurrence = null;

        if (row.group?.occurrences && row.group.occurrences.length > 0) {
          occurrence = row.group.occurrences[0];
        } else if (row.gridItem?.groups && row.gridItem.groups.length > 0 && row.gridItem.groups[0].occurrences.length > 0) {
          occurrence = row.gridItem.groups[0].occurrences[0];
        }

        if (!occurrence) return null;

        const entityTypeLower = occurrence.entityType.toLowerCase();
        let entityType: EntityType;
        let tab: string;

        // Map entity type to correct EntityType enum value and tab
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
      };

      if (row.isGroup) {
        const link = getColumnLink();
        const expandButton = (
          <Button
            size="small"
            type="text"
            icon={row.isExpanded ? <DownOutlined /> : <RightOutlined />}
            onClick={() => toggleRowExpansion(row.id)}
            style={{ marginRight: '4px', padding: '0' }}
          />
        );

        const nameContent = <Text strong>{row.columnName}</Text>;

        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {expandButton}
            {link ? (
              <Link to={link} style={{ color: '#1890ff' }}>
                {nameContent}
              </Link>
            ) : nameContent}
          </div>
        );
      }

      const link = getColumnLink();
      const content = (
        <span style={{ paddingLeft: row.parentId ? '32px' : '0' }}>
          {row.columnName}
        </span>
      );

      return link ? (
        <Link to={link} style={{ color: '#1890ff' }}>
          {content}
        </Link>
      ) : content;
    },
    [toggleRowExpansion]
  );

  const renderColumnFQNCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;

      // For child rows that are individual occurrences, the columnName is the FQN
      if (row.parentId && row.columnName && row.columnName.includes('.')) {
        return (
          <Text
            style={{
              wordBreak: 'break-word',
              whiteSpace: 'normal',
              fontSize: '13px',
              color: '#6b7280'
            }}
          >
            {row.columnName}
          </Text>
        );
      }

      // Try to get occurrence from the row's group, or from gridItem's first group
      let occurrence = null;

      if (row.group?.occurrences && row.group.occurrences.length > 0) {
        occurrence = row.group.occurrences[0];
      } else if (row.gridItem?.groups && row.gridItem.groups.length > 0 && row.gridItem.groups[0].occurrences.length > 0) {
        occurrence = row.gridItem.groups[0].occurrences[0];
      }

      if (!occurrence) {
        return <span>-</span>;
      }

      return (
        <Text
          style={{
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            fontSize: '13px',
            color: '#6b7280'
          }}
        >
          {occurrence.columnFQN}
        </Text>
      );
    },
    []
  );

  const renderOccurrencesCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      if (row.isGroup && !row.isExpanded && row.occurrenceCount > 1) {
        const buttonText = row.hasVariations
          ? `${row.occurrenceCount.toLocaleString()} (View Groups)`
          : `${row.occurrenceCount.toLocaleString()} (View All)`;
        return (
          <Button type="link" size="small" onClick={() => toggleRowExpansion(row.id)}>
            {buttonText}
          </Button>
        );
      }

      return <Text>{row.occurrenceCount.toLocaleString()}</Text>;
    },
    [toggleRowExpansion]
  );

  const renderCheckboxCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      if (row.parentId) {
        return null;
      }

      return (
        <Checkbox
          checked={gridState.selectedRows.has(row.id)}
          onChange={() => toggleRowSelection(row.id)}
        />
      );
    },
    [gridState.selectedRows, toggleRowSelection]
  );

  const renderCheckboxHeader = useCallback(
    (props: RenderHeaderCellProps<ColumnGridRowData>) => {
      const selectableRows = filteredRows.filter((r) => !r.parentId);
      const allSelected =
        selectableRows.length > 0 &&
        selectableRows.every((r) => gridState.selectedRows.has(r.id));
      const someSelected =
        selectableRows.some((r) => gridState.selectedRows.has(r.id)) && !allSelected;

      return (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleSelectAll}
        />
      );
    },
    [filteredRows, gridState.selectedRows, toggleSelectAll]
  );

  const renderSimpleHeader = useCallback(
    (columnName: string) => {
      return () => {
        return <div>{columnName}</div>;
      };
    },
    []
  );

  const renderEditableDisplayNameCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const value = row.editedDisplayName ?? row.displayName ?? '';
      const hasEdit = row.editedDisplayName !== undefined;

      return (
        <Input
          size="small"
          style={{ backgroundColor: hasEdit ? '#fff7e6' : 'transparent' }}
          value={value}
          onChange={(e) => updateRowField(row.id, 'displayName', e.target.value)}
          placeholder="-"
        />
      );
    },
    [updateRowField]
  );

  const openEditDrawer = useCallback((row: ColumnGridRowData) => {
    setEditDrawer({
      open: true,
      rowId: row.id,
    });
    // Automatically select the row when editing
    setGridState((prev) => {
      const newSelected = new Set(prev.selectedRows);
      newSelected.add(row.id);
      return { ...prev, selectedRows: newSelected };
    });
  }, []);

  const closeEditDrawer = useCallback(() => {
    setEditDrawer({
      open: false,
      rowId: null,
    });
  }, []);

  const saveEditDrawer = useCallback(() => {
    if (!editDrawer.rowId) return;

    const row = allRows.find((r) => r.id === editDrawer.rowId);
    if (!row) return;

    const description = editorRef.current?.getEditorContent() || row.editedDescription || row.description || '';
    updateRowField(editDrawer.rowId, 'description', description);
    closeEditDrawer();
  }, [editDrawer.rowId, allRows, updateRowField, closeEditDrawer]);

  const renderEditableDescriptionCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const value = row.editedDescription ?? row.description ?? '';
      const hasEdit = row.editedDescription !== undefined;
      const displayValue = value.replace(/<[^>]*>/g, '').slice(0, 100);

      return (
        <div
          style={{
            backgroundColor: hasEdit ? '#fff7e6' : 'transparent',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
          }}>
          <Text ellipsis style={{ flex: 1 }}>
            {displayValue || '-'}
          </Text>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditDrawer(row)}
          />
        </div>
      );
    },
    [openEditDrawer]
  );

  const renderEditableTagsCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const currentTags = row.editedTags ?? row.tags ?? [];
      const hasEdit = row.editedTags !== undefined;

      // eslint-disable-next-line no-console
      console.log(`renderEditableTagsCell for ${row.columnName}:`, {
        editedTags: row.editedTags,
        tags: row.tags,
        currentTags,
        hasEdit
      });

      const classificationTags = currentTags.filter((tag) => tag.source !== TagSource.Glossary);

      return (
        <div
          style={{
            backgroundColor: hasEdit ? '#fff7e6' : 'transparent',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
          }}>
          {classificationTags.length > 0 ? (
            <Space size={4} wrap>
              {classificationTags.map((tag: TagLabel) => (
                <Tag key={tag.tagFQN} className="column-grid-tag">
                  {tag.tagFQN}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          )}
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditDrawer(row)}
          />
        </div>
      );
    },
    [openEditDrawer]
  );

  const renderEditableGlossaryTermsCell = useCallback(
    (props: RenderCellProps<ColumnGridRowData>) => {
      const { row } = props;
      const currentTags = row.editedTags ?? row.tags ?? [];
      const hasEdit = row.editedTags !== undefined;

      const glossaryTerms = currentTags.filter((tag) => tag.source === TagSource.Glossary);

      return (
        <div
          style={{
            backgroundColor: hasEdit ? '#fff7e6' : 'transparent',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
          }}>
          {glossaryTerms.length > 0 ? (
            <Space size={4} wrap>
              {glossaryTerms.map((tag: TagLabel) => (
                <Tag key={tag.tagFQN} className="column-grid-tag">
                  {tag.tagFQN}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          )}
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditDrawer(row)}
          />
        </div>
      );
    },
    [openEditDrawer]
  );

  const columns: readonly Column<ColumnGridRowData>[] = useMemo(
    () => [
      {
        key: 'select',
        name: '',
        width: 50,
        frozen: true,
        renderCell: renderCheckboxCell,
        renderHeaderCell: renderCheckboxHeader,
      },
      {
        key: 'columnName',
        name: t('label.column-name'),
        width: 200,
        frozen: true,
        renderCell: renderColumnNameCell,
      },
      {
        key: 'columnFQN',
        name: t('label.fully-qualified-name'),
        width: 350,
        renderCell: renderColumnFQNCell,
      },
      {
        key: 'description',
        name: t('label.description'),
        width: 300,
        renderCell: renderEditableDescriptionCell,
      },
      {
        key: 'dataType',
        name: t('label.data-type'),
        width: 120,
        renderCell: (props) => props.row.dataType || '-',
      },
      {
        key: 'tags',
        name: t('label.tag-plural'),
        width: 250,
        renderCell: renderEditableTagsCell,
      },
      {
        key: 'glossaryTerms',
        name: t('label.glossary-term-plural'),
        width: 250,
        renderCell: renderEditableGlossaryTermsCell,
      },
      {
        key: 'occurrenceCount',
        name: t('label.occurrences'),
        width: 120,
        renderCell: renderOccurrencesCell,
      },
    ],
    [
      t,
      renderCheckboxCell,
      renderCheckboxHeader,
      renderColumnNameCell,
      renderColumnFQNCell,
      renderEditableDescriptionCell,
      renderEditableTagsCell,
      renderEditableGlossaryTermsCell,
      renderOccurrencesCell,
    ]
  );

  const handleBulkUpdate = useCallback(async () => {
    const selectedRowsData = allRows.filter((r) =>
      gridState.selectedRows.has(r.id)
    );

    // eslint-disable-next-line no-console
    console.log('handleBulkUpdate - selectedRowsData:', selectedRowsData);

    const updatesCount = selectedRowsData.filter(
      (r) =>
        r.editedDisplayName !== undefined ||
        r.editedDescription !== undefined ||
        r.editedTags !== undefined
    ).length;

    if (updatesCount === 0) {
      showErrorToast(
        new Error(t('message.no-changes-to-save')),
        t('message.no-changes-to-save')
      );

      return;
    }

    setIsUpdating(true);

    try {
      const columnUpdates: ColumnUpdate[] = [];

      for (const row of selectedRowsData) {
        // eslint-disable-next-line no-console
        console.log('Processing row:', {
          id: row.id,
          editedDisplayName: row.editedDisplayName,
          editedDescription: row.editedDescription,
          editedTags: row.editedTags,
        });

        if (
          row.editedDisplayName === undefined &&
          row.editedDescription === undefined &&
          row.editedTags === undefined
        ) {
          continue;
        }

        const occurrences = row.group?.occurrences || [];

        if (occurrences.length === 0) {
          if (row.gridItem && row.gridItem.groups.length > 0) {
            const firstGroup = row.gridItem.groups[0];
            if (firstGroup.occurrences && firstGroup.occurrences.length > 0) {
              occurrences.push(...firstGroup.occurrences);
            }
          }
        }

        for (const occurrence of occurrences) {
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
        showErrorToast(
          new Error(t('message.no-changes-to-save')),
          t('message.no-changes-to-save')
        );
        setIsUpdating(false);

        return;
      }

      // Clean up tags to only include fields expected by the backend
      const cleanedUpdates = columnUpdates.map((update) => ({
        columnFQN: update.columnFQN,
        entityType: update.entityType,
        ...(update.displayName !== undefined && { displayName: update.displayName }),
        ...(update.description !== undefined && { description: update.description }),
        ...(update.tags !== undefined && {
          tags: update.tags
            .filter((tag) => tag.tagFQN) // Only include tags with valid tagFQN
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

      // eslint-disable-next-line no-console
      console.log('Sending bulk update request:', JSON.stringify(request, null, 2));

      const response = await bulkUpdateColumnsAsync(request);

      showSuccessToast(
        t('message.bulk-update-initiated', {
          entity: t('label.column-plural'),
          count: columnUpdates.length,
        })
      );

      setIsUpdating(false);
      setGridState((prev) => ({
        ...prev,
        selectedRows: new Set(),
      }));

      setAllRows((prev) =>
        prev.map((r) => {
          if (gridState.selectedRows.has(r.id)) {
            return {
              ...r,
              displayName: r.editedDisplayName !== undefined ? r.editedDisplayName : r.displayName,
              description: r.editedDescription !== undefined ? r.editedDescription : r.description,
              tags: r.editedTags !== undefined ? r.editedTags : r.tags,
              editedDisplayName: undefined,
              editedDescription: undefined,
              editedTags: undefined,
            };
          }
          return r;
        })
      );
    } catch (error) {
      showErrorToast(error as Error, t('server.entity-updating-error'));
      setIsUpdating(false);
    }
  }, [allRows, gridState.selectedRows, t]);


  const hasEdits = useMemo(() => {
    return allRows.some(
      (r) =>
        gridState.selectedRows.has(r.id) &&
        (r.editedDisplayName !== undefined ||
          r.editedDescription !== undefined ||
          r.editedTags !== undefined)
    );
  }, [allRows, gridState.selectedRows]);

  const editedCount = useMemo(() => {
    return allRows.filter(
      (r) =>
        r.editedDisplayName !== undefined ||
        r.editedDescription !== undefined ||
        r.editedTags !== undefined
    ).length;
  }, [allRows]);

  return (
    <div className="column-grid-container">
      {/* Summary Cards */}
      <Row gutter={[16, 16]} className="column-grid-summary">
        <Col span={8}>
          <Card>
            <Statistic
              title={t('label.total-unique-columns')}
              value={gridState.totalUniqueColumns}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('label.total-occurrences')}
              value={gridState.totalOccurrences}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('label.edited-columns')}
              value={editedCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <div className="column-grid-filter-bar">
        <Space size={8} wrap>
          <Input
            size="middle"
            placeholder={t('label.search-entity', { entity: t('label.column-plural') })}
            prefix={<SearchOutlined />}
            value={gridState.quickFilter}
            onChange={(e) => handleQuickFilterChange(e.target.value)}
            allowClear
            style={{ width: '250px' }}
          />
          <Select
            mode="multiple"
            placeholder="Asset Type"
            style={{ minWidth: '150px' }}
            allowClear
            value={serverFilters.entityTypes}
            onChange={(value) => {
              setServerFilters((prev) => ({ ...prev, entityTypes: value }));
            }}
          >
            <Select.Option value="table">{t('label.table')}</Select.Option>
            <Select.Option value="dashboard">{t('label.dashboard')}</Select.Option>
            <Select.Option value="topic">{t('label.topic')}</Select.Option>
            <Select.Option value="container">{t('label.container')}</Select.Option>
            <Select.Option value="search_index">{t('label.search-index')}</Select.Option>
          </Select>
          <Input
            size="middle"
            placeholder="Service"
            value={serverFilters.serviceName}
            onChange={(e) => {
              setServerFilters((prev) => ({ ...prev, serviceName: e.target.value }));
            }}
            allowClear
            style={{ width: '150px' }}
          />
          {serverFilters.serviceName && (
            <>
              <Input
                size="middle"
                placeholder="Database"
                value={serverFilters.databaseName}
                onChange={(e) => {
                  setServerFilters((prev) => ({ ...prev, databaseName: e.target.value }));
                }}
                allowClear
                style={{ width: '150px' }}
              />
              <Input
                size="middle"
                placeholder="Schema"
                value={serverFilters.schemaName}
                onChange={(e) => {
                  setServerFilters((prev) => ({ ...prev, schemaName: e.target.value }));
                }}
                allowClear
                style={{ width: '150px' }}
              />
            </>
          )}
          {gridState.selectedRows.size > 0 && (
            <Text type="secondary">
              Selected: {gridState.selectedRows.size}
            </Text>
          )}
        </Space>
        <Button
          disabled={!hasEdits || isUpdating}
          loading={isUpdating}
          type="primary"
          onClick={handleBulkUpdate}>
          {t('label.update')} {gridState.selectedRows.size > 0 ? `(${gridState.selectedRows.size})` : ''}
        </Button>
      </div>

      {/* Loaded columns indicator */}
      {gridItems.length > 0 && (
        <div style={{
          padding: '8px 16px',
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Text type="secondary">
            {gridState.hasMore
              ? `Loaded ${gridItems.length} columns (more available - scroll or click below to load more)`
              : `Loaded ${gridItems.length} columns (all loaded)`
            }
          </Text>
          {gridState.hasMore && !gridState.loading && (
            <Button
              size="small"
              onClick={() => loadMoreData(gridState.cursor)}
            >
              Load More
            </Button>
          )}
        </div>
      )}

      {/* Grid Table */}
      <div className="column-grid-wrapper" ref={gridWrapperRef}>
        {gridState.loading && filteredRows.length === 0 ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '600px'
          }}>
            <Spin size="large" tip={t('label.loading')} />
          </div>
        ) : (
          <>
            <DataGrid
              key={renderVersion}
              className="column-grid rdg-light"
              columns={columns}
              rows={filteredRows}
              rowKeyGetter={(row) => row.id}
              style={{ height: '600px', minWidth: '100%' }}
              rowHeight={50}
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

      {/* Unified Edit Drawer */}
      <Drawer
        title={t('label.edit-entity', { entity: t('label.column') })}
        placement="right"
        width={720}
        open={editDrawer.open}
        onClose={closeEditDrawer}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={closeEditDrawer}>{t('label.cancel')}</Button>
            <Button type="primary" onClick={saveEditDrawer}>
              {t('label.save')}
            </Button>
          </Space>
        }>
        {(() => {
          const currentRow = editDrawer.rowId ? allRows.find((r) => r.id === editDrawer.rowId) : null;
          if (!currentRow) return null;

          return (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              {/* Column Name */}
              <div>
                <Text strong>{t('label.column-name')}:</Text>
                <div style={{ marginTop: 8 }}>
                  <Text>{currentRow.columnName}</Text>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <Text strong>{t('label.display-name')}:</Text>
                <Input
                  style={{ marginTop: 8 }}
                  value={currentRow.editedDisplayName ?? currentRow.displayName ?? ''}
                  onChange={(e) => updateRowField(currentRow.id, 'displayName', e.target.value)}
                  placeholder={t('label.add-entity', { entity: t('label.display-name') })}
                />
              </div>

              {/* Description */}
              <div>
                <Text strong>{t('label.description')}:</Text>
                <div style={{ marginTop: 8 }}>
                  <RichTextEditor
                    key={currentRow.id}
                    ref={editorRef}
                    initialValue={currentRow.editedDescription ?? currentRow.description ?? ''}
                    placeHolder={t('label.add-entity', { entity: t('label.description') })}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <Text strong>{t('label.tag-plural')}:</Text>
                <div style={{ marginTop: 8 }}>
                  <Form>
                    <AsyncSelectList
                      mode="multiple"
                      placeholder={t('label.add-entity', { entity: t('label.tag-plural') })}
                      initialOptions={(currentRow.editedTags ?? currentRow.tags ?? [])
                        .filter((tag) => tag.source !== TagSource.Glossary)
                        .map((tag) => ({
                          label: tag.tagFQN,
                          value: tag.tagFQN,
                          data: tag,
                        }))}
                      fetchOptions={tagClassBase.getTags}
                      onChange={(selectedTags) => {
                        // eslint-disable-next-line no-console
                        console.log('Classification tags changed:', selectedTags);
                        const currentTags = currentRow.editedTags ?? currentRow.tags ?? [];
                        const glossaryTerms = currentTags.filter((tag) => tag.source === TagSource.Glossary);
                        const newClassificationTags = selectedTags
                          .filter((option) => option.data)
                          .map((option) => option.data as TagLabel);
                        const allTags = [...newClassificationTags, ...glossaryTerms];
                        // eslint-disable-next-line no-console
                        console.log('Updated all tags:', allTags);
                        updateRowField(currentRow.id, 'tags', allTags);
                      }}
                      hasNoActionButtons
                    />
                  </Form>
                </div>
              </div>

              {/* Glossary Terms */}
              <div>
                <Text strong>{t('label.glossary-term-plural')}:</Text>
                <div style={{ marginTop: 8 }}>
                  <Form>
                    <TreeAsyncSelectList
                      placeholder={t('label.add-entity', { entity: t('label.glossary-term-plural') })}
                      initialOptions={(currentRow.editedTags ?? currentRow.tags ?? [])
                        .filter((tag) => tag.source === TagSource.Glossary)
                        .map((tag) => ({
                          label: tag.tagFQN,
                          value: tag.tagFQN,
                          data: tag,
                        }))}
                      onChange={(selectedTerms) => {
                        // eslint-disable-next-line no-console
                        console.log('Glossary terms changed:', selectedTerms);
                        const currentTags = currentRow.editedTags ?? currentRow.tags ?? [];
                        const classificationTags = currentTags.filter((tag) => tag.source !== TagSource.Glossary);
                        const newGlossaryTerms = selectedTerms
                          .filter((option) => option.data)
                          .map((option) => option.data as TagLabel);
                        const allTags = [...classificationTags, ...newGlossaryTerms];
                        // eslint-disable-next-line no-console
                        console.log('Updated all tags:', allTags);
                        updateRowField(currentRow.id, 'tags', allTags);
                      }}
                      hasNoActionButtons
                    />
                  </Form>
                </div>
              </div>

              {/* Data Type (read-only) */}
              <div>
                <Text strong>{t('label.data-type')}:</Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">{currentRow.dataType || '-'}</Text>
                </div>
              </div>

              {/* Occurrences (read-only) */}
              <div>
                <Text strong>{t('label.occurrences')}:</Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">{currentRow.occurrenceCount}</Text>
                </div>
              </div>
            </Space>
          );
        })()}
      </Drawer>
    </div>
  );
};

export default ColumnGrid;
