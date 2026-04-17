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
  Badge,
  Button,
  ButtonUtility,
  Card,
  Input,
  Table,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ChevronRight,
  Tag01 as TagIcon,
  XClose,
} from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty, isUndefined, some } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../components/common/RichTextEditor/RichTextEditor.interface';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  SOCKET_EVENTS,
} from '../../../constants/constants';
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
import { BulkOperationResult } from '../../../generated/type/bulkOperationResult';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { bulkUpdateColumnsAsync } from '../../../rest/columnAPI';
import { formatContent } from '../../../utils/BlockEditorUtils';
import { getTableFQNFromColumnFQN } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getSanitizeContent } from '../../../utils/sanitize.utils';
import { stringToDOMElement } from '../../../utils/StringsUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ColumnGridProps, ColumnGridRowData } from './ColumnGrid.interface';
import { ColumnGridTableRow } from './components/ColumnGridTableRow';
import {
  RECENTLY_UPDATED_HIGHLIGHT_DURATION_MS,
  SCROLL_TO_ROW_MAX_RETRIES,
  SCROLL_TO_ROW_RETRY_DELAY_MS,
} from './constants/ColumnGrid.constants';
import { useColumnGridFilters } from './hooks/useColumnGridFilters';
import { useColumnGridListingData } from './hooks/useColumnGridListingData';

interface BulkAssetsSocketMessage {
  jobId?: string;
  status?: string;
  progress?: number;
  total?: number;
  result?: BulkOperationResult;
}

interface ColumnEditFormHandle {
  getDisplayName: () => string;
  getDescription: () => string | undefined;
}

interface ColumnEditFormProps {
  drawerKey: string;
  selectedCount: number;
  firstRow: ColumnGridRowData | undefined;
  selectedRowsData: ColumnGridRowData[];
  allRows: ColumnGridRowData[];
  editorRef: React.RefObject<EditorContentRef>;
  getTagDisplayLabel: (tag: TagLabel) => string;
  onDescriptionChange: (description: string, preview: string) => void;
  onDisplayNameSync: (value: string) => void;
  onTagsUpdate: (rowId: string, tags: TagLabel[]) => void;
}

const COLUMN_GRID_API_ENTITY_TYPE_MAP: Readonly<Record<string, EntityType>> = {
  dashboarddatamodel: EntityType.DASHBOARD_DATA_MODEL,
  table: EntityType.TABLE,
  topic: EntityType.TOPIC,
  container: EntityType.CONTAINER,
  searchindex: EntityType.SEARCH_INDEX,
};

const COLUMN_GRID_COLUMN_LINK_TAB_MAP: Readonly<Record<string, EntityTabs>> = {
  dashboarddatamodel: EntityTabs.MODEL,
  table: EntityTabs.SCHEMA,
  topic: EntityTabs.SCHEMA,
  container: EntityTabs.SCHEMA,
  searchindex: EntityTabs.FIELDS,
};

const resolveColumnGridEntityType = (entityTypeFromApi: string): EntityType => {
  const key = entityTypeFromApi.toLowerCase();

  return COLUMN_GRID_API_ENTITY_TYPE_MAP[key] ?? (key as EntityType);
};

const getColumnLinkTabForEntityType = (
  entityTypeFromApi: string
): EntityTabs => {
  const key = entityTypeFromApi.toLowerCase();

  return COLUMN_GRID_COLUMN_LINK_TAB_MAP[key] ?? EntityTabs.SCHEMA;
};

const EDITED_ROW_KEYS: ReadonlyArray<
  'editedDisplayName' | 'editedDescription' | 'editedTags'
> = ['editedDisplayName', 'editedDescription', 'editedTags'];

const EDIT_FIELD_TO_ROW_KEY: Record<
  'displayName' | 'description' | 'tags',
  'editedDisplayName' | 'editedDescription' | 'editedTags'
> = {
  displayName: 'editedDisplayName',
  description: 'editedDescription',
  tags: 'editedTags',
};

const TABLE_LAYOUT_CLASSES =
  'tw:table-fixed tw:w-full [&_th]:tw:overflow-hidden [&_td]:tw:overflow-hidden';

const COLUMN_WIDTH_PERCENT: Record<string, string> = {
  columnName: '22%',
  path: '16%',
  description: '16%',
  dataType: '12%',
  tags: '18%',
  glossaryTerms: '18%',
};

const EmptyCellContent = () => (
  <Typography as="span" className="tw:text-tertiary">
    --
  </Typography>
);

const COLUMN_GRID_TAG_BADGES_MAX_VISIBLE = 2;

const COLUMN_GRID_GLOSSARY_TERMS_BADGES_MAX_VISIBLE = 1;

const COLUMN_NAME_CELL_GRID =
  'tw:grid tw:w-full tw:min-w-0 tw:grid-cols-[2.25rem_minmax(0,1fr)] tw:items-center tw:gap-1 tw:overflow-hidden';

const COLUMN_NAME_CELL_CHEVRON =
  'tw:flex tw:min-w-0 tw:items-center tw:justify-center tw:overflow-hidden';

interface ColumnGridTruncatingTagBadgesProps {
  maxVisible?: number;
  renderBadge: (tag: TagLabel, index: number) => React.ReactNode;
  tags: TagLabel[];
}

const ColumnGridTruncatingTagBadges: React.FC<
  ColumnGridTruncatingTagBadgesProps
> = ({
  maxVisible = COLUMN_GRID_TAG_BADGES_MAX_VISIBLE,
  renderBadge,
  tags,
}) => {
  if (tags.length === 0) {
    return null;
  }

  const limit = Math.max(0, maxVisible);
  const visibleTags = tags.slice(0, limit);
  const remaining = tags.length - visibleTags.length;

  return (
    <div className="tw:flex tw:items-center tw:gap-1.5">
      {visibleTags.map((tag: TagLabel, index: number) => {
        const fullLabel = tag.name || tag.tagFQN.split('.').pop() || '';

        return (
          <div
            className="tw:min-w-0 tw:flex-1 tw:basis-0 tw:overflow-hidden"
            key={tag.tagFQN}
            title={fullLabel}>
            {renderBadge(tag, index)}
          </div>
        );
      })}
      {remaining > 0 && <Typography as="span">+{remaining}</Typography>}
    </div>
  );
};

