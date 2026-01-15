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

import { DownOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import {
  Box,
  Button as MUIButton,
  Paper,
  Stack,
  Switch,
  TableContainer,
  Typography,
  useTheme,
} from '@mui/material';
import { Tag01 as TagIcon } from '@untitledui/icons';
import {
  Button,
  Drawer,
  Form,
  Input,
  Tag,
  Typography as AntTypography,
} from 'antd';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ReactComponent as OccurrencesIcon } from '../../../assets/svg/ic-occurences.svg';
import { ReactComponent as PendingChangesIcon } from '../../../assets/svg/ic-pending-changes.svg';
import { ReactComponent as UniqueColumnsIcon } from '../../../assets/svg/ic-unique-column.svg';
import AsyncSelectList from '../../../components/common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { useFilterSelection } from '../../../components/common/atoms/filters/useFilterSelection';
import { useSearch } from '../../../components/common/atoms/navigation/useSearch';
import { usePaginationControls } from '../../../components/common/atoms/pagination/usePaginationControls';
import {
  CellRenderer,
  ColumnConfig,
} from '../../../components/common/atoms/shared/types';
import { useDataTable } from '../../../components/common/atoms/table/useDataTable';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../components/common/RichTextEditor/RichTextEditor.interface';
import SearchDropdown from '../../../components/SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../../components/SearchDropdown/SearchDropdown.interface';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  BulkColumnUpdateRequest,
  ColumnUpdate,
} from '../../../generated/api/data/bulkColumnUpdateRequest';
import {
  ColumnChild,
  ColumnGridItem,
  ColumnOccurrenceRef,
} from '../../../generated/api/data/columnGridResponse';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { bulkUpdateColumnsAsync } from '../../../rest/columnAPI';
import { getTableFQNFromColumnFQN } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ColumnGridProps, ColumnGridRowData } from './ColumnGrid.interface';
import './ColumnGrid.less';
import { ColumnGridTableRow } from './components/ColumnGridTableRow';
import {
  ASSET_TYPE_OPTIONS,
  DATA_TYPE_OPTIONS,
  METADATA_STATUS_OPTIONS,
} from './constants/ColumnGrid.constants';
import { useColumnGridFilters } from './hooks/useColumnGridFilters';
import { useColumnGridListingData } from './hooks/useColumnGridListingData';
// Removed React Data Grid - using MUI Table instead

const { Text } = AntTypography;

