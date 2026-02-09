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

import { RightOutlined } from '@ant-design/icons';
import {
  Box,
  Button as MUIButton,
  Paper,
  Stack,
  Switch,
  TableContainer,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { ArrowRight, Tag01 as TagIcon } from '@untitledui/icons';
import { Button, Tag, Typography as AntTypography } from 'antd';
import { isEmpty, isUndefined, some } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as OccurrencesIcon } from '../../../assets/svg/ic_occurrences.svg';
import { ReactComponent as PendingChangesIcon } from '../../../assets/svg/ic_pending-changes.svg';
import { ReactComponent as UniqueColumnsIcon } from '../../../assets/svg/ic_unique-column.svg';
import AsyncSelectList from '../../../components/common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { useFormDrawerWithRef } from '../../../components/common/atoms/drawer';
import { useFilterSelection } from '../../../components/common/atoms/filters/useFilterSelection';
import { useSearch } from '../../../components/common/atoms/navigation/useSearch';
import {
  CellRenderer,
  ColumnConfig,
} from '../../../components/common/atoms/shared/types';
import { useDataTable } from '../../../components/common/atoms/table/useDataTable';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../components/common/RichTextEditor/RichTextEditor.interface';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  SOCKET_EVENTS,
} from '../../../constants/constants';
import { DRAWER_HEADER_STYLING } from '../../../constants/DomainsListPage.constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
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
  MetadataStatus,
} from '../../../generated/api/data/columnGridResponse';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { bulkUpdateColumnsAsync } from '../../../rest/columnAPI';
import { getTableFQNFromColumnFQN } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ColumnGridProps, ColumnGridRowData } from './ColumnGrid.interface';
import './ColumnGrid.less';
import { ColumnGridTableRow } from './components/ColumnGridTableRow';
import {
  RECENTLY_UPDATED_HIGHLIGHT_DURATION_MS,
  SCROLL_TO_ROW_MAX_RETRIES,
  SCROLL_TO_ROW_RETRY_DELAY_MS,
} from './constants/ColumnGrid.constants';
import { useColumnGridFilters } from './hooks/useColumnGridFilters';
import { useColumnGridListingData } from './hooks/useColumnGridListingData';
// Removed React Data Grid - using MUI Table instead

const { Text } = AntTypography;

const EDITED_ROW_KEYS: ReadonlyArray<
  'editedDisplayName' | 'editedDescription' | 'editedTags'
> = ['editedDisplayName', 'editedDescription', 'editedTags'];

const hasEditedValues = (r: ColumnGridRowData): boolean =>
  some(EDITED_ROW_KEYS, (key) => !isUndefined(r[key]));