const hasEditedValues = (r: ColumnGridRowData): boolean =>
  some(EDITED_ROW_KEYS, (key) => !isUndefined(r[key]));

const getDescriptionPreview = (description?: string): string => {
  if (!description) {
    return '';
  }

  return (
    stringToDOMElement(getSanitizeContent(formatContent(description, 'client')))
      .textContent ?? ''
  ).slice(0, 100);
};

interface ColumnOccurrenceTarget {
  columnFQN: string;
  entityType: string;
}

const getOccurrenceKey = (occurrence: ColumnOccurrenceTarget): string =>
  occurrence.columnFQN;

const extractRowOccurrences = (
  row: ColumnGridRowData
): ColumnOccurrenceTarget[] => {
  const occurrences: ColumnOccurrenceTarget[] = [];

  if (row.occurrence) {
    occurrences.push({
      columnFQN: row.occurrence.columnFQN,
      entityType: row.occurrence.entityType,
    });
  } else if (row.occurrenceRef) {
    occurrences.push({
      columnFQN: row.occurrenceRef.columnFQN,
      entityType: row.occurrenceRef.entityType,
    });
  } else if (row.group?.occurrences && row.group.occurrences.length > 0) {
    occurrences.push(...row.group.occurrences);
  } else if (row.gridItem && row.gridItem.groups.length > 0) {
    for (const group of row.gridItem.groups) {
      if (group.occurrences && group.occurrences.length > 0) {
        occurrences.push(...group.occurrences);
      }
    }
  }

  return occurrences;
};

const ColumnEditForm = forwardRef<ColumnEditFormHandle, ColumnEditFormProps>(
  (
    {
      drawerKey,
      selectedCount,
      firstRow,
      selectedRowsData,
      allRows,
      editorRef,
      getTagDisplayLabel,
      onDescriptionChange,
      onDisplayNameSync,
      onTagsUpdate,
    },
    ref
  ) => {
    const { t } = useTranslation();

    const initialDisplayName =
      firstRow?.editedDisplayName ?? firstRow?.displayName ?? '';
    const [localDisplayName, setLocalDisplayName] =
      useState(initialDisplayName);
    const hasDescriptionEditedRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        getDisplayName: () => localDisplayName,
        getDescription: () =>
          hasDescriptionEditedRef.current
            ? editorRef.current?.getEditorContent()
            : undefined,
      }),
      [editorRef, localDisplayName]
    );

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

    return (
      <div
        className="tw:flex tw:flex-col tw:gap-6"
        data-testid="drawer-content">
        <div className="tw:flex tw:flex-col tw:gap-1">
          <Typography
            as="label"
            className="tw:text-sm tw:font-semibold tw:text-secondary">
            {t('label.column-name')}
          </Typography>
          <Input
            isDisabled
            data-testid="column-name-input"
            size="sm"
            value={
              selectedCount === 1
                ? firstRow?.columnName
                : `${selectedCount} ${t('label.column-lowercase-plural')} ${t(
                    'label.selected-lowercase'
                  )}`
            }
          />
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1">
          <Typography
            as="label"
            className="tw:text-sm tw:font-semibold tw:text-secondary">
            {t('label.display-name')}
          </Typography>
          <Input
            data-testid="display-name-input"
            placeholder={t('label.display-name')}
            size="sm"
            value={localDisplayName}
            onChange={(value) => {
              setLocalDisplayName(value);
              onDisplayNameSync(value);
            }}
          />
        </div>

        <div
          className="tw:flex tw:flex-col tw:gap-1"
          data-testid="description-field">
          <Typography
            as="label"
            className="tw:text-sm tw:font-semibold tw:text-secondary">
            {t('label.description')}
          </Typography>
          <RichTextEditor
            initialValue={currentDescription}
            key={`description-${drawerKey}`}
            placeHolder={t('label.add-entity', {
              entity: t('label.description'),
            })}
            ref={editorRef}
            onTextChange={() => {
              hasDescriptionEditedRef.current = true;
              const content = editorRef.current?.getEditorContent() ?? '';
              onDescriptionChange(content, getDescriptionPreview(content));
            }}
          />
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1" data-testid="tags-field">
          <Typography
            as="label"
            className="tw:text-sm tw:font-semibold tw:text-secondary">
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
              selectedRowsData.forEach((selectedRow) => {
                const rowId = selectedRow.id;
                const foundRow = allRows.find(
                  (r: ColumnGridRowData) => r.id === rowId
                );
                if (foundRow) {
                  const existingTags =
                    foundRow.editedTags ?? foundRow.tags ?? [];
                  const glossaryTerms = existingTags.filter(
                    (tag: TagLabel) => tag.source === TagSource.Glossary
                  );
                  onTagsUpdate(rowId, [...newTags, ...glossaryTerms]);
                }
              });
            }}
          />
        </div>

        <div
          className="tw:flex tw:flex-col tw:gap-1"
          data-testid="glossary-terms-field">
          <Typography
            as="label"
            className="tw:text-sm tw:font-semibold tw:text-secondary">
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
              selectedRowsData.forEach((selectedRow) => {
                const rowId = selectedRow.id;
                const foundRow = allRows.find(
                  (r: ColumnGridRowData) => r.id === rowId
                );
                if (foundRow) {
                  const existingTags =
                    foundRow.editedTags ?? foundRow.tags ?? [];
                  const classificationTags = existingTags.filter(
                    (tag: TagLabel) => tag.source !== TagSource.Glossary
                  );
                  onTagsUpdate(rowId, [...classificationTags, ...newTerms]);
                }
              });
            }}
          />
        </div>
      </div>
    );
  }
);

ColumnEditForm.displayName = 'ColumnEditForm';