const ColumnGrid: React.FC<ColumnGridProps> = ({
  filters: externalFilters,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false);
  const [editDrawer, setEditDrawer] = useState<{
    open: boolean;
    rowId: string | null;
  }>({
    open: false,
    rowId: null,
  });
  const editorRef = React.useRef<EditorContentRef>(null);

  // Get current filter values from URL
  const currentDataType = useMemo(() => {
    const dataTypeParam = searchParams.get('dataType');

    if (!dataTypeParam) {
      return [];
    }

    return [{ key: dataTypeParam, label: dataTypeParam }];
  }, [searchParams]);

  const currentMetadataStatus = useMemo(() => {
    const statusParam = searchParams.get('metadataStatus');

    if (!statusParam) {
      return [];
    }

    return statusParam
      .split(',')
      .filter(Boolean)
      .map((status) => {
        const option = METADATA_STATUS_OPTIONS.find(
          (opt) => opt.key === status
        );

        return option || { key: status, label: status };
      });
  }, [searchParams]);

  const currentAssetType = useMemo(() => {
    const assetTypeParam = searchParams.get(EntityFields.ENTITY_TYPE);

    if (!assetTypeParam) {
      return [];
    }

    return assetTypeParam
      .split(',')
      .filter(Boolean)
      .map((type) => {
        const option = ASSET_TYPE_OPTIONS.find((opt) => opt.key === type);

        return option || { key: type, label: type };
      });
  }, [searchParams]);

  // Handle data type filter change
  const handleDataTypeChange = useCallback(
    (values: SearchDropdownOption[]) => {
      const newParams = new URLSearchParams(searchParams);
      if (values.length > 0) {
        // For dataType, we only allow single selection
        newParams.set('dataType', values[0].key);
      } else {
        newParams.delete('dataType');
      }
      newParams.delete('page'); // Reset to page 1
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Handle metadata status filter change
  const handleMetadataStatusChange = useCallback(
    (values: SearchDropdownOption[]) => {
      const newParams = new URLSearchParams(searchParams);
      if (values.length > 0) {
        const statusValues = values.map((v) => v.key).join(',');
        newParams.set('metadataStatus', statusValues);
      } else {
        newParams.delete('metadataStatus');
      }
      newParams.delete('page'); // Reset to page 1
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleAssetTypeChange = useCallback(
    (values: SearchDropdownOption[]) => {
      const newParams = new URLSearchParams(searchParams);
      if (values.length > 0) {
        const assetTypeValues = values.map((v) => v.key).join(',');
        newParams.set(EntityFields.ENTITY_TYPE, assetTypeValues);
      } else {
        newParams.delete(EntityFields.ENTITY_TYPE);
      }
      newParams.delete('page'); // Reset to page 1
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

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
    nestingLevel: number,
    expandedStructRows: Set<string>
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
          ...createStructChildRows(
            child.children,
            childId,
            nestingLevel + 1,
            expandedStructRows
          )
        );
      }
    }

    return rows;
  };

  // Helper functions for transform

  // Transform function that will be used by the hook
  const transformGridItemsToRows = useCallback(
    (
      items: ColumnGridItem[],
      expandedRows: Set<string>,
      expandedStructRows: Set<string>
    ): ColumnGridRowData[] => {
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
                  ...createStructChildRows(
                    group.children,
                    childRowId,
                    1,
                    expandedStructRows
                  )
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
              ...createStructChildRows(
                group.children,
                item.columnName,
                1,
                expandedStructRows
              )
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
              ...createStructChildRows(
                group.children,
                item.columnName,
                1,
                expandedStructRows
              )
            );
          }
        }
      }

      return rows;
    },
    []
  );

  // Define columns inline (similar to DomainListPage pattern)
  const columns: ColumnConfig<ColumnGridRowData>[] = useMemo(
    () => [
      { key: 'columnName', labelKey: 'label.column-name', render: 'custom' },
      { key: 'path', labelKey: 'label.path', render: 'custom' },
      { key: 'description', labelKey: 'label.description', render: 'custom' },
      { key: 'dataType', labelKey: 'label.data-type', render: 'text' },
      { key: 'tags', labelKey: 'label.tag-plural', render: 'custom' },
      {
        key: 'glossaryTerms',
        labelKey: 'label.glossary-term-plural',
        render: 'custom',
      },
    ],
    []
  );

  // Get column link function - defined before use
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

    if (!occurrence || !occurrence.columnFQN) {
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

    // Extract table FQN from column FQN
    const tableFQN = getTableFQNFromColumnFQN(occurrence.columnFQN);

    // Extract column name from column FQN (last part after table)
    const columnName = occurrence.columnFQN.split('.').pop() || '';

    // Build path with column name as hash fragment
    const basePath = getEntityDetailsPath(
      entityType,
      tableFQN || occurrence.entityFQN,
      tab
    );

    // Add column name as hash fragment for schema tab navigation
    return columnName
      ? `${basePath}#${encodeURIComponent(columnName)}`
      : basePath;
  }, []);

  // Define render functions with correct CellRenderer signature
  const renderPathCellAdapter = useCallback((entity: ColumnGridRowData) => {
    if (!entity.path) {
      return <Text type="secondary">-</Text>;
    }

    return (
      <Box className="path-cell">
        <Text className="path-text">{entity.path}</Text>
        {entity.additionalPathsCount && entity.additionalPathsCount > 0 && (
          <Text className="path-more" type="secondary">
            +{entity.additionalPathsCount} more
          </Text>
        )}
      </Box>
    );
  }, []);

  const renderDescriptionCellAdapter = useCallback(
    (entity: ColumnGridRowData) => {
      const description = entity.editedDescription ?? entity.description ?? '';
      const hasEdit = entity.editedDescription !== undefined;

      // Show coverage status for parent rows
      if (
        entity.hasCoverage &&
        entity.coverageCount !== undefined &&
        entity.totalCount !== undefined
      ) {
        const isFull = entity.coverageCount === entity.totalCount;
        const coverageText = isFull
          ? `Full Coverage (${entity.coverageCount}/${entity.totalCount})`
          : `Partial Coverage (${entity.coverageCount}/${entity.totalCount})`;

        return (
          <Text className={isFull ? 'coverage-full' : 'coverage-partial'}>
            {coverageText}
          </Text>
        );
      }

      // Show actual description for child rows or single occurrences
      const displayValue = description.replace(/<[^>]*>/g, '').slice(0, 100);

      return (
        <Box className={`description-cell ${hasEdit ? 'has-edit' : ''}`}>
          <Text ellipsis>{displayValue || '-'}</Text>
        </Box>
      );
    },
    []
  );

  const renderTagsCellAdapter = useCallback((entity: ColumnGridRowData) => {
    const currentTags = entity.editedTags ?? entity.tags ?? [];
    const classificationTags = currentTags.filter(
      (tag: TagLabel) => tag.source !== TagSource.Glossary
    );

    if (classificationTags.length === 0) {
      return <Text type="secondary">-</Text>;
    }

    const visibleTags = classificationTags.slice(0, 2);
    const remainingCount = classificationTags.length - 2;

    return (
      <Box className="tags-cell">
        {visibleTags.map((tag: TagLabel, index: number) => (
          <Tag
            className={`grid-tag ${
              index === 0 ? 'grid-tag-primary' : 'grid-tag-secondary'
            }`}
            key={tag.tagFQN}>
            {index === 0 && (
              <TagIcon className="tag-icon" height={12} width={12} />
            )}
            {tag.name || tag.tagFQN.split('.').pop()}
          </Tag>
        ))}
        {remainingCount > 0 && (
          <span className="grid-tag-count">+{remainingCount}</span>
        )}
      </Box>
    );
  }, []);

  const renderGlossaryTermsCellAdapter = useCallback(
    (entity: ColumnGridRowData) => {
      const currentTags = entity.editedTags ?? entity.tags ?? [];
      const glossaryTerms = currentTags.filter(
        (tag: TagLabel) => tag.source === TagSource.Glossary
      );

      if (glossaryTerms.length === 0) {
        return <Text type="secondary">-</Text>;
      }

      const visibleTerms = glossaryTerms.slice(0, 1);
      const remainingCount = glossaryTerms.length - 1;

      return (
        <Box className="tags-cell">
          {visibleTerms.map((tag: TagLabel) => (
            <Tag className="glossary-tag" key={tag.tagFQN}>
              {tag.name || tag.tagFQN.split('.').pop()}
            </Tag>
          ))}
          {remainingCount > 0 && (
            <span className="grid-tag-count">+{remainingCount}</span>
          )}
        </Box>
      );
    },
    []
  );

  // Define initial renderers (columnName will be set up after listing data)
  const initialRenderers: CellRenderer<ColumnGridRowData> = useMemo(
    () => ({
      columnName: () => null, // Will be set up after listing data
      path: renderPathCellAdapter,
      description: renderDescriptionCellAdapter,
      tags: renderTagsCellAdapter,
      glossaryTerms: renderGlossaryTermsCellAdapter,
    }),
    [
      renderPathCellAdapter,
      renderDescriptionCellAdapter,
      renderTagsCellAdapter,
      renderGlossaryTermsCellAdapter,
    ]
  );

  // Set up listing data hook
  const columnGridListing = useColumnGridListingData({
    externalFilters,
    transformGridItemsToRows,
    columns,
    renderers: initialRenderers,
  });

  // Update render functions to use listing data state (with correct CellRenderer signature)
  const renderColumnNameCellFinal = useCallback(
    (entity: ColumnGridRowData) => {
      const link = getColumnLink(entity);
      const hasStructChildren = entity.children && entity.children.length > 0;
      const isStructType =
        entity.dataType?.toUpperCase() === 'STRUCT' ||
        entity.dataType?.toUpperCase() === 'MAP' ||
        entity.dataType?.toUpperCase() === 'UNION' ||
        hasStructChildren;

      // STRUCT child rows - show with proper indentation
      if (entity.isStructChild) {
        const nestingLevel = entity.nestingLevel || 1;
        const indentStyle = { paddingLeft: `${nestingLevel * 20}px` };
        const structExpandButton =
          entity.children && entity.children.length > 0 ? (
            <Button
              className="expand-button"
              icon={entity.isExpanded ? <DownOutlined /> : <RightOutlined />}
              size="small"
              type="text"
              onClick={() => {
                columnGridListing.setExpandedStructRows((prev: Set<string>) => {
                  const newSet = new Set(prev);
                  if (newSet.has(entity.id)) {
                    newSet.delete(entity.id);
                  } else {
                    newSet.add(entity.id);
                  }

                  return newSet;
                });
              }}
            />
          ) : null;

        return (
          <Box className="column-name-cell struct-child-row" sx={indentStyle}>
            {structExpandButton}
            <Text type="secondary">{entity.columnName}</Text>
          </Box>
        );
      }

      if (entity.isGroup && entity.occurrenceCount > 1) {
        const expandButton = (
          <Button
            className="expand-button"
            icon={entity.isExpanded ? <DownOutlined /> : <RightOutlined />}
            size="small"
            type="text"
            onClick={() => {
              columnGridListing.setExpandedRows((prev: Set<string>) => {
                const newSet = new Set(prev);
                if (newSet.has(entity.id)) {
                  newSet.delete(entity.id);
                } else {
                  newSet.add(entity.id);
                }

                return newSet;
              });
            }}
          />
        );

        const nameWithCount = `${entity.columnName} (${entity.occurrenceCount})`;

        // Also show STRUCT expansion button if applicable
        const structButton = isStructType ? (
          <Button
            className="expand-button struct-expand"
            icon={
              columnGridListing.expandedStructRows.has(entity.id) ? (
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
              columnGridListing.setExpandedStructRows((prev: Set<string>) => {
                const newSet = new Set(prev);
                if (newSet.has(entity.id)) {
                  newSet.delete(entity.id);
                } else {
                  newSet.add(entity.id);
                }

                return newSet;
              });
            }}
          />
        ) : null;

        return (
          <Box className="column-name-cell">
            {expandButton}
            {link ? (
              <Link className="column-link" to={link}>
                {nameWithCount}
              </Link>
            ) : (
              <Text strong>{nameWithCount}</Text>
            )}
            {structButton}
          </Box>
        );
      }

      // Child row or single occurrence
      const indent = entity.parentId ? 'child-row' : '';

      // Show STRUCT expansion button for single occurrence STRUCT columns
      const structExpandButton =
        isStructType && !entity.parentId ? (
          <Button
            className="expand-button"
            icon={entity.isExpanded ? <DownOutlined /> : <RightOutlined />}
            size="small"
            title="Expand nested fields"
            type="text"
            onClick={() => {
              columnGridListing.setExpandedStructRows((prev: Set<string>) => {
                const newSet = new Set(prev);
                if (newSet.has(entity.id)) {
                  newSet.delete(entity.id);
                } else {
                  newSet.add(entity.id);
                }

                return newSet;
              });
            }}
          />
        ) : null;

      const content = (
        <span className={indent}>
          {link ? (
            <Link className="column-link" to={link}>
              {entity.columnName}
            </Link>
          ) : (
            entity.columnName
          )}
        </span>
      );

      return (
        <Box className="column-name-cell">
          {structExpandButton}
          {content}
        </Box>
      );
    },
    [
      getColumnLink,
      columnGridListing.expandedStructRows,
      columnGridListing.setExpandedRows,
      columnGridListing.setExpandedStructRows,
    ]
  );

  // Update renderers with final functions
  const finalRenderers: CellRenderer<ColumnGridRowData> = useMemo(
    () => ({
      columnName: renderColumnNameCellFinal,
      path: renderPathCellAdapter,
      description: renderDescriptionCellAdapter,
      tags: renderTagsCellAdapter,
      glossaryTerms: renderGlossaryTermsCellAdapter,
    }),
    [
      renderColumnNameCellFinal,
      renderPathCellAdapter,
      renderDescriptionCellAdapter,
      renderTagsCellAdapter,
      renderGlossaryTermsCellAdapter,
    ]
  );

  // Selection and expansion handled by listing data hook

  const updateRowField = useCallback(
    (
      rowId: string,
      field: 'displayName' | 'description' | 'tags',
      value: string | TagLabel[]
    ) => {
      const fieldName = `edited${field.charAt(0).toUpperCase()}${field.slice(
        1
      )}`;

      columnGridListing.setAllRows((prev: ColumnGridRowData[]) => {
        const updated = prev.map((row: ColumnGridRowData) =>
          row.id === rowId
            ? {
                ...row,
                [fieldName]: value,
              }
            : row
        );

        return updated;
      });

      // Ensure row is selected
      if (!columnGridListing.isSelected(rowId)) {
        columnGridListing.handleSelect(rowId, true);
      }
    },
    [columnGridListing]
  );

  // Checkbox rendering now handled directly in TableRow - no separate renderers needed

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

  const handleBulkUpdate = useCallback(async () => {
    const selectedRowsData = columnGridListing.allRows.filter(
      (r: ColumnGridRowData) => columnGridListing.isSelected(r.id)
    );

    const updatesCount = selectedRowsData.filter(
      (r: ColumnGridRowData) =>
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

      await bulkUpdateColumnsAsync(request);

      showSuccessToast(
        t('message.bulk-update-initiated', {
          entity: t('label.column-plural'),
          count: columnUpdates.length,
        })
      );

      setIsUpdating(false);
      closeEditDrawer();
      columnGridListing.clearSelection();

      // Clear edited state and refresh data from server after a delay
      // to allow the async backend operation to complete
      columnGridListing.setAllRows((prev: ColumnGridRowData[]) =>
        prev.map((r: ColumnGridRowData) => ({
          ...r,
          editedDisplayName: undefined,
          editedDescription: undefined,
          editedTags: undefined,
        }))
      );

      // Refresh grid data from server after backend processes updates
      setTimeout(() => {
        columnGridListing.setGridItems([]);
        columnGridListing.setExpandedRows(new Set());
        columnGridListing.refetch();
      }, 2000);
    } catch (error) {
      showErrorToast(t('server.entity-updating-error'));
      setIsUpdating(false);
    }
  }, [
    columnGridListing.allRows,
    columnGridListing.selectedEntities,
    t,
    columnGridListing.refetch,
  ]);

  // Set up filters
  const { quickFilters, defaultFilters } = useColumnGridFilters({
    aggregations: columnGridListing.aggregations || undefined,
    parsedFilters: columnGridListing.parsedFilters,
    onFilterChange: columnGridListing.handleFilterChange,
  });

  // Set up filter selection display
  const { filterSelectionDisplay } = useFilterSelection({
    urlState: columnGridListing.urlState,
    filterConfigs: defaultFilters,
    parsedFilters: columnGridListing.parsedFilters,
    onFilterChange: columnGridListing.handleFilterChange,
  });

  // Set up search
  const { search } = useSearch({
    searchPlaceholder: t('label.search-columns'),
    onSearchChange: columnGridListing.handleSearchChange,
    initialSearchQuery: columnGridListing.urlState.searchQuery,
  });

  // Set up data table with custom row component
  const CustomTableRow = useCallback(
    (props: Record<string, unknown>) => {
      const { entity, isSelected, onSelect, onEntityClick } = props as {
        entity: ColumnGridRowData;
        isSelected: boolean;
        onSelect: (id: string, checked: boolean) => void;
        onEntityClick: (entity: ColumnGridRowData) => void;
      };

      return (
        <ColumnGridTableRow
          entity={entity}
          isSelected={isSelected}
          renderColumnNameCell={renderColumnNameCellFinal}
          renderDescriptionCell={renderDescriptionCellAdapter}
          renderGlossaryTermsCell={renderGlossaryTermsCellAdapter}
          renderPathCell={renderPathCellAdapter}
          renderTagsCell={renderTagsCellAdapter}
          onEntityClick={onEntityClick}
          onSelect={onSelect}
        />
      );
    },
    [
      renderColumnNameCellFinal,
      renderPathCellAdapter,
      renderDescriptionCellAdapter,
      renderTagsCellAdapter,
      renderGlossaryTermsCellAdapter,
    ]
  );

  // Filter entities to show only selected ones when viewSelectedOnly is true
  const filteredEntities = useMemo(() => {
    if (viewSelectedOnly) {
      const selectedIds = new Set(columnGridListing.selectedEntities);

      return columnGridListing.entities.filter((entity) =>
        selectedIds.has(entity.id)
      );
    }

    return columnGridListing.entities;
  }, [
    viewSelectedOnly,
    columnGridListing.entities,
    columnGridListing.selectedEntities,
  ]);

  const { dataTable } = useDataTable({
    listing: {
      ...columnGridListing,
      entities: filteredEntities,
      columns,
      renderers: finalRenderers,
    },
    enableSelection: true,
    entityLabelKey: 'label.column',
    customTableRow: CustomTableRow,
  });

  // Set up pagination with prev/next only mode
  const { paginationControls } = usePaginationControls({
    currentPage: columnGridListing.currentPage,
    totalPages: columnGridListing.totalPages,
    totalEntities: columnGridListing.totalEntities,
    pageSize: columnGridListing.pageSize,
    onPageChange: columnGridListing.handlePageChange,
    prevNextOnly: true, // Only show prev/next buttons, no page numbers or page size selector
  });

  const editedCount = useMemo(() => {
    return columnGridListing.allRows.filter(
      (r: ColumnGridRowData) =>
        r.editedDisplayName !== undefined ||
        r.editedDescription !== undefined ||
        r.editedTags !== undefined
    ).length;
  }, [columnGridListing.allRows]);

  const selectedCount = columnGridListing.selectedEntities.length;
  const hasSelection = selectedCount > 0;

  // Automatically turn off "View Selected" when selection is cleared
  useEffect(() => {
    if (!hasSelection && viewSelectedOnly) {
      setViewSelectedOnly(false);
    }
  }, [hasSelection, viewSelectedOnly]);

  // Content similar to DomainListPage
  const content = useMemo(() => {
    // Show no data placeholder when no data and not loading
    if (!columnGridListing.loading && isEmpty(filteredEntities)) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          heading={t('message.no-data-message', {
            entity: t('label.column-lowercase-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}
        />
      );
    }

    return (
      <>
        {dataTable}
        {paginationControls}
      </>
    );
  }, [
    columnGridListing.loading,
    filteredEntities,
    dataTable,
    paginationControls,
    t,
  ]);

  return (
    <div className="column-grid-container">
      {/* Summary Stats Cards */}
      <Stack className="stats-row" direction="row" spacing={2}>
        <Paper className="stat-card" elevation={0}>
          <UniqueColumnsIcon className="stat-icon" />
          <Box className="stat-content">
            <Typography
              color={theme.palette.grey[900]}
              fontSize="18px"
              fontWeight={600}>
              {columnGridListing.totalUniqueColumns.toLocaleString()}
            </Typography>
            <Typography
              color={theme.palette.grey[700]}
              fontSize="14px"
              fontWeight={400}>
              {t('label.total-unique-columns')}
            </Typography>
          </Box>
        </Paper>
        <Paper className="stat-card" elevation={0}>
          <OccurrencesIcon className="stat-icon" />
          <Box className="stat-content">
            <Typography
              color={theme.palette.grey[900]}
              fontSize="18px"
              fontWeight={600}>
              {columnGridListing.totalOccurrences.toLocaleString()}
            </Typography>
            <Typography
              color={theme.palette.grey[700]}
              fontSize="14px"
              fontWeight={400}>
              {t('label.total-occurrences')}
            </Typography>
          </Box>
        </Paper>
        <Paper className="stat-card" elevation={0}>
          <PendingChangesIcon className="stat-icon" />
          <Box className="stat-content">
            <Typography
              color={theme.palette.grey[900]}
              fontSize="18px"
              fontWeight={600}>
              {editedCount > 0
                ? `${editedCount}/${selectedCount || editedCount}`
                : '0'}
            </Typography>
            <Typography
              color={theme.palette.grey[700]}
              fontSize="14px"
              fontWeight={400}>
              {t('label.pending-changes')}
            </Typography>
          </Box>
        </Paper>
      </Stack>

      {/* Table Container - Same structure as DomainListPage */}
      <TableContainer component={Paper} sx={{ mb: 5 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            px: 6,
            py: 4,
            borderBottom: `1px solid`,
            borderColor: theme.palette.allShades?.gray?.[200],
          }}>
          <Box sx={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {search}
            <SearchDropdown
              hideCounts
              highlight
              independent
              label={t('label.asset-type')}
              options={ASSET_TYPE_OPTIONS}
              searchKey={EntityFields.ENTITY_TYPE}
              selectedKeys={currentAssetType}
              showSelectedCounts={false}
              triggerButtonSize="middle"
              onChange={handleAssetTypeChange}
              onGetInitialOptions={() => {}}
              onSearch={() => {}}
            />
            {quickFilters}
            <SearchDropdown
              hideCounts
              highlight
              independent
              label={t('label.data-type')}
              options={DATA_TYPE_OPTIONS}
              searchKey="dataType"
              selectedKeys={currentDataType}
              showSelectedCounts={false}
              triggerButtonSize="middle"
              onChange={handleDataTypeChange}
              onGetInitialOptions={() => {}}
              onSearch={() => {}}
            />
            <SearchDropdown
              hideCounts
              highlight
              independent
              label={t('label.metadata-status')}
              options={METADATA_STATUS_OPTIONS}
              searchKey="metadataStatus"
              selectedKeys={currentMetadataStatus}
              showSelectedCounts={false}
              triggerButtonSize="middle"
              onChange={handleMetadataStatusChange}
              onGetInitialOptions={() => {}}
              onSearch={() => {}}
            />
            <Box ml="auto" />
            {/* View Selected Toggle */}
            {hasSelection && (
              <>
                <Typography
                  className="view-selected-label"
                  color={theme.palette.grey[900]}
                  fontSize="14px"
                  fontWeight={400}
                  lineHeight="19px">
                  {t('label.view-selected')} ({selectedCount})
                </Typography>
                <Switch
                  checked={viewSelectedOnly}
                  size="small"
                  onChange={(event) => {
                    setViewSelectedOnly(event.target.checked);
                  }}
                />
              </>
            )}
            {/* Action Buttons */}
            <Stack direction="row" spacing={1}>
              {hasSelection ? (
                <>
                  <MUIButton
                    className="edit-button-primary"
                    disabled={isUpdating}
                    startIcon={<EditOutlined />}
                    sx={{
                      borderRadius: '8px',
                      border: `1px solid ${theme.palette.primary.main}`,
                      backgroundColor: theme.palette.primary.main,
                      boxShadow: '0 1px 2px 0 rgba(10, 13, 18, 0.05)',
                      '&:disabled': {
                        backgroundColor:
                          theme.palette.action.disabledBackground,
                        borderColor: theme.palette.action.disabledBackground,
                      },
                    }}
                    variant="contained"
                    onClick={openEditDrawer}>
                    {t('label.edit')}
                  </MUIButton>
                  <MUIButton
                    className="cancel-button"
                    sx={{
                      color: theme.palette.error.main,
                      fontSize: '14px',
                      fontWeight: 500,
                      lineHeight: '19px',
                    }}
                    variant="text"
                    onClick={() => {
                      columnGridListing.clearSelection();
                      setViewSelectedOnly(false);
                    }}>
                    {t('label.cancel')}
                  </MUIButton>
                </>
              ) : (
                <MUIButton
                  disabled
                  className="edit-button"
                  startIcon={<EditOutlined />}
                  sx={{ color: theme.palette.grey[500] }}
                  variant="text"
                  onClick={openEditDrawer}>
                  {t('label.edit')}
                </MUIButton>
              )}
            </Stack>
          </Box>
          {filterSelectionDisplay}
        </Box>
        {content}
      </TableContainer>

      {/* Edit Drawer */}
      <Drawer
        className="edit-column-drawer"
        extra={
          <Button icon={<span>×</span>} type="text" onClick={closeEditDrawer} />
        }
        footer={
          <Box className="drawer-footer">
            <Button onClick={closeEditDrawer}>{t('label.cancel')}</Button>
            <Button
              loading={isUpdating}
              type="primary"
              onClick={handleBulkUpdate}>
              {t('label.update')}
            </Button>
          </Box>
        }
        open={editDrawer.open}
        placement="right"
        title={`${t('label.edit-entity', { entity: t('label.column') })} ${
          selectedCount > 0 ? String(selectedCount).padStart(2, '0') : ''
        }`}
        width="33vw"
        onClose={closeEditDrawer}>
        {(() => {
          const selectedRows = columnGridListing.allRows.filter((r) =>
            columnGridListing.isSelected(r.id)
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
            <Box className="drawer-content">
              {/* Column Name */}
              <Box className="form-field">
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
              </Box>

              {/* Display Name */}
              <Box className="form-field">
                <label className="field-label">{t('label.display-name')}</label>
                <Input
                  placeholder={t('label.display-name')}
                  onChange={(e) => {
                    columnGridListing.selectedEntities.forEach(
                      (rowId: string) => {
                        updateRowField(rowId, 'displayName', e.target.value);
                      }
                    );
                  }}
                />
              </Box>

              {/* Description */}
              <Box className="form-field">
                <label className="field-label">{t('label.description')}</label>
                <RichTextEditor
                  initialValue=""
                  placeHolder={t('label.add-entity', {
                    entity: t('label.description'),
                  })}
                  ref={editorRef}
                  onTextChange={(value) => {
                    columnGridListing.selectedEntities.forEach(
                      (rowId: string) => {
                        updateRowField(rowId, 'description', value);
                      }
                    );
                  }}
                />
              </Box>

              {/* Tags */}
              <Box className="form-field">
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
                      columnGridListing.selectedEntities.forEach(
                        (rowId: string) => {
                          const row = columnGridListing.allRows.find(
                            (r: ColumnGridRowData) => r.id === rowId
                          );
                          if (row) {
                            const currentTags =
                              row.editedTags ?? row.tags ?? [];
                            const glossaryTerms = currentTags.filter(
                              (tag: TagLabel) =>
                                tag.source === TagSource.Glossary
                            );
                            updateRowField(rowId, 'tags', [
                              ...newTags,
                              ...glossaryTerms,
                            ]);
                          }
                        }
                      );
                    }}
                  />
                </Form>
              </Box>

              {/* Glossary Terms */}
              <Box className="form-field">
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
                      columnGridListing.selectedEntities.forEach(
                        (rowId: string) => {
                          const row = columnGridListing.allRows.find(
                            (r: ColumnGridRowData) => r.id === rowId
                          );
                          if (row) {
                            const currentTags =
                              row.editedTags ?? row.tags ?? [];
                            const classificationTags = currentTags.filter(
                              (tag: TagLabel) =>
                                tag.source !== TagSource.Glossary
                            );
                            updateRowField(rowId, 'tags', [
                              ...classificationTags,
                              ...newTerms,
                            ]);
                          }
                        }
                      );
                    }}
                  />
                </Form>
              </Box>
            </Box>
          );
        })()}
      </Drawer>
    </div>
  );
};

export default ColumnGrid;