const ColumnGrid: React.FC<ColumnGridProps> = ({
  filters: externalFilters,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { socket } = useWebSocketConnector();
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false);
  const [recentlyUpdatedRowIds, setRecentlyUpdatedRowIds] = useState<
    Set<string>
  >(new Set());
  const [pendingRefetchRowIds, setPendingRefetchRowIds] = useState<Set<string>>(
    new Set()
  );
  const editorRef = React.useRef<EditorContentRef>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const lastBulkUpdateCountRef = useRef<number>(0);
  const pendingHighlightRowIdsRef = useRef<Set<string>>(new Set());
  const closeDrawerRef = useRef<() => void>(() => {});
  const openDrawerRef = useRef<() => void>(() => {});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToRowIdRef = useRef<string | null>(null);
  const expandedRowsRef = useRef<Set<string>>(new Set());
  const expandedStructRowsRef = useRef<Set<string>>(new Set());
  const handleGroupSelectRef = useRef<
    (groupId: string, checked: boolean) => void
  >(() => {});
  const handleSelectRef = useRef<(id: string, checked: boolean) => void>(
    () => {}
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

  // Calculate metadata coverage - checks for description AND tags
  // "Full Coverage" = has both description AND tags
  // "Partial Coverage" = has either description OR tags
  // "Missing" = has neither description nor tags
  const calculateCoverage = (
    item: ColumnGridItem
  ): { covered: number; total: number; hasAnyMetadata: boolean } => {
    let covered = 0;
    let total = 0;
    let hasAnyMetadata = false;

    for (const group of item.groups) {
      const groupCount = group.occurrences.length;
      total += groupCount;
      const hasDescription = !!(group.description && group.description.trim());
      const hasTags = !!(group.tags && group.tags.length > 0);

      // Track if any group has metadata
      if (hasDescription || hasTags) {
        hasAnyMetadata = true;
      }

      // "Covered" means has BOTH description AND tags
      if (hasDescription && hasTags) {
        covered += groupCount;
      }
    }

    return { covered, total, hasAnyMetadata };
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

        const allOccurrences: ColumnOccurrenceRef[] = [];
        item.groups.forEach((g) => allOccurrences.push(...g.occurrences));
        const pathInfo = getUniquePaths(allOccurrences);

        if (item.hasVariations && item.groups.length > 1) {
          const isExpanded = expandedRows.has(item.columnName);
          const aggregatedTags = aggregateTags(item);
          const parentRow: ColumnGridRowData = {
            id: item.columnName,
            columnName: item.columnName,
            occurrenceCount: allOccurrences.length,
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
            hasAnyMetadata: coverage.hasAnyMetadata,
            metadataStatus: item.metadataStatus,
          };
          rows.push(parentRow);

          if (isExpanded) {
            for (const group of item.groups) {
              const hasStructChildren =
                group.children && group.children.length > 0;
              for (const occurrence of group.occurrences) {
                const occPath = buildPath(occurrence);
                const childRowId = `${item.columnName}-${occurrence.columnFQN}`;
                const isStructExpanded = expandedStructRows.has(childRowId);
                const childRow: ColumnGridRowData = {
                  id: childRowId,
                  columnName: item.columnName,
                  displayName: group.displayName,
                  description: group.description,
                  dataType: group.dataType,
                  tags: group.tags,
                  occurrenceCount: 1,
                  hasVariations: false,
                  groupId: group.groupId,
                  isGroup: false,
                  parentId: item.columnName,
                  group,
                  path: occPath,
                  additionalPathsCount: 0,
                  occurrence,
                  occurrenceRef: {
                    columnFQN: occurrence.columnFQN,
                    entityType: occurrence.entityType,
                    entityFQN: occurrence.entityFQN,
                  },
                  children: group.children,
                  isExpanded: isStructExpanded,
                };
                rows.push(childRow);

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
            occurrenceCount: allOccurrences.length,
            hasVariations: false,
            isExpanded,
            isGroup: true,
            gridItem: item,
            path: pathInfo.primary,
            additionalPathsCount: pathInfo.additionalCount,
            coverageCount: coverage.covered,
            totalCount: coverage.total,
            hasCoverage: true,
            hasAnyMetadata: coverage.hasAnyMetadata,
            metadataStatus: item.metadataStatus,
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
                occurrence,
                occurrenceRef: {
                  columnFQN: occurrence.columnFQN,
                  entityType: occurrence.entityType,
                  entityFQN: occurrence.entityFQN,
                },
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
            occurrenceCount: allOccurrences.length,
            hasVariations: false,
            isGroup: false,
            gridItem: item,
            group,
            path: pathInfo.primary,
            additionalPathsCount: pathInfo.additionalCount,
            occurrence: allOccurrences[0],
            coverageCount: coverage.covered,
            totalCount: coverage.total,
            hasCoverage: true,
            hasAnyMetadata: coverage.hasAnyMetadata,
            metadataStatus: item.metadataStatus,
            children: group?.children,
            isExpanded: isStructExpanded,
          };
          rows.push(row);

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
      { key: 'path', labelKey: 'label.asset', render: 'custom' },
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
    let occurrence: ColumnOccurrenceRef | null = null;

    if (row.occurrence) {
      occurrence = row.occurrence;
    } else if (row.occurrenceRef) {
      occurrence = {
        columnFQN: row.occurrenceRef.columnFQN,
        entityType: row.occurrenceRef.entityType,
        entityFQN: row.occurrenceRef.entityFQN,
      } as ColumnOccurrenceRef;
    } else if (row.group?.occurrences && row.group.occurrences.length > 0) {
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
  const getEntityLink = useCallback(
    (
      occurrence: ColumnOccurrenceRef
    ): { name: string; link: string } | null => {
      const entityTypeLower = occurrence.entityType.toLowerCase();
      let entityType: EntityType;

      switch (entityTypeLower) {
        case 'dashboarddatamodel':
          entityType = EntityType.DASHBOARD_DATA_MODEL;

          break;
        case 'table':
          entityType = EntityType.TABLE;

          break;
        case 'topic':
          entityType = EntityType.TOPIC;

          break;
        case 'container':
          entityType = EntityType.CONTAINER;

          break;
        case 'searchindex':
          entityType = EntityType.SEARCH_INDEX;

          break;
        default:
          entityType = entityTypeLower as EntityType;
      }

      const name =
        occurrence.entityDisplayName ||
        occurrence.entityFQN.split('.').pop() ||
        occurrence.entityFQN;
      const link = getEntityDetailsPath(entityType, occurrence.entityFQN);

      return { name, link };
    },
    []
  );

  const renderPathCellAdapter = useCallback(
    (entity: ColumnGridRowData) => {
      if (entity.isGroup) {
        return <Text type="secondary">--</Text>;
      }

      if (!entity.occurrence) {
        return <Text type="secondary">-</Text>;
      }

      const entityInfo = getEntityLink(entity.occurrence);
      if (!entityInfo) {
        return <Text type="secondary">-</Text>;
      }

      return (
        <Link className="column-link" to={entityInfo.link}>
          {entityInfo.name}
        </Link>
      );
    },
    [getEntityLink]
  );

  const renderDescriptionCellAdapter = useCallback(
    (entity: ColumnGridRowData) => {
      const description = entity.editedDescription ?? entity.description ?? '';
      const hasEdit = entity.editedDescription !== undefined;

      // Show metadata status for parent rows (using API-provided status)
      if (entity.hasCoverage && entity.metadataStatus) {
        const statusLabels: Record<MetadataStatus, string> = {
          [MetadataStatus.Missing]: t('label.missing'),
          [MetadataStatus.Incomplete]: t('label.incomplete'),
          [MetadataStatus.Inconsistent]: t('label.inconsistent'),
          [MetadataStatus.Complete]: t('label.complete'),
        };

        const statusClasses: Record<MetadataStatus, string> = {
          [MetadataStatus.Missing]: 'coverage-missing',
          [MetadataStatus.Incomplete]: 'coverage-partial',
          [MetadataStatus.Inconsistent]: 'coverage-inconsistent',
          [MetadataStatus.Complete]: 'coverage-full',
        };

        const statusText = statusLabels[entity.metadataStatus];
        const statusClass = statusClasses[entity.metadataStatus];

        // Show occurrence count for context
        const countText =
          entity.coverageCount !== undefined && entity.totalCount !== undefined
            ? ` (${entity.coverageCount}/${entity.totalCount})`
            : '';

        return (
          <Text className={statusClass}>
            {statusText}
            {countText}
          </Text>
        );
      }

      // Show actual description for child rows or single occurrences
      // Strip HTML tags for display - React's JSX escaping handles XSS prevention
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
      if (entity.isGroup && entity.occurrenceCount > 1) {
        const expandButton = (
          <Button
            className="expand-button column-grid-expand-icon"
            icon={
              <span
                className={`expand-icon-chevron ${
                  entity.isExpanded ? 'expand-icon-expanded' : ''
                }`}>
                <RightOutlined />
              </span>
            }
            size="small"
            type="text"
            onClick={(e) => {
              e.stopPropagation();
              const isExpanded = columnGridListing.expandedRows.has(entity.id);
              if (isExpanded) {
                scrollToRowIdRef.current = entity.id;
                columnGridListing.setExpandedRows((prev: Set<string>) => {
                  const newSet = new Set(prev);
                  newSet.delete(entity.id);

                  return newSet;
                });
              } else {
                columnGridListing.setExpandedRows((prev: Set<string>) => {
                  const newSet = new Set(prev);
                  newSet.add(entity.id);

                  return newSet;
                });
              }
            }}
          />
        );

        const nameWithCount = `${entity.columnName} (${entity.occurrenceCount})`;

        const handleColumnLinkClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          handleGroupSelectRef.current(entity.id, true);
          openDrawerRef.current();
        };

        return (
          <Box className="column-name-cell">
            {expandButton}
            <Text
              strong
              className="column-link"
              onClick={handleColumnLinkClick}>
              {nameWithCount}
            </Text>
          </Box>
        );
      }

      // STRUCT child row
      if (entity.isStructChild) {
        const nestingPadding = (entity.nestingLevel || 1) * 24;
        const hasChildren = entity.children && entity.children.length > 0;

        return (
          <Box
            className="column-name-cell struct-child-row"
            sx={{ paddingLeft: `${nestingPadding}px` }}>
            {hasChildren && (
              <Button
                className="expand-button column-grid-expand-icon"
                icon={
                  <span
                    className={`expand-icon-chevron ${
                      entity.isExpanded ? 'expand-icon-expanded' : ''
                    }`}>
                    <RightOutlined />
                  </span>
                }
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  const isExpanded = columnGridListing.expandedStructRows.has(
                    entity.id
                  );
                  if (isExpanded) {
                    scrollToRowIdRef.current = entity.id;
                    columnGridListing.setExpandedStructRows(
                      (prev: Set<string>) => {
                        const newSet = new Set(prev);
                        newSet.delete(entity.id);

                        return newSet;
                      }
                    );
                  } else {
                    columnGridListing.setExpandedStructRows(
                      (prev: Set<string>) => {
                        const newSet = new Set(prev);
                        newSet.add(entity.id);

                        return newSet;
                      }
                    );
                  }
                }}
              />
            )}
            <Text type="secondary">{entity.columnName}</Text>
          </Box>
        );
      }

      // Child row or single occurrence
      const indent = entity.parentId ? 'child-row' : '';
      const hasStructChildren = entity.children && entity.children.length > 0;

      const handleSingleColumnClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleSelectRef.current(entity.id, true);
        openDrawerRef.current();
      };

      return (
        <Box className="column-name-cell">
          <span className={`column-name-inner ${indent}`}>
            {hasStructChildren && (
              <Button
                className="expand-button column-grid-expand-icon"
                icon={
                  <span
                    className={`expand-icon-chevron ${
                      entity.isExpanded ? 'expand-icon-expanded' : ''
                    }`}>
                    <RightOutlined />
                  </span>
                }
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  const isExpanded = columnGridListing.expandedStructRows.has(
                    entity.id
                  );
                  if (isExpanded) {
                    scrollToRowIdRef.current = entity.id;
                    columnGridListing.setExpandedStructRows(
                      (prev: Set<string>) => {
                        const newSet = new Set(prev);
                        newSet.delete(entity.id);

                        return newSet;
                      }
                    );
                  } else {
                    columnGridListing.setExpandedStructRows(
                      (prev: Set<string>) => {
                        const newSet = new Set(prev);
                        newSet.add(entity.id);

                        return newSet;
                      }
                    );
                  }
                }}
              />
            )}
            <Text className="column-link" onClick={handleSingleColumnClick}>
              {entity.columnName}
            </Text>
          </span>
        </Box>
      );
    },
    [
      columnGridListing.expandedRows,
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

  const discardPendingEdits = useCallback(() => {
    const selectedIds = new Set(columnGridListing.selectedEntities);
    columnGridListing.setAllRows((prev: ColumnGridRowData[]) =>
      prev.map((r: ColumnGridRowData) => {
        if (selectedIds.has(r.id)) {
          return {
            ...r,
            editedDisplayName: undefined,
            editedDescription: undefined,
            editedTags: undefined,
          };
        }

        return r;
      })
    );
  }, [columnGridListing]);

  const handleBulkUpdate = useCallback(async () => {
    const selectedRowsData = columnGridListing.allRows.filter(
      (r: ColumnGridRowData) => columnGridListing.isSelected(r.id)
    );

    const updatesCount = selectedRowsData.filter(hasEditedValues).length;

    if (updatesCount === 0) {
      showErrorToast(t('message.no-changes-to-save'));

      return;
    }

    setIsUpdating(true);

    try {
      const columnUpdates: ColumnUpdate[] = [];

      for (const row of selectedRowsData) {
        if (!hasEditedValues(row)) {
          continue;
        }

        const allOccurrences: { columnFQN: string; entityType: string }[] = [];

        if (row.occurrence) {
          allOccurrences.push({
            columnFQN: row.occurrence.columnFQN,
            entityType: row.occurrence.entityType,
          });
        } else if (row.occurrenceRef) {
          allOccurrences.push({
            columnFQN: row.occurrenceRef.columnFQN,
            entityType: row.occurrenceRef.entityType,
          });
        } else if (row.group?.occurrences && row.group.occurrences.length > 0) {
          allOccurrences.push(...row.group.occurrences);
        } else if (row.gridItem && row.gridItem.groups.length > 0) {
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

      const response = await bulkUpdateColumnsAsync(request);

      // Store the jobId to listen for WebSocket notification when job completes
      activeJobIdRef.current = response.jobId;

      const updatedRowIds = new Set(
        selectedRowsData.map((r: ColumnGridRowData) => r.id)
      );
      setPendingRefetchRowIds(updatedRowIds);
      pendingHighlightRowIdsRef.current = updatedRowIds;
      lastBulkUpdateCountRef.current = cleanedUpdates.length;

      setIsUpdating(false);
      closeDrawerRef.current();
      columnGridListing.clearSelection();

      // Clear edited state in both allRows and the editedValuesRef
      // The page will automatically refresh when the WebSocket notification arrives
      columnGridListing.setAllRows((prev: ColumnGridRowData[]) =>
        prev.map((r: ColumnGridRowData) => ({
          ...r,
          editedDisplayName: undefined,
          editedDescription: undefined,
          editedTags: undefined,
        }))
      );
      columnGridListing.clearEditedValues();
    } catch (error) {
      showErrorToast(t('server.entity-updating-error'));
      setIsUpdating(false);
    }
  }, [
    columnGridListing.allRows,
    columnGridListing.selectedEntities,
    columnGridListing.clearEditedValues,
    columnGridListing.setAllRows,
    columnGridListing.clearSelection,
    t,
  ]);

  const handleBulkAssetsNotification = useCallback(
    async (message: string) => {
      let data: { jobId?: string; status?: string };
      try {
        data = JSON.parse(message) as { jobId?: string; status?: string };
      } catch {
        return;
      }

      if (!data.jobId || data.jobId !== activeJobIdRef.current) {
        return;
      }

      const clearJobState = () => {
        setPendingRefetchRowIds(new Set());
        activeJobIdRef.current = null;
        setIsUpdating(false);
      };

      if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const preservedExpandedRows = new Set(expandedRowsRef.current);
        const preservedExpandedStructRows = new Set(
          expandedStructRowsRef.current
        );

        try {
          await columnGridListing.refetch();
          setPendingRefetchRowIds(new Set());
          setRecentlyUpdatedRowIds(new Set(pendingHighlightRowIdsRef.current));
          clearJobState();
          const count = lastBulkUpdateCountRef.current;
          if (count > 0) {
            showSuccessToast(
              t('server.bulk-update-initiated', {
                entity: t('label.column-plural'),
                count,
              })
            );
          }

          columnGridListing.setExpandedRows(preservedExpandedRows);
          columnGridListing.setExpandedStructRows(preservedExpandedStructRows);

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollTop;
              }
            });
          });
        } catch {
          showErrorToast(t('server.entity-updating-error'));
          clearJobState();
        }
      } else if (data.status === 'FAILED' || data.status === 'FAILURE') {
        showErrorToast(t('server.entity-updating-error'));
        clearJobState();
        pendingHighlightRowIdsRef.current = new Set();
      }
    },
    [
      columnGridListing.refetch,
      columnGridListing.setExpandedRows,
      columnGridListing.setExpandedStructRows,
      t,
    ]
  );

  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.on(SOCKET_EVENTS.BULK_ASSETS_CHANNEL, handleBulkAssetsNotification);

    return () => {
      socket.off(
        SOCKET_EVENTS.BULK_ASSETS_CHANNEL,
        handleBulkAssetsNotification
      );
    };
  }, [socket, handleBulkAssetsNotification]);

  useEffect(() => {
    expandedRowsRef.current = columnGridListing.expandedRows;
    expandedStructRowsRef.current = columnGridListing.expandedStructRows;
  }, [columnGridListing.expandedRows, columnGridListing.expandedStructRows]);

  useEffect(() => {
    const rowId = scrollToRowIdRef.current;
    if (!rowId || !scrollContainerRef.current) {
      return;
    }
    scrollToRowIdRef.current = null;
    const selector = `[data-row-id="${CSS.escape(rowId)}"]`;

    const tryScroll = (attempt = 0) => {
      requestAnimationFrame(() => {
        const row = scrollContainerRef.current?.querySelector(selector);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (attempt < SCROLL_TO_ROW_MAX_RETRIES) {
          setTimeout(
            () => tryScroll(attempt + 1),
            SCROLL_TO_ROW_RETRY_DELAY_MS
          );
        }
      });
    };
    tryScroll();
  }, [columnGridListing.expandedRows, columnGridListing.expandedStructRows]);

  // Clear highlighted rows after 1s and collapse their expanded state
  useEffect(() => {
    if (recentlyUpdatedRowIds.size === 0) {
      return;
    }
    const idsToCollapse = new Set(recentlyUpdatedRowIds);
    const timer = setTimeout(() => {
      setRecentlyUpdatedRowIds(new Set());
      setIsUpdating(false);

      columnGridListing.setExpandedRows((prev: Set<string>) => {
        const next = new Set(prev);

        idsToCollapse.forEach((id) => next.delete(id));

        return next;
      });
    }, RECENTLY_UPDATED_HIGHLIGHT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [recentlyUpdatedRowIds, columnGridListing.setExpandedRows]);

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

  // Helper function to compute child row IDs from gridItem data (before expansion)
  const computeChildRowIdsFromGridItem = useCallback(
    (groupId: string): string[] => {
      const parentRow = columnGridListing.allRows.find(
        (row) => row.id === groupId
      );
      if (!parentRow?.gridItem) {
        return [];
      }

      const gridItem = parentRow.gridItem;

      if (gridItem.hasVariations && gridItem.groups.length > 1) {
        return gridItem.groups.flatMap((group) =>
          group.occurrences.map(
            (occ) => `${gridItem.columnName}-${occ.columnFQN}`
          )
        );
      } else if (gridItem.totalOccurrences > 1 && gridItem.groups[0]) {
        return gridItem.groups[0].occurrences.map(
          (occ) => `${gridItem.columnName}-${occ.columnFQN}`
        );
      }

      return [];
    },
    [columnGridListing.allRows]
  );

  // Handle group checkbox selection - expands the group and selects all children
  const handleGroupSelect = useCallback(
    (groupId: string, checked: boolean) => {
      const computedChildIds = computeChildRowIdsFromGridItem(groupId);

      if (checked) {
        columnGridListing.setExpandedRows((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.add(groupId);

          return newSet;
        });
        columnGridListing.handleSelect(groupId, true);
        computedChildIds.forEach((childId) => {
          columnGridListing.handleSelect(childId, true);
        });
      } else {
        columnGridListing.handleSelect(groupId, false);
        computedChildIds.forEach((childId) => {
          columnGridListing.handleSelect(childId, false);
        });
      }
    },
    [columnGridListing, computeChildRowIdsFromGridItem]
  );

  handleGroupSelectRef.current = handleGroupSelect;
  handleSelectRef.current = columnGridListing.handleSelect;

  // Calculate indeterminate state for group rows
  const getGroupIndeterminateState = useCallback(
    (groupId: string): boolean => {
      const childIds = computeChildRowIdsFromGridItem(groupId);
      if (childIds.length === 0) {
        return false;
      }

      const selectedChildCount = childIds.filter((childId) =>
        columnGridListing.isSelected(childId)
      ).length;

      return selectedChildCount > 0 && selectedChildCount < childIds.length;
    },
    [computeChildRowIdsFromGridItem, columnGridListing.isSelected]
  );

  // Handle child row selection - updates parent group state accordingly
  const handleChildSelect = useCallback(
    (childId: string, checked: boolean, parentId: string | undefined) => {
      columnGridListing.handleSelect(childId, checked);

      if (!parentId) {
        return;
      }

      const siblingIds = computeChildRowIdsFromGridItem(parentId);

      if (checked) {
        const allSiblingsSelected = siblingIds.every(
          (id) => id === childId || columnGridListing.isSelected(id)
        );
        if (allSiblingsSelected) {
          columnGridListing.handleSelect(parentId, true);
        }
      } else {
        const anySelectedAfter = siblingIds.some(
          (id) => id !== childId && columnGridListing.isSelected(id)
        );
        if (!anySelectedAfter) {
          columnGridListing.handleSelect(parentId, false);
        }
      }
    },
    [columnGridListing, computeChildRowIdsFromGridItem]
  );

  // Set up data table with custom row component
  const CustomTableRow = useCallback(
    (props: Record<string, unknown>) => {
      const { entity, isSelected, onSelect } = props as {
        entity: ColumnGridRowData;
        isSelected: boolean;
        onSelect: (id: string, checked: boolean) => void;
      };

      const isIndeterminate =
        entity.isGroup && entity.occurrenceCount > 1
          ? getGroupIndeterminateState(entity.id)
          : false;

      const isChildRow = Boolean(entity.parentId || entity.isStructChild);
      const isParentExpanded =
        columnGridListing.expandedRows.has(entity.id) ||
        columnGridListing.expandedStructRows.has(entity.id);
      const showParentChildColors = isChildRow || isParentExpanded;

      const wrappedOnSelect = (id: string, checked: boolean) => {
        if (entity.parentId) {
          handleChildSelect(id, checked, entity.parentId);
        } else {
          onSelect(id, checked);
        }
      };

      return (
        <ColumnGridTableRow
          entity={entity}
          isIndeterminate={isIndeterminate}
          isPendingRefetch={pendingRefetchRowIds.has(entity.id)}
          isRecentlyUpdated={recentlyUpdatedRowIds.has(entity.id)}
          isSelected={isSelected}
          renderColumnNameCell={renderColumnNameCellFinal}
          renderDescriptionCell={renderDescriptionCellAdapter}
          renderGlossaryTermsCell={renderGlossaryTermsCellAdapter}
          renderPathCell={renderPathCellAdapter}
          renderTagsCell={renderTagsCellAdapter}
          showParentChildColors={showParentChildColors}
          onGroupSelect={handleGroupSelect}
          onSelect={wrappedOnSelect}
        />
      );
    },
    [
      columnGridListing.expandedRows,
      columnGridListing.expandedStructRows,
      pendingRefetchRowIds,
      recentlyUpdatedRowIds,
      renderColumnNameCellFinal,
      renderPathCellAdapter,
      renderDescriptionCellAdapter,
      renderTagsCellAdapter,
      renderGlossaryTermsCellAdapter,
      handleGroupSelect,
      handleChildSelect,
      getGroupIndeterminateState,
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
      loading: columnGridListing.loading,
    },
    enableSelection: true,
    entityLabelKey: 'label.column',
    customTableRow: CustomTableRow,
  });

  const paginationData = useMemo(
    () => ({
      paging: { total: columnGridListing.totalEntities },
      pagingHandler: ({ currentPage }: { currentPage: number }) =>
        columnGridListing.handlePageChange(currentPage),
      pageSize: columnGridListing.pageSize,
      currentPage: columnGridListing.currentPage,
      isNumberBased: true,
      isLoading: columnGridListing.loading,
      pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
      onShowSizeChange: columnGridListing.handlePageSizeChange,
    }),
    [
      columnGridListing.totalEntities,
      columnGridListing.handlePageChange,
      columnGridListing.pageSize,
      columnGridListing.currentPage,
      columnGridListing.loading,
      columnGridListing.handlePageSizeChange,
    ]
  );

  const editedCount = useMemo(() => {
    return columnGridListing.allRows.filter(hasEditedValues).length;
  }, [columnGridListing.allRows]);

  const selectedCount = columnGridListing.selectedEntities.length;
  const hasSelection = selectedCount > 0;

  const getTagDisplayLabel = useCallback((tag: TagLabel): string => {
    if (tag.displayName) {
      return tag.displayName;
    }
    if (tag.name) {
      return tag.name;
    }
    const fqn = tag.tagFQN || '';
    const parts = fqn.split('.');

    return parts[parts.length - 1] || fqn;
  }, []);

  const drawerContent = useMemo(() => {
    const selectedRows = columnGridListing.allRows.filter((r) =>
      columnGridListing.isSelected(r.id)
    );
    const firstRow = selectedRows[0];
    if (!firstRow && selectedCount === 0) {
      return (
        <Text type="secondary">{t('message.select-columns-to-edit')}</Text>
      );
    }

    const currentDisplayName =
      selectedCount === 1
        ? firstRow?.editedDisplayName ?? firstRow?.displayName ?? ''
        : '';
    const currentDescription =
      selectedCount === 1
        ? firstRow?.editedDescription ?? firstRow?.description ?? ''
        : '';

    const currentTags =
      selectedCount === 1 ? firstRow?.editedTags ?? firstRow?.tags ?? [] : [];

    const classificationTagOptions: SelectOption[] = currentTags
      .filter((tag: TagLabel) => tag.source !== TagSource.Glossary)
      .map((tag: TagLabel) => {
        const displayLabel = getTagDisplayLabel(tag);

        return {
          label: displayLabel,
          value: tag.tagFQN ?? '',
          data: {
            ...tag,
            displayName: tag.displayName || displayLabel,
            name: tag.name || displayLabel,
          },
        };
      });

    const glossaryTermOptions: SelectOption[] = currentTags
      .filter((tag: TagLabel) => tag.source === TagSource.Glossary)
      .map((tag: TagLabel) => {
        const displayLabel = getTagDisplayLabel(tag);

        return {
          label: displayLabel,
          value: tag.tagFQN ?? '',
          data: {
            ...tag,
            displayName: tag.displayName || displayLabel,
            name: tag.name || displayLabel,
          },
        };
      });

    const drawerKey = `${columnGridListing.selectedEntities.join('-')}`;

    return (
      <Box
        data-testid="drawer-content"
        key={drawerKey}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography color="text.secondary" fontSize="14px" fontWeight={500}>
            {t('label.column-name')}
          </Typography>
          <TextField
            disabled
            fullWidth
            data-testid="column-name-input"
            size="small"
            value={
              selectedCount === 1
                ? firstRow?.columnName
                : `${selectedCount} ${t('label.column-lowercase-plural')} ${t(
                    'label.selected-lowercase'
                  )}`
            }
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography color="text.secondary" fontSize="14px" fontWeight={500}>
            {t('label.display-name')}
          </Typography>
          <TextField
            fullWidth
            data-testid="display-name-input"
            defaultValue={currentDisplayName}
            key={`displayName-${drawerKey}`}
            placeholder={t('label.display-name')}
            size="small"
            onChange={(e) => {
              columnGridListing.selectedEntities.forEach((rowId: string) => {
                updateRowField(rowId, 'displayName', e.target.value);
              });
            }}
          />
        </Box>

        <Box
          data-testid="description-field"
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography color="text.secondary" fontSize="14px" fontWeight={500}>
            {t('label.description')}
          </Typography>
          <RichTextEditor
            initialValue={currentDescription}
            key={`description-${drawerKey}`}
            placeHolder={t('label.add-entity', {
              entity: t('label.description'),
            })}
            ref={editorRef}
            onTextChange={(value) => {
              columnGridListing.selectedEntities.forEach((rowId: string) => {
                updateRowField(rowId, 'description', value);
              });
            }}
          />
        </Box>

        <Box
          data-testid="tags-field"
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography color="text.secondary" fontSize="14px" fontWeight={500}>
            {t('label.tag-plural')}
          </Typography>
          <AsyncSelectList
            autoFocus={false}
            fetchOptions={tagClassBase.getTags}
            initialOptions={classificationTagOptions}
            key={`tags-${drawerKey}`}
            mode="multiple"
            placeholder={t('label.select-tags')}
            onChange={(selectedTags) => {
              const options = (
                Array.isArray(selectedTags) ? selectedTags : [selectedTags]
              ) as SelectOption[];
              const newTags: TagLabel[] = options
                .filter((option: SelectOption) => option.data)
                .map((option: SelectOption) => {
                  const tagData = option.data as {
                    fullyQualifiedName?: string;
                    name?: string;
                    displayName?: string;
                    description?: string;
                  };

                  return {
                    tagFQN: tagData.fullyQualifiedName ?? option.value,
                    source: TagSource.Classification,
                    labelType: LabelType.Manual,
                    state: State.Confirmed,
                    name: tagData.name,
                    displayName: tagData.displayName,
                    description: tagData.description,
                  };
                });
              columnGridListing.selectedEntities.forEach((rowId: string) => {
                const row = columnGridListing.allRows.find(
                  (r: ColumnGridRowData) => r.id === rowId
                );
                if (row) {
                  const existingTags = row.editedTags ?? row.tags ?? [];
                  const glossaryTerms = existingTags.filter(
                    (tag: TagLabel) => tag.source === TagSource.Glossary
                  );
                  updateRowField(rowId, 'tags', [...newTags, ...glossaryTerms]);
                }
              });
            }}
          />
        </Box>

        <Box
          data-testid="glossary-terms-field"
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography color="text.secondary" fontSize="14px" fontWeight={500}>
            {t('label.glossary-term-plural')}
          </Typography>
          <TreeAsyncSelectList
            hasNoActionButtons
            initialOptions={glossaryTermOptions}
            key={`glossaryTerms-${drawerKey}`}
            open={false}
            placeholder={t('label.select-tags')}
            onChange={(selectedTerms) => {
              const options = (
                Array.isArray(selectedTerms) ? selectedTerms : [selectedTerms]
              ) as SelectOption[];
              const newTerms: TagLabel[] = options
                .filter((option: SelectOption) => option.data)
                .map((option: SelectOption) => {
                  const termData = option.data as {
                    fullyQualifiedName?: string;
                    name?: string;
                    displayName?: string;
                    description?: string;
                  };

                  return {
                    tagFQN: termData.fullyQualifiedName ?? option.value,
                    source: TagSource.Glossary,
                    labelType: LabelType.Manual,
                    state: State.Confirmed,
                    name: termData.name,
                    displayName: termData.displayName,
                    description: termData.description,
                  };
                });
              columnGridListing.selectedEntities.forEach((rowId: string) => {
                const row = columnGridListing.allRows.find(
                  (r: ColumnGridRowData) => r.id === rowId
                );
                if (row) {
                  const existingTags = row.editedTags ?? row.tags ?? [];
                  const classificationTags = existingTags.filter(
                    (tag: TagLabel) => tag.source !== TagSource.Glossary
                  );
                  updateRowField(rowId, 'tags', [
                    ...classificationTags,
                    ...newTerms,
                  ]);
                }
              });
            }}
          />
        </Box>
      </Box>
    );
  }, [
    columnGridListing.allRows,
    columnGridListing.selectedEntities,
    columnGridListing.isSelected,
    selectedCount,
    t,
    getTagDisplayLabel,
    updateRowField,
  ]);

  const drawerHeaderAssetLink = useMemo(() => {
    if (selectedCount === 0) {
      return null;
    }
    const selectedRows = columnGridListing.allRows.filter((r) =>
      columnGridListing.isSelected(r.id)
    );
    const firstRow = selectedRows[0];

    return firstRow ? getColumnLink(firstRow) : null;
  }, [
    selectedCount,
    columnGridListing.allRows,
    columnGridListing.isSelected,
    getColumnLink,
  ]);

  const viewAssetHeaderAction = useMemo(() => {
    if (!drawerHeaderAssetLink) {
      return null;
    }

    return (
      <MUIButton
        component={Link}
        data-testid="view-asset-button"
        endIcon={<ArrowRight size={12} />}
        size="small"
        sx={{
          borderRadius: '4px',
          padding: '2px 6px',
          backgroundColor: theme.palette.allShades?.brand?.[50],
          color: theme.palette.allShades?.brand?.[600],
          fontSize: 12,
          fontWeight: 500,
          lineHeight: '20px',
          '&:hover': {
            backgroundColor: theme.palette.allShades?.brand?.[50],
            color: theme.palette.allShades?.brand?.[600],
          },
          '.MuiButton-endIcon > svg': {
            width: '14px',
            height: '14px',
          },
        }}
        to={drawerHeaderAssetLink}>
        {t('label.view-entity', { entity: t('label.asset') })}
      </MUIButton>
    );
  }, [drawerHeaderAssetLink, t, theme]);

  const drawerTitle = useMemo(
    () => (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}>
        <Typography data-testid="form-heading" variant="h6">
          {`${t('label.edit-entity', { entity: t('label.column') })} ${
            selectedCount > 0 ? String(selectedCount).padStart(2, '0') : ''
          }`}
        </Typography>
        {viewAssetHeaderAction}
      </Box>
    ),
    [t, selectedCount, viewAssetHeaderAction]
  );

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: drawerTitle,
    anchor: 'right',
    width: '40%',
    closeOnEscape: true,
    testId: 'column-bulk-operations-form-drawer',
    header: {
      sx: DRAWER_HEADER_STYLING,
    },
    onCancel: discardPendingEdits,
    form: drawerContent,
    onSubmit: handleBulkUpdate,
    submitLabel: t('label.update'),
    loading: isUpdating,
  });

  closeDrawerRef.current = closeDrawer;
  openDrawerRef.current = openDrawer;

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
        <Box className="table-scroll-container" ref={scrollContainerRef}>
          {dataTable}
        </Box>
        {columnGridListing.totalEntities > 0 && (
          <Box
            data-testid="pagination"
            sx={{
              display: 'flex',
              justifyContent: 'center',
              borderTop: `1px solid ${theme.palette.allShades?.gray?.[200]}`,
              pt: 3.5,
              px: 6,
              pb: 5,
            }}>
            <NextPrevious {...paginationData} />
          </Box>
        )}
      </>
    );
  }, [
    columnGridListing.loading,
    columnGridListing.totalEntities,
    filteredEntities,
    dataTable,
    paginationData,
    theme,
    t,
  ]);

  return (
    <div className="column-grid-container" data-testid="column-grid-container">
      {/* Summary Stats Cards - combined in single container */}
      <Box className="stats-row">
        <Paper className="stat-card-group" elevation={0}>
          <Box className="stat-cards-inner">
            <Box className="stat-card" data-testid="total-unique-columns-card">
              <UniqueColumnsIcon height={47} width={47} />
              <Box className="stat-content">
                <Typography
                  color={theme.palette.grey[900]}
                  data-testid="total-unique-columns-value"
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
            </Box>

            <Box
              aria-hidden
              className="stat-card-divider-wrapper"
              data-testid="stat-divider-1">
              <Box className="stat-card-divider" />
            </Box>

            <Box className="stat-card" data-testid="total-occurrences-card">
              <OccurrencesIcon height={47} width={47} />
              <Box className="stat-content">
                <Typography
                  color={theme.palette.grey[900]}
                  data-testid="total-occurrences-value"
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
            </Box>

            <Box
              aria-hidden
              className="stat-card-divider-wrapper"
              data-testid="stat-divider-2">
              <Box className="stat-card-divider" />
            </Box>

            <Box className="stat-card" data-testid="pending-changes-card">
              <PendingChangesIcon height={47} width={47} />
              <Box className="stat-content">
                <Typography
                  color={theme.palette.grey[900]}
                  data-testid="pending-changes-value"
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
            </Box>
          </Box>
        </Paper>
      </Box>

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
            {quickFilters}
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
                    data-testid="edit-button"
                    disabled={isUpdating}
                    startIcon={<EditIcon height={14} width={14} />}
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
                    onClick={openDrawer}>
                    {t('label.edit')}
                  </MUIButton>
                  <MUIButton
                    className="cancel-button"
                    data-testid="cancel-selection-button"
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
                  data-testid="edit-button-disabled"
                  startIcon={<EditIcon height={14} width={14} />}
                  sx={{ color: theme.palette.grey[500] }}
                  variant="text"
                  onClick={openDrawer}>
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
      {formDrawer}
    </div>
  );
};

export default ColumnGrid;