const ColumnGrid: React.FC<ColumnGridProps> = ({
  filters: externalFilters,
}) => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false);
  const [recentlyUpdatedRowIds, setRecentlyUpdatedRowIds] = useState<
    Set<string>
  >(new Set());
  const [pendingRefetchRowIds, setPendingRefetchRowIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const editorRef = React.useRef<EditorContentRef>(null);
  const columnEditFormRef = useRef<ColumnEditFormHandle | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const lastBulkUpdateCountRef = useRef<number>(0);
  const pendingHighlightRowIdsRef = useRef<Set<string>>(new Set());
  const closeDrawerRef = useRef<() => void>(() => {});
  const openDrawerRef = useRef<() => void>(() => {});
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

  const getMetadataStatusClassName = (status: MetadataStatus): string => {
    const map: Record<MetadataStatus, string> = {
      [MetadataStatus.Missing]: 'tw:text-gray-500 tw:font-medium',
      [MetadataStatus.Incomplete]: 'tw:text-yellow-600 tw:font-medium',
      [MetadataStatus.Inconsistent]: 'tw:text-red-600 tw:font-medium',
      [MetadataStatus.Complete]: 'tw:text-green-600 tw:font-medium',
    };

    return map[status] ?? map[MetadataStatus.Missing];
  };

  const getMetadataStatusLabel = (
    status: MetadataStatus,
    t: (key: string) => string
  ): string => {
    const keyMap: Record<MetadataStatus, string> = {
      [MetadataStatus.Missing]: 'label.missing',
      [MetadataStatus.Incomplete]: 'label.incomplete',
      [MetadataStatus.Inconsistent]: 'label.inconsistent',
      [MetadataStatus.Complete]: 'label.complete',
    };

    return t(keyMap[status] ?? keyMap[MetadataStatus.Missing]);
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
        descriptionPreview: getDescriptionPreview(child.description),
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
                  descriptionPreview: getDescriptionPreview(group.description),
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
            descriptionPreview: getDescriptionPreview(group?.description),
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
                descriptionPreview: getDescriptionPreview(group.description),
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
            descriptionPreview: getDescriptionPreview(group?.description),
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

    const entityType = resolveColumnGridEntityType(occurrence.entityType);
    const tab = getColumnLinkTabForEntityType(occurrence.entityType);

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
      const entityType = resolveColumnGridEntityType(occurrence.entityType);

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
        return <EmptyCellContent />;
      }

      if (!entity.occurrence) {
        return <EmptyCellContent />;
      }

      const entityInfo = getEntityLink(entity.occurrence);
      if (!entityInfo) {
        return <EmptyCellContent />;
      }

      return (
        <Button
          className="tw:block tw:min-w-0 tw:truncate"
          color="link-color"
          href={entityInfo.link}>
          {entityInfo.name}
        </Button>
      );
    },
    [getEntityLink]
  );

  const renderDescriptionCellAdapter = useCallback(
    (entity: ColumnGridRowData) => {
      const hasEdit = entity.editedDescription !== undefined;
      const displayValue = hasEdit
        ? entity.editedDescriptionPreview ?? ''
        : entity.descriptionPreview ?? '';

      if (entity.hasCoverage && entity.metadataStatus) {
        const countText =
          entity.coverageCount !== undefined && entity.totalCount !== undefined
            ? ` (${entity.coverageCount}/${entity.totalCount})`
            : '';

        return (
          <Typography
            as="span"
            className={classNames(
              getMetadataStatusClassName(entity.metadataStatus),
              'tw:w-fit'
            )}>
            {getMetadataStatusLabel(entity.metadataStatus, t)}
            {countText}
          </Typography>
        );
      }

      if (hasEdit) {
        return (
          <div className="tw:flex tw:min-w-0 tw:max-w-full">
            <Badge
              className="tw:shrink tw:truncate"
              color="warning"
              size="sm"
              type="color">
              {displayValue || '-'}
            </Badge>
          </div>
        );
      }

      return (
        <Typography
          as="span"
          className="tw:block tw:max-w-full tw:truncate tw:whitespace-nowrap tw:overflow-hidden tw:min-w-0">
          {displayValue || '-'}
        </Typography>
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
      return (
        <Typography as="span" className="tw:text-tertiary">
          -
        </Typography>
      );
    }

    return (
      <ColumnGridTruncatingTagBadges
        renderBadge={(tag: TagLabel, index: number) => (
          <Badge
            className="tw:inline-flex tw:min-w-0 tw:max-w-full tw:items-center tw:gap-1"
            color={index === 0 ? 'gray' : 'blue'}
            size="sm"
            type="color">
            {index === 0 ? <TagIcon className="tw:size-3 tw:shrink-0" /> : null}
            <div className="tw:min-w-0 tw:flex-1">
              <Typography as="span" className="tw:block tw:min-w-0 tw:truncate">
                {tag.name || tag.tagFQN.split('.').pop()}
              </Typography>
            </div>
          </Badge>
        )}
        tags={classificationTags}
      />
    );
  }, []);

  const renderGlossaryTermsCellAdapter = useCallback(
    (entity: ColumnGridRowData) => {
      const currentTags = entity.editedTags ?? entity.tags ?? [];
      const glossaryTerms = currentTags.filter(
        (tag: TagLabel) => tag.source === TagSource.Glossary
      );

      if (glossaryTerms.length === 0) {
        return (
          <Typography as="span" className="tw:text-tertiary">
            -
          </Typography>
        );
      }

      return (
        <ColumnGridTruncatingTagBadges
          maxVisible={COLUMN_GRID_GLOSSARY_TERMS_BADGES_MAX_VISIBLE}
          renderBadge={(tag: TagLabel) => {
            const labelText = tag.name || tag.tagFQN.split('.').pop() || '';

            return (
              <Badge
                className="tw:inline-flex tw:min-w-0 tw:max-w-full tw:items-center tw:gap-1"
                color="gray"
                size="sm"
                type="color">
                <div className="tw:min-w-0 tw:flex-1">
                  <Typography
                    as="span"
                    className="tw:block tw:min-w-0 tw:truncate">
                    {labelText}
                  </Typography>
                </div>
              </Badge>
            );
          }}
          tags={glossaryTerms}
        />
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
      const columnNameButtonClass = classNames(
        'tw:flex tw:flex-1 tw:min-w-0 tw:items-center tw:justify-start tw:overflow-hidden tw:text-start',
        'tw:*:data-text:block tw:*:data-text:min-w-0 tw:*:data-text:w-full tw:*:data-text:truncate'
      );

      if (entity.isGroup && entity.occurrenceCount > 1) {
        const expandHandler = () => {
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
        };

        const nameWithCount = `${entity.columnName} (${entity.occurrenceCount})`;

        const isGroupExpanded = columnGridListing.expandedRows.has(entity.id);

        return (
          <div className={COLUMN_NAME_CELL_GRID}>
            <div className={COLUMN_NAME_CELL_CHEVRON}>
              <ButtonUtility
                color="tertiary"
                icon={
                  <ChevronRight
                    className={classNames(
                      'tw:size-4 tw:transition-transform',
                      isGroupExpanded && 'tw:rotate-90'
                    )}
                  />
                }
                size="sm"
                onClick={expandHandler}
              />
            </div>
            <Button
              className={columnNameButtonClass}
              color="tertiary"
              onPress={() => {
                handleGroupSelectRef.current(entity.id, true);
                openDrawerRef.current();
              }}>
              {nameWithCount}
            </Button>
          </div>
        );
      }

      if (entity.isStructChild) {
        const hasChildren = entity.children && entity.children.length > 0;
        const nestedCount = entity.children?.length ?? 0;
        const nameWithCount =
          nestedCount > 0
            ? `${entity.columnName} (${nestedCount})`
            : entity.columnName;

        const structExpandHandler = () => {
          const isExpanded = columnGridListing.expandedStructRows.has(
            entity.id
          );
          if (isExpanded) {
            scrollToRowIdRef.current = entity.id;
            columnGridListing.setExpandedStructRows((prev: Set<string>) => {
              const newSet = new Set(prev);
              newSet.delete(entity.id);

              return newSet;
            });
          } else {
            columnGridListing.setExpandedStructRows((prev: Set<string>) => {
              const newSet = new Set(prev);
              newSet.add(entity.id);

              return newSet;
            });
          }
        };

        const isStructExpanded = columnGridListing.expandedStructRows.has(
          entity.id
        );

        return (
          <div className={COLUMN_NAME_CELL_GRID}>
            <div className={COLUMN_NAME_CELL_CHEVRON}>
              {hasChildren ? (
                <ButtonUtility
                  color="tertiary"
                  icon={
                    <ChevronRight
                      className={classNames(
                        'tw:size-4 tw:transition-transform',
                        isStructExpanded && 'tw:rotate-90'
                      )}
                    />
                  }
                  size="sm"
                  onClick={structExpandHandler}
                />
              ) : null}
            </div>
            <Button
              className={columnNameButtonClass}
              color="tertiary"
              onPress={() => {
                handleSelectRef.current(entity.id, true);
                openDrawerRef.current();
              }}>
              {nameWithCount}
            </Button>
          </div>
        );
      }

      const hasStructChildren = entity.children && entity.children.length > 0;
      const nestedCount = entity.children?.length ?? 0;
      const nameWithCount =
        nestedCount > 0
          ? `${entity.columnName} (${nestedCount})`
          : entity.columnName;

      const occurrenceExpandHandler = () => {
        const isExpanded = columnGridListing.expandedStructRows.has(entity.id);
        if (isExpanded) {
          scrollToRowIdRef.current = entity.id;
          columnGridListing.setExpandedStructRows((prev: Set<string>) => {
            const newSet = new Set(prev);
            newSet.delete(entity.id);

            return newSet;
          });
        } else {
          columnGridListing.setExpandedStructRows((prev: Set<string>) => {
            const newSet = new Set(prev);
            newSet.add(entity.id);

            return newSet;
          });
        }
      };

      const isOccurrenceExpanded = columnGridListing.expandedStructRows.has(
        entity.id
      );

      return (
        <div className={COLUMN_NAME_CELL_GRID}>
          <div className={COLUMN_NAME_CELL_CHEVRON}>
            {hasStructChildren ? (
              <ButtonUtility
                color="tertiary"
                icon={
                  <ChevronRight
                    className={classNames(
                      'tw:size-4 tw:transition-transform',
                      isOccurrenceExpanded && 'tw:rotate-90'
                    )}
                  />
                }
                size="sm"
                onClick={occurrenceExpandHandler}
              />
            ) : null}
          </div>
          <Button
            className={columnNameButtonClass}
            color="tertiary"
            onPress={() => {
              handleSelectRef.current(entity.id, true);
              openDrawerRef.current();
            }}>
            {nameWithCount}
          </Button>
        </div>
      );
    },
    [
      columnGridListing.expandedRows,
      columnGridListing.expandedStructRows,
      columnGridListing.setExpandedRows,
      columnGridListing.setExpandedStructRows,
    ]
  );

  // Selection and expansion handled by listing data hook

  const updateRowField = useCallback(
    (
      rowId: string,
      field: 'displayName' | 'description' | 'tags',
      value: string | TagLabel[]
    ) => {
      const fieldName = EDIT_FIELD_TO_ROW_KEY[field];

      columnGridListing.setAllRows((prev: ColumnGridRowData[]) => {
        const updated = prev.map((row: ColumnGridRowData) =>
          row.id === rowId
            ? {
                ...row,
                [fieldName]: value,
                ...(field === 'description'
                  ? {
                      editedDescriptionPreview: getDescriptionPreview(
                        value as string
                      ),
                    }
                  : {}),
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
            editedDescriptionPreview: undefined,
            editedTags: undefined,
          };
        }

        return r;
      })
    );
  }, [columnGridListing]);

  const selectedRowsData = useMemo(
    () =>
      columnGridListing.allRows.filter((r: ColumnGridRowData) =>
        columnGridListing.isSelected(r.id)
      ),
    [columnGridListing.allRows, columnGridListing.isSelected]
  );

  const selectedGroupRowCount = useMemo(
    () =>
      selectedRowsData.filter(
        (row) => (row.isGroup || row.occurrenceCount > 1) && !row.parentId
      ).length,
    [selectedRowsData]
  );

  const editedNonGroupCount = useMemo(
    () =>
      selectedRowsData.filter((row) => !row.isGroup && hasEditedValues(row))
        .length,
    [selectedRowsData]
  );

  const handleBulkUpdate = useCallback(async () => {
    setIsUpdating(true);

    const pendingDisplayName = columnEditFormRef.current?.getDisplayName();
    const pendingDescription = columnEditFormRef.current?.getDescription();

    try {
      const columnUpdatesByKey = new Map<string, ColumnUpdate>();

      for (const row of selectedRowsData) {
        const effectiveDisplayName =
          pendingDisplayName ?? row.editedDisplayName;
        const hasDisplayNameChange =
          effectiveDisplayName !== undefined &&
          effectiveDisplayName !== (row.displayName ?? '');

        const hasDescriptionChange = pendingDescription !== undefined;

        if (!hasDisplayNameChange && !hasDescriptionChange && !row.editedTags) {
          continue;
        }

        for (const occurrence of extractRowOccurrences(row)) {
          const key = getOccurrenceKey(occurrence);
          const existing = columnUpdatesByKey.get(key);
          const update: ColumnUpdate = existing ?? {
            columnFQN: occurrence.columnFQN,
            entityType: occurrence.entityType,
          };

          if (hasDisplayNameChange) {
            update.displayName = effectiveDisplayName;
          }
          if (hasDescriptionChange) {
            update.description = pendingDescription;
          }
          if (row.editedTags !== undefined) {
            update.tags = row.editedTags;
          }

          columnUpdatesByKey.set(key, update);
        }
      }

      const columnUpdates = Array.from(columnUpdatesByKey.values());

      if (columnUpdates.length === 0) {
        showErrorToast(t('message.no-changes-to-save'));
        setIsUpdating(false);
        setBulkUpdateProgress(null);

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

      setBulkUpdateProgress({
        processed: 0,
        total: cleanedUpdates.length,
      });

      const response = await bulkUpdateColumnsAsync(request);

      // Store the jobId to listen for WebSocket notification when job completes
      activeJobIdRef.current = response.jobId;

      const updatedRowIds = new Set(
        selectedRowsData.map((r: ColumnGridRowData) => r.id)
      );
      setPendingRefetchRowIds(updatedRowIds);
      pendingHighlightRowIdsRef.current = updatedRowIds;
      lastBulkUpdateCountRef.current = cleanedUpdates.length;

      closeDrawerRef.current();
      columnGridListing.clearSelection();

      // Clear edited state in both allRows and the editedValuesRef
      // The page will automatically refresh when the WebSocket notification arrives
      columnGridListing.setAllRows((prev: ColumnGridRowData[]) =>
        prev.map((r: ColumnGridRowData) => ({
          ...r,
          editedDisplayName: undefined,
          editedDescription: undefined,
          editedDescriptionPreview: undefined,
          editedTags: undefined,
        }))
      );
      columnGridListing.clearEditedValues();
    } catch (error) {
      showErrorToast(t('server.entity-updating-error'));
      setIsUpdating(false);
      setBulkUpdateProgress(null);
    }
  }, [
    selectedRowsData,
    columnGridListing.clearEditedValues,
    columnGridListing.setAllRows,
    columnGridListing.clearSelection,
    t,
  ]);

  const handleBulkAssetsNotification = useCallback(
    async (message: string) => {
      let data: BulkAssetsSocketMessage;
      try {
        data = JSON.parse(message) as BulkAssetsSocketMessage;
      } catch {
        return;
      }

      if (!data.jobId || data.jobId !== activeJobIdRef.current) {
        return;
      }

      const status = data.status?.toUpperCase();

      const clearJobState = () => {
        setPendingRefetchRowIds(new Set());
        activeJobIdRef.current = null;
        setIsUpdating(false);
        setBulkUpdateProgress(null);
      };

      if (status === 'STARTED') {
        setIsUpdating(true);
        setBulkUpdateProgress((prev) => {
          const total = Math.max(
            0,
            data.total ?? prev?.total ?? lastBulkUpdateCountRef.current
          );
          if (total === 0) {
            return prev;
          }

          return { processed: 0, total };
        });

        return;
      }

      if (status === 'IN_PROGRESS' || status === 'RUNNING') {
        setIsUpdating(true);
        setBulkUpdateProgress((prev) => {
          const incomingProgress = Math.max(0, data.progress ?? 0);
          const total = Math.max(
            incomingProgress,
            data.total ?? prev?.total ?? lastBulkUpdateCountRef.current ?? 0
          );
          if (total === 0) {
            return prev;
          }

          const processed = Math.min(
            total,
            Math.max(incomingProgress, prev?.processed ?? 0)
          );

          return { processed, total };
        });

        return;
      }

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        setBulkUpdateProgress((prev) => {
          const resultProcessed = data.result?.numberOfRowsPassed;
          const resultTotal = data.result?.numberOfRowsProcessed;
          const total = Math.max(
            resultProcessed ?? 0,
            resultTotal ?? 0,
            prev?.total ?? lastBulkUpdateCountRef.current
          );
          if (total === 0) {
            return prev;
          }

          const processed = Math.min(
            total,
            Math.max(resultProcessed ?? total, 0)
          );

          return { processed, total };
        });

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
        } catch {
          showErrorToast(t('server.entity-updating-error'));
          clearJobState();
        }
      } else if (status === 'FAILED' || status === 'FAILURE') {
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
    if (!rowId) {
      return;
    }
    scrollToRowIdRef.current = null;
    const selector = `[data-row-id="${CSS.escape(rowId)}"]`;

    const tryScroll = (attempt = 0) => {
      requestAnimationFrame(() => {
        const row = document.querySelector(selector);
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
  const { filterSection, defaultFilters } = useColumnGridFilters({
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
    customStyles: { searchBoxWidth: 260 },
  });

  const getAllDescendantIds = useCallback(
    (parentId: string): string[] => {
      const allRows = columnGridListing.allRows;
      const result: string[] = [parentId];
      const queue = [parentId];
      while (queue.length > 0) {
        const current = queue.shift() as string;
        const children = allRows.filter(
          (r) => r.structParentId === current || r.parentId === current
        );
        for (const c of children) {
          result.push(c.id);
          queue.push(c.id);
        }
      }

      return result;
    },
    [columnGridListing.allRows]
  );

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

  const handleGroupSelect = useCallback(
    (groupId: string, checked: boolean) => {
      const computedChildIds = computeChildRowIdsFromGridItem(groupId);
      const idsWithDescendants = new Set<string>([groupId]);
      computedChildIds.forEach((id) => idsWithDescendants.add(id));
      idsWithDescendants.forEach((id) => {
        getAllDescendantIds(id).forEach((descId) =>
          idsWithDescendants.add(descId)
        );
      });

      if (checked) {
        columnGridListing.setExpandedRows((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.add(groupId);

          return newSet;
        });
        idsWithDescendants.forEach((id) =>
          columnGridListing.handleSelect(id, true)
        );
      } else {
        idsWithDescendants.forEach((id) =>
          columnGridListing.handleSelect(id, false)
        );
      }
    },
    [columnGridListing, computeChildRowIdsFromGridItem, getAllDescendantIds]
  );

  const selectWithDescendants = useCallback(
    (rowId: string, checked: boolean) => {
      getAllDescendantIds(rowId).forEach((id) =>
        columnGridListing.handleSelect(id, checked)
      );
    },
    [columnGridListing.handleSelect, getAllDescendantIds]
  );

  handleGroupSelectRef.current = handleGroupSelect;
  handleSelectRef.current = selectWithDescendants;

  // Set up data table with custom row component
  const CustomTableRow = useCallback(
    (props: Record<string, unknown>) => {
      const { entity, isSelected, tableColumns } = props as {
        entity: ColumnGridRowData;
        isSelected: boolean;
        tableColumns: { id: string }[];
      };

      const isChildRow = Boolean(entity.parentId || entity.isStructChild);
      const isParentExpanded =
        columnGridListing.expandedRows.has(entity.id) ||
        columnGridListing.expandedStructRows.has(entity.id);
      const showParentChildColors = isChildRow || isParentExpanded;

      return (
        <ColumnGridTableRow
          columnWidthPercent={COLUMN_WIDTH_PERCENT}
          entity={entity}
          isPendingRefetch={pendingRefetchRowIds.has(entity.id)}
          isRecentlyUpdated={recentlyUpdatedRowIds.has(entity.id)}
          isSelected={isSelected}
          renderColumnNameCell={renderColumnNameCellFinal}
          renderDescriptionCell={renderDescriptionCellAdapter}
          renderGlossaryTermsCell={renderGlossaryTermsCellAdapter}
          renderPathCell={renderPathCellAdapter}
          renderTagsCell={renderTagsCellAdapter}
          showParentChildColors={showParentChildColors}
          tableColumns={tableColumns}
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

  const hasActiveFiltersOrSearch = Boolean(
    columnGridListing.urlState?.searchQuery?.trim() ||
      (columnGridListing.urlState?.filters &&
        Object.values(columnGridListing.urlState.filters).some(
          (filterValues: unknown) =>
            Array.isArray(filterValues) && filterValues.length > 0
        ))
  );

  const tableColumns = useMemo(
    () => columns.map((c) => ({ id: c.key, labelKey: c.labelKey })),
    [columns]
  );

  const selectedKeys = useMemo(() => {
    const ids = columnGridListing.selectedEntities.filter(
      (id) => id !== '__loading' && id !== '__empty'
    );

    return new Set(ids);
  }, [columnGridListing.selectedEntities]);

  const handleTableSelectionChange = useCallback(
    (keys: Set<string> | 'all') => {
      if (keys === 'all') {
        columnGridListing.handleSelectAll(true);

        return;
      }

      if (keys.size === 0) {
        columnGridListing.clearSelection();

        return;
      }

      const validKeys = Array.from(keys).filter(
        (id) => id !== '__loading' && id !== '__empty'
      );
      const validSet = new Set(validKeys);
      const previousSelected = new Set(columnGridListing.selectedEntities);
      const finalSelection = new Set<string>();
      validKeys.forEach((id) => {
        getAllDescendantIds(id).forEach((descId) => finalSelection.add(descId));
      });

      previousSelected.forEach((id) => {
        if (validSet.has(id)) {
          return;
        }
        getAllDescendantIds(id).forEach((descId) =>
          finalSelection.delete(descId)
        );
      });

      validKeys.forEach((id) => {
        const entity = columnGridListing.entities.find((e) => e.id === id);
        const isGroupParent =
          entity?.isGroup && (entity.occurrenceCount ?? 0) > 1;

        if (isGroupParent) {
          columnGridListing.setExpandedRows((prev: Set<string>) => {
            const next = new Set(prev);
            next.add(id);

            return next;
          });
          const parentWasNewlySelected = !previousSelected.has(id);
          if (parentWasNewlySelected) {
            const childIds = computeChildRowIdsFromGridItem(id);
            childIds.forEach((childId) => {
              getAllDescendantIds(childId).forEach((descId) =>
                finalSelection.add(descId)
              );
            });
          }
        }
      });

      columnGridListing.setSelectedEntities(Array.from(finalSelection));
    },
    [
      columnGridListing.entities,
      columnGridListing.selectedEntities,
      columnGridListing.handleSelectAll,
      columnGridListing.clearSelection,
      columnGridListing.setExpandedRows,
      columnGridListing.setSelectedEntities,
      computeChildRowIdsFromGridItem,
      getAllDescendantIds,
    ]
  );

  const tableItems = useMemo(() => {
    if (columnGridListing.loading) {
      return [{ id: '__loading', __loading: true }];
    }

    if (isEmpty(filteredEntities) && hasActiveFiltersOrSearch) {
      return [{ id: '__empty', __empty: true }];
    }

    return filteredEntities;
  }, [columnGridListing.loading, filteredEntities, hasActiveFiltersOrSearch]);

  const spanColumn = useMemo(() => [{ id: 'span' as const }], []);

  const dataTable = useMemo(
    () => (
      <Table
        className={TABLE_LAYOUT_CLASSES}
        data-testid="table-view-container"
        selectedKeys={selectedKeys}
        selectionMode="multiple"
        onSelectionChange={(keys) => {
          if (keys === 'all') {
            handleTableSelectionChange('all');
          } else {
            handleTableSelectionChange(keys as Set<string>);
          }
        }}>
        <Table.Header columns={tableColumns}>
          {(column) => (
            <Table.Head
              id={column.id}
              isRowHeader={column.id === 'columnName'}
              key={column.id}
              label={t((column as { labelKey: string }).labelKey)}
              style={{ width: COLUMN_WIDTH_PERCENT[column.id] }}
            />
          )}
        </Table.Header>
        <Table.Body items={tableItems as Iterable<ColumnGridRowData>}>
          {(item) => {
            const entity = item as ColumnGridRowData & {
              __loading?: boolean;
              __empty?: boolean;
            };

            if (entity.__loading) {
              return (
                <Table.Row columns={spanColumn} id="__loading" key="__loading">
                  {() => (
                    <Table.Cell colSpan={tableColumns.length}>
                      <div className="tw:flex tw:justify-center tw:py-4">
                        <Loader />
                      </div>
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            }

            if (entity.__empty) {
              return (
                <Table.Row columns={spanColumn} id="__empty" key="__empty">
                  {() => (
                    <Table.Cell colSpan={tableColumns.length}>
                      <div className="tw:py-4 tw:text-center tw:text-tertiary">
                        {t('server.no-records-found')}
                      </div>
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            }

            return (
              <CustomTableRow
                entity={entity}
                isSelected={columnGridListing.isSelected(entity.id)}
                key={entity.id}
                tableColumns={tableColumns}
                onSelect={columnGridListing.handleSelect}
              />
            );
          }}
        </Table.Body>
      </Table>
    ),
    [
      tableItems,
      tableColumns,
      spanColumn,
      selectedKeys,
      handleTableSelectionChange,
      columnGridListing.loading,
      columnGridListing.isSelected,
      t,
      columnGridListing.handleSelect,
      CustomTableRow,
    ]
  );

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

  const selectedCount = Math.max(
    0,
    columnGridListing.selectedEntities.length - selectedGroupRowCount
  );
  const editedCount = editedNonGroupCount;
  const hasSelection = selectedCount > 0;
  const pendingChangesDisplayValue = useMemo(() => {
    if (bulkUpdateProgress && bulkUpdateProgress.total > 0) {
      const processed = Math.min(
        bulkUpdateProgress.processed,
        bulkUpdateProgress.total
      );

      return `${processed}/${bulkUpdateProgress.total}`;
    }

    return editedCount > 0
      ? `${editedCount}/${selectedCount || editedCount}`
      : '0';
  }, [bulkUpdateProgress, editedCount, selectedCount]);

  const showPendingChangesSpinner = useMemo(() => {
    if (isUpdating) {
      return true;
    }

    return Boolean(
      bulkUpdateProgress &&
        bulkUpdateProgress.total > 0 &&
        bulkUpdateProgress.processed < bulkUpdateProgress.total
    );
  }, [bulkUpdateProgress, isUpdating]);

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
    const firstRow = selectedRowsData[0];
    if (!firstRow && selectedCount === 0) {
      return (
        <Typography as="span" className="tw:text-tertiary">
          {t('message.select-columns-to-edit')}
        </Typography>
      );
    }

    const drawerKey = `${selectedRowsData.map((row) => row.id).join('-')}`;

    return (
      <ColumnEditForm
        allRows={columnGridListing.allRows}
        drawerKey={drawerKey}
        editorRef={editorRef}
        firstRow={firstRow}
        getTagDisplayLabel={getTagDisplayLabel}
        key={drawerKey}
        ref={columnEditFormRef}
        selectedCount={selectedCount}
        selectedRowsData={selectedRowsData}
        onDescriptionChange={(description, preview) => {
          columnGridListing.setAllRows((prev: ColumnGridRowData[]) =>
            prev.map((row: ColumnGridRowData) =>
              columnGridListing.isSelected(row.id)
                ? {
                    ...row,
                    editedDescription: description,
                    editedDescriptionPreview: preview,
                  }
                : row
            )
          );
        }}
        onDisplayNameSync={(value) => {
          columnGridListing.setAllRows((prev: ColumnGridRowData[]) =>
            prev.map((row: ColumnGridRowData) =>
              columnGridListing.isSelected(row.id)
                ? { ...row, editedDisplayName: value }
                : row
            )
          );
        }}
        onTagsUpdate={(rowId, tags) => updateRowField(rowId, 'tags', tags)}
      />
    );
  }, [
    columnGridListing,
    columnGridListing.allRows,
    selectedRowsData,
    selectedCount,
    t,
    getTagDisplayLabel,
    updateRowField,
  ]);

  const drawerHeaderAssetLink = useMemo(() => {
    if (selectedCount !== 1) {
      return null;
    }
    const firstRow = selectedRowsData[0];

    return firstRow ? getColumnLink(firstRow) : null;
  }, [selectedCount, selectedRowsData, getColumnLink]);

  const viewAssetHeaderAction = useMemo(() => {
    if (!drawerHeaderAssetLink) {
      return null;
    }

    return (
      <Link
        className={
          ' tw:flex tw:items-center tw:gap-1 tw:rounded tw:px-1.5 tw:py-0.5 ' +
          'tw:text-xs tw:font-medium tw:bg-utility-brand-50 tw:text-utility-brand-700 '
        }
        data-testid="view-asset-button"
        to={drawerHeaderAssetLink}>
        {t('label.view-entity', { entity: t('label.asset') })}
        <ArrowRight className="tw:size-3.5" />
      </Link>
    );
  }, [drawerHeaderAssetLink, t]);

  const drawerTitle = useMemo(
    () => (
      <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap">
        <Typography as="h3" data-testid="form-heading">
          {`${t('label.edit-entity', { entity: t('label.column') })} ${
            selectedCount > 0 ? String(selectedCount).padStart(2, '0') : ''
          }`}
        </Typography>
        {viewAssetHeaderAction}
      </div>
    ),
    [t, selectedCount, viewAssetHeaderAction]
  );

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: drawerTitle,
    width: '40%',
    closeOnEscape: true,
    className: 'tw:z-[20]',
    testId: 'column-bulk-operations-form-drawer',
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
        <div className="tw:w-full tw:overflow-x-hidden">{dataTable}</div>
        {columnGridListing.totalEntities > 0 && (
          <div
            className="tw:flex tw:justify-center tw:border-t tw:border-border-secondary tw:pt-7 tw:px-6 tw:pb-5"
            data-testid="pagination">
            <NextPrevious {...paginationData} />
          </div>
        )}
      </>
    );
  }, [
    columnGridListing.loading,
    columnGridListing.totalEntities,
    filteredEntities,
    dataTable,
    paginationData,
    t,
  ]);

  return (
    <div data-testid="column-grid-container">
      {/* Summary Stats Cards - single Card container with equal spacing */}
      <div className="tw:mb-2">
        <Card className="tw:flex tw:w-full tw:items-stretch tw:p-6">
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-stretch">
            <div
              className="tw:flex tw:min-w-0 tw:flex-1 tw:shrink-0 tw:items-center tw:gap-4 tw:pl-6 first:tw:pl-0 last:tw:pr-0"
              data-testid="total-unique-columns-card">
              <UniqueColumnsIcon height={47} width={47} />
              <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
                <Typography
                  as="p"
                  className="tw:text-md tw:font-semibold tw:text-primary"
                  data-testid="total-unique-columns-value">
                  {columnGridListing.totalUniqueColumns.toLocaleString()}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-sm tw:text-secondary tw:whitespace-nowrap">
                  {t('label.total-unique-columns')}
                </Typography>
              </div>
            </div>

            <div
              aria-hidden
              className="tw:flex tw:flex-none tw:items-stretch tw:justify-center tw:mx-2 tw:w-px"
              data-testid="stat-divider-1">
              <div className="tw:w-px tw:shrink-0 tw:self-stretch tw:bg-border-secondary" />
            </div>

            <div
              className="tw:flex tw:min-w-0 tw:flex-1 tw:shrink-0 tw:items-center tw:gap-4 tw:pl-6 first:tw:pl-0 last:tw:pr-0"
              data-testid="total-occurrences-card">
              <OccurrencesIcon height={47} width={47} />
              <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
                <Typography
                  as="p"
                  className="tw:text-md tw:font-semibold tw:text-primary"
                  data-testid="total-occurrences-value">
                  {columnGridListing.totalOccurrences.toLocaleString()}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-sm tw:text-secondary tw:whitespace-nowrap">
                  {t('label.total-occurrences')}
                </Typography>
              </div>
            </div>

            <div
              aria-hidden
              className="tw:flex tw:flex-none tw:items-stretch tw:justify-center tw:mx-2 tw:w-px"
              data-testid="stat-divider-2">
              <div className="tw:w-px tw:shrink-0 tw:self-stretch tw:bg-border-secondary" />
            </div>

            <div
              className="tw:flex tw:min-w-0 tw:flex-1 tw:shrink-0 tw:items-center tw:gap-4 tw:pl-6 first:tw:pl-0 last:tw:pr-0"
              data-testid="pending-changes-card">
              <PendingChangesIcon height={47} width={47} />
              <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
                <Typography
                  as="p"
                  className="tw:text-md tw:font-semibold tw:text-primary"
                  data-testid="pending-changes-value">
                  {pendingChangesDisplayValue}
                </Typography>
                <div className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-sm tw:text-secondary tw:whitespace-nowrap">
                  <Typography as="span">
                    {t('label.pending-changes')}
                  </Typography>
                  {showPendingChangesSpinner && (
                    <Loader
                      data-testid="pending-changes-progress-spinner"
                      size="x-small"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Table Container - Same structure as DomainListPage */}
      <div className="tw:mb-5 tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:ring-1 tw:ring-secondary">
        <div className="tw:flex tw:flex-col tw:gap-4 tw:px-6 tw:py-4 tw:border-b tw:border-border-secondary">
          <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap">
            {/* Search */}
            <div className="tw:shrink-0">{search}</div>
            <div className="tw:flex tw:items-center tw:flex-wrap tw:gap-1 tw:flex-1 tw:min-w-0">
              {/* Filters + Add Filter */}
              <div className="tw:flex tw:items-center tw:flex-wrap tw:gap-1 tw:flex-1 tw:min-w-0">
                {filterSection}
              </div>
              {/* Actions - right aligned */}
              <div className="tw:flex tw:items-center tw:shrink-0 tw:gap-1 tw:ml-auto">
                {hasSelection && (
                  <>
                    <Typography
                      as="span"
                      className="tw:text-sm tw:text-primary tw:whitespace-nowrap">
                      {t('label.view-selected')} ({selectedCount})
                    </Typography>
                    <Toggle
                      isSelected={viewSelectedOnly}
                      size="sm"
                      onChange={(checked: boolean) =>
                        setViewSelectedOnly(!!checked)
                      }
                    />
                  </>
                )}
                {hasSelection ? (
                  <>
                    <Button
                      className="tw:ml-2.5"
                      color="primary"
                      data-testid="edit-button"
                      iconLeading={<EditIcon height={14} width={14} />}
                      isDisabled={isUpdating}
                      size="sm"
                      onPress={openDrawer}>
                      {t('label.edit')}
                    </Button>
                    <Button
                      className="tw:text-secondary"
                      color="tertiary"
                      data-testid="cancel-selection-button"
                      size="sm"
                      onPress={() => {
                        columnGridListing.clearSelection();
                        setViewSelectedOnly(false);
                      }}>
                      <XClose height={16} width={16} />
                    </Button>
                  </>
                ) : (
                  <Button
                    isDisabled
                    className="tw:text-tertiary"
                    color="tertiary"
                    data-testid="edit-button-disabled"
                    iconLeading={<EditIcon height={14} width={14} />}
                    size="sm"
                    onPress={openDrawer}>
                    {t('label.edit')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          {filterSelectionDisplay}
        </div>
        {content}
      </div>

      {/* Edit Drawer */}
      {formDrawer}
    </div>
  );
};

export default ColumnGrid;
