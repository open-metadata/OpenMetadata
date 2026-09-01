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
import {
  Avatar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Card,
  Checkbox,
  Dialog,
  Dropdown,
  EmptyPlaceholder,
  FeaturedIcon,
  Input,
  Modal,
  ModalOverlay,
  Skeleton,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  BarChart03,
  ChevronDown,
  ChevronRight,
  CursorClick01,
  Download01,
  Edit03,
  Eye,
  EyeOff,
  FileCheck03,
  Grid01,
  Package,
  Plus,
  Rows03,
  SearchLg,
  Settings01,
  Trash01,
  UploadCloud01,
  User01,
  XClose,
} from '@untitledui/icons';
import type { AxiosError } from 'axios';
import { debounce, startCase } from 'lodash';
import type { ChangeEvent, Key } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import {
  CSV_JOBS_REFRESH_EVENT,
  markCsvJobOwned,
} from '../../../components/common/EntityImport/CsvJobsTray/CsvJobsTray.constants';
import MetricListHealth from '../../../components/Metric/MetricListHealth/MetricListHealth.component';
import MetricStatusPill from '../../../components/Metric/MetricStatusPill/MetricStatusPill.component';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import { EntityStatus } from '../../../generated/entity/data/metric';
import type { TagLabel } from '../../../generated/type/tagLabel';
import { TagSource } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useMetricHierarchy } from '../../../hooks/useMetricHierarchy';
import {
  deleteMetricAsync,
  exportMetricDetailsInCSV,
} from '../../../rest/metricsAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getEntityBulkEditPath,
  getEntityImportPath,
} from '../../../utils/EntityPureUtils';
import {
  getMetricEnumLabel,
  getMetricTypeBadgeColor,
  METRIC_GRANULARITY_CLASS_NAME,
  METRIC_TYPE_BADGE_CLASS_NAME,
} from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import {
  flattenMetricRows,
  flattenVisibleMetricRows,
  hasMetricChildren,
  isGroupRow,
  isLoadMoreRow,
  isSyntheticRow,
  MetricTableRow,
  MetricTreeNode,
} from '../../../utils/MetricEntityUtils/MetricHierarchyUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { getErrorText } from '../../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  MetricBulkEditListFilters,
  MetricBulkEditScope,
} from '../../EntityImport/BulkEntityImportPage/BulkEntityImportPage.interface';

type MetricColumnId =
  | 'description'
  | 'glossary'
  | 'entityStatus'
  | 'health'
  | 'owners'
  | 'tags'
  | 'domains'
  | 'updatedAt';

type MetricViewMode = 'card' | 'table';

const METRIC_COLUMN_STORAGE_KEY = 'metricsList.columnPrefs.v2';
const METRIC_VIEW_STORAGE_KEY = 'metricsList.viewMode.v1';
const METRIC_SEARCH_DEBOUNCE_MS = 500;
const METRIC_PAGE_SIZE = 20;

const METRIC_COLUMN_ORDER: MetricColumnId[] = [
  'description',
  'glossary',
  'entityStatus',
  'health',
  'owners',
  'tags',
  'domains',
  'updatedAt',
];

const DEFAULT_VISIBLE_METRIC_COLUMNS: MetricColumnId[] = [
  'description',
  'glossary',
  'entityStatus',
  'health',
  'owners',
];

const METRIC_COLUMN_LABEL_KEYS: Record<MetricColumnId, string> = {
  description: 'label.description',
  glossary: 'label.glossary-term-plural',
  entityStatus: 'label.status',
  health: 'label.health',
  owners: 'label.owner-plural',
  tags: 'label.tag-plural',
  domains: 'label.domain-plural',
  updatedAt: 'label.last-updated',
};

const METRIC_STATUS_LABEL_KEYS: Record<EntityStatus, string> = {
  [EntityStatus.Approved]: 'label.approved',
  [EntityStatus.Archived]: 'label.archived',
  [EntityStatus.Deprecated]: 'label.deprecated',
  [EntityStatus.Draft]: 'label.draft',
  [EntityStatus.InReview]: 'label.in-review',
  [EntityStatus.Rejected]: 'label.rejected',
  [EntityStatus.Unprocessed]: 'label.unprocessed',
};

const METRIC_STATUS_FILTER_OPTIONS = Object.values(EntityStatus);

const getInputChangeValue = (value: string | ChangeEvent<HTMLInputElement>) =>
  typeof value === 'string' ? value : value.target.value;

const getStoredColumns = (): MetricColumnId[] => {
  try {
    const storedColumns = JSON.parse(
      localStorage.getItem(METRIC_COLUMN_STORAGE_KEY) ?? 'null'
    );

    return Array.isArray(storedColumns)
      ? METRIC_COLUMN_ORDER.filter((column) => storedColumns.includes(column))
      : DEFAULT_VISIBLE_METRIC_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_METRIC_COLUMNS;
  }
};

const getInitialViewMode = (): MetricViewMode => {
  const storedMode = localStorage.getItem(METRIC_VIEW_STORAGE_KEY);
  if (storedMode === 'card' || storedMode === 'table') {
    return storedMode;
  }

  return window.matchMedia?.('(max-width: 767px)').matches ? 'card' : 'table';
};

const getDepthClassName = (depth: number) => {
  if (depth >= 3) {
    return 'tw:pl-12';
  }
  if (depth === 2) {
    return 'tw:pl-8';
  }
  if (depth === 1) {
    return 'tw:pl-4';
  }

  return '';
};

const MetricListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getResourcePermission } = usePermissionProvider();
  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntityStatus>();
  const [page, setPage] = useState(1);
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] =
    useState<MetricColumnId[]>(getStoredColumns);
  const [viewMode, setViewMode] = useState<MetricViewMode>(getInitialViewMode);
  const [isExporting, setIsExporting] = useState(false);
  const [isMetricActionsOpen, setIsMetricActionsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingMetrics, setIsDeletingMetrics] = useState(false);
  const defaultExpandedGroupScopeRef = useRef<string>();

  const debounceSetSearch = useMemo(
    () => debounce(setDebouncedSearch, METRIC_SEARCH_DEBOUNCE_MS),
    []
  );

  useEffect(() => () => debounceSetSearch.cancel(), [debounceSetSearch]);

  const {
    data: permission = DEFAULT_ENTITY_PERMISSION,
    isPending: isPermissionPending,
    error: permissionError,
    refetch: refetchPermission,
  } = useQuery({
    queryKey: ['metric-list-permission', ResourceEntity.METRIC],
    queryFn: () => getResourcePermission(ResourceEntity.METRIC),
  });

  const hasViewPermission = permission.ViewAll || permission.ViewBasic;
  const isTreeMode = !statusFilter;

  const {
    data: searchResponse,
    isPending: isSearchQueryPending,
    isFetching: isSearchQueryFetching,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: [
      'metric-listing',
      {
        search: debouncedSearch,
        status: statusFilter,
        page,
        size: METRIC_PAGE_SIZE,
      },
    ],
    queryFn: () =>
      searchQuery({
        query: debouncedSearch,
        pageNumber: page,
        pageSize: METRIC_PAGE_SIZE,
        searchIndex: SearchIndex.METRIC,
        trackTotalHits: true,
        queryFilter: statusFilter
          ? getTermQuery({ entityStatus: statusFilter })
          : undefined,
      }),
    enabled: hasViewPermission && !isTreeMode,
    placeholderData: keepPreviousData,
  });

  const {
    topLevelNodes,
    buildRows,
    paging: treePaging,
    isPending: isTreePending,
    isFetching: isTreeFetching,
    error: treeError,
    refetch: refetchTree,
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
    reset: resetHierarchy,
  } = useMetricHierarchy({
    enabled: hasViewPermission && isTreeMode,
    page,
    pageSize: METRIC_PAGE_SIZE,
    query: debouncedSearch,
  });

  const treeRows = useMemo(
    () => buildRows(topLevelNodes),
    [buildRows, topLevelNodes]
  );
  const flatMetrics = useMemo(
    () => searchResponse?.hits.hits.map(({ _source }) => _source) ?? [],
    [searchResponse]
  );
  const rows: MetricTableRow[] = isTreeMode
    ? treeRows
    : (flatMetrics as MetricTableRow[]);
  const visibleRows = useMemo(() => flattenVisibleMetricRows(rows), [rows]);
  const realMetrics = useMemo(() => flattenMetricRows(rows), [rows]);
  const metricsById = useMemo(
    () => new Map(realMetrics.map((metric) => [metric.id, metric])),
    [realMetrics]
  );
  const selectableMetricIds = useMemo(
    () => realMetrics.map(({ id }) => id),
    [realMetrics]
  );
  const selectedMetrics = useMemo(
    () => realMetrics.filter(({ id }) => selectedMetricIds.includes(id)),
    [realMetrics, selectedMetricIds]
  );

  useEffect(() => {
    setSelectedMetricIds((current) => {
      const visibleSelection = current.filter((id) =>
        selectableMetricIds.includes(id)
      );

      return visibleSelection.length === current.length
        ? current
        : visibleSelection;
    });
  }, [selectableMetricIds]);

  const hierarchyExpansionScope = `${page}:${debouncedSearch}`;

  useEffect(() => {
    const hasExpandableGroup = topLevelNodes.some(({ groupId }) => groupId);
    if (
      !isTreeMode ||
      isTreePending ||
      !hasExpandableGroup ||
      defaultExpandedGroupScopeRef.current === hierarchyExpansionScope
    ) {
      return;
    }

    defaultExpandedGroupScopeRef.current = hierarchyExpansionScope;
    expandAll();
  }, [
    expandAll,
    hierarchyExpansionScope,
    isTreeMode,
    isTreePending,
    topLevelNodes,
  ]);

  const handleMetricRowAction = useCallback(
    (key: Key) => {
      const metric = metricsById.get(String(key));
      if (!metric?.fullyQualifiedName) {
        return;
      }

      navigate(
        getEntityDetailsPath(EntityType.METRIC, metric.fullyQualifiedName)
      );
    },
    [metricsById, navigate]
  );

  const isSearchTextPending = searchText.trim() !== debouncedSearch;
  const isMetricsBusy = isTreeMode ? isTreeFetching : isSearchQueryFetching;
  const isMetricsPending = isTreeMode ? isTreePending : isSearchQueryPending;
  const totalMetrics = isTreeMode
    ? treePaging.total
    : searchResponse?.hits.total.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMetrics / METRIC_PAGE_SIZE));
  const listingError =
    permissionError ?? (isTreeMode ? treeError : searchError);
  const listingErrorMessage = permissionError
    ? t('server.fetch-entity-permissions-error', {
        entity: t('label.metric-plural'),
      })
    : t('server.entity-fetch-error', { entity: t('label.metric-plural') });
  const hasGroups = topLevelNodes.some(({ groupId }) => Boolean(groupId));
  const areAllGroupsExpanded = collapsedGroupIds.length === 0;

  useEffect(() => {
    if (listingError) {
      showErrorToast(
        getErrorText(listingError as AxiosError, listingErrorMessage)
      );
    }
  }, [listingError, listingErrorMessage]);

  useEffect(() => {
    const highlightFqn = searchParams.get('highlight');
    if (!highlightFqn) {
      return;
    }
    const row = document.querySelector(
      `[data-metric-fqn="${CSS.escape(highlightFqn)}"]`
    );
    row?.scrollIntoView({ block: 'center' });
  }, [rows, searchParams]);

  const getStatusLabel = useCallback(
    (status: EntityStatus) => t(METRIC_STATUS_LABEL_KEYS[status]),
    [t]
  );

  const getOwnerInitials = useCallback(
    (owner: NonNullable<Metric['owners']>[number]) =>
      startCase(owner.displayName ?? owner.name)
        .slice(0, 2)
        .toUpperCase(),
    []
  );

  const getGlossaryTerms = useCallback(
    (tags?: TagLabel[]) =>
      tags?.filter(({ source }) => source === TagSource.Glossary) ?? [],
    []
  );

  const getTags = useCallback(
    (tags?: TagLabel[]) =>
      tags?.filter(({ source }) => source !== TagSource.Glossary) ?? [],
    []
  );

  const setCurrentPage = useCallback((nextPage: number) => {
    setSelectedMetricIds([]);
    setPage(nextPage);
  }, []);

  const handleSearchTextChange = useCallback(
    (value: string | ChangeEvent<HTMLInputElement>) => {
      const nextSearchText = getInputChangeValue(value);
      setSearchText(nextSearchText);
      setCurrentPage(1);
      debounceSetSearch(nextSearchText.trim());
    },
    [debounceSetSearch, setCurrentPage]
  );

  const handleStatusFilterChange = useCallback(
    (status?: EntityStatus) => {
      setStatusFilter(status);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const persistVisibleColumns = useCallback((columns: MetricColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem(METRIC_COLUMN_STORAGE_KEY, JSON.stringify(columns));
  }, []);

  const handleToggleColumn = useCallback(
    (columnId: MetricColumnId) => {
      persistVisibleColumns(
        visibleColumns.includes(columnId)
          ? visibleColumns.filter((id) => id !== columnId)
          : METRIC_COLUMN_ORDER.filter(
              (id) => id === columnId || visibleColumns.includes(id)
            )
      );
    },
    [persistVisibleColumns, visibleColumns]
  );

  const handleViewModeChange = useCallback((nextMode: MetricViewMode) => {
    setViewMode(nextMode);
    localStorage.setItem(METRIC_VIEW_STORAGE_KEY, nextMode);
  }, []);

  const handleImport = useCallback(() => {
    setIsMetricActionsOpen(false);
    navigate(getEntityImportPath(EntityType.METRIC, WILD_CARD_CHAR));
  }, [navigate]);

  const handleExport = useCallback(async () => {
    try {
      setIsMetricActionsOpen(false);
      setIsExporting(true);
      const exportJob = await exportMetricDetailsInCSV(WILD_CARD_CHAR);
      // Claim the just-started job so the tray always surfaces it, even if it
      // finishes before the tray's first fetch.
      markCsvJobOwned((exportJob as { jobId?: string })?.jobId);
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleBulkEdit = useCallback(() => {
    const filters: MetricBulkEditListFilters = {
      searchText: searchText.trim(),
      statusFilter,
    };
    const metricBulkEditScope: MetricBulkEditScope = selectedMetricIds.length
      ? {
          mode: 'selected',
          metricIds: selectedMetricIds,
          metricNames: selectedMetrics.map(({ name }) => name),
          filters,
        }
      : { mode: 'filtered', filters };

    navigate(getEntityBulkEditPath(EntityType.METRIC, WILD_CARD_CHAR), {
      state: { metricBulkEditScope },
    });
  }, [navigate, searchText, selectedMetricIds, selectedMetrics, statusFilter]);

  const handleBulkDelete = useCallback(async () => {
    try {
      setIsDeletingMetrics(true);
      await Promise.all(selectedMetrics.map(({ id }) => deleteMetricAsync(id)));
      showSuccessToast(
        t('message.metrics-delete-success', {
          count: selectedMetrics.length,
        })
      );
      setSelectedMetricIds([]);
      setIsDeleteDialogOpen(false);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ['metric-listing'] });
      resetHierarchy();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeletingMetrics(false);
    }
  }, [queryClient, resetHierarchy, selectedMetrics, t]);

  const handleRetry = useCallback(() => {
    if (permissionError) {
      refetchPermission();
    } else if (isTreeMode) {
      refetchTree();
    } else {
      refetchSearch();
    }
  }, [
    isTreeMode,
    permissionError,
    refetchPermission,
    refetchSearch,
    refetchTree,
  ]);

  const handleLoadMore = useCallback(
    (row: Extract<MetricTableRow, { isLoadMoreRow: true }>) =>
      row.scope === 'group'
        ? loadMoreGroupMembers(row.parentId)
        : loadMoreChildren(row.parentId),
    [loadMoreChildren, loadMoreGroupMembers]
  );

  const isLoadMoreBusy = useCallback(
    (row: Extract<MetricTableRow, { isLoadMoreRow: true }>) =>
      row.scope === 'group'
        ? loadingGroupIds.includes(row.parentId)
        : loadingParentIds.includes(row.parentId),
    [loadingGroupIds, loadingParentIds]
  );

  const renderTagBadges = (tags: Array<Pick<TagLabel, 'name' | 'tagFQN'>>) =>
    tags.length ? (
      <Box className="tw:flex-wrap" gap={1}>
        {tags.map((tag) => (
          <Badge color="blue" key={tag.tagFQN} size="sm">
            {tag.name ?? tag.tagFQN}
          </Badge>
        ))}
      </Box>
    ) : (
      <span className="tw:text-tertiary">{t('label.empty-dash')}</span>
    );

  const renderOwners = (owners?: Metric['owners']) =>
    owners?.length ? (
      <Box align="center" gap={1}>
        {owners.slice(0, 3).map((owner) => (
          <Avatar initials={getOwnerInitials(owner)} key={owner.id} size="xs" />
        ))}
        {owners.length > 3 && (
          <span className="tw:text-xs tw:text-tertiary">
            +{owners.length - 3}
          </span>
        )}
      </Box>
    ) : (
      <span className="tw:text-tertiary">{t('label.empty-dash')}</span>
    );

  const renderMetricName = (metric: MetricTreeNode, depth: number) => {
    const isExpanded = expandedRowKeys.includes(metric.id);
    const hasChildren = hasMetricChildren(metric);

    return (
      <Box
        align="center"
        className={`${getDepthClassName(depth)} tw:min-w-0`}
        data-metric-fqn={metric.fullyQualifiedName}
        gap={2}>
        {hasChildren ? (
          <Button
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? t('label.collapse-all') : t('label.expand-all')
            }
            className="tw:shrink-0"
            color="tertiary"
            data-testid={`expand-${metric.id}`}
            iconLeading={isExpanded ? ChevronDown : ChevronRight}
            isLoading={loadingParentIds.includes(metric.id)}
            size="xs"
            onPress={() => toggleExpand(!isExpanded, metric)}
          />
        ) : (
          <span aria-hidden="true" className="tw:size-6 tw:shrink-0" />
        )}
        <FeaturedIcon
          outlined
          color="brand"
          data-testid={`metric-icon-${metric.id}`}
          icon={BarChart03}
          shape="square"
          size="sm"
          theme="light"
        />
        <Box className="tw:min-w-0" direction="col" gap={1}>
          <Link
            className="tw:truncate tw:text-sm tw:font-semibold tw:text-brand-secondary hover:tw:text-brand-secondary_hover"
            data-testid="metric-name"
            to={getEntityDetailsPath(
              EntityType.METRIC,
              metric.fullyQualifiedName ?? ''
            )}>
            {getEntityName(metric)}
          </Link>
          <Box align="center" className="tw:flex-wrap tw:font-mono" gap={2}>
            {metric.metricType && (
              <Badge
                className={METRIC_TYPE_BADGE_CLASS_NAME}
                color={getMetricTypeBadgeColor(metric.metricType)}
                size="xs"
                type="color">
                {getMetricEnumLabel(t, metric.metricType)}
              </Badge>
            )}
            {metric.granularity && (
              <>
                <span
                  aria-hidden="true"
                  className="tw:size-0.5 tw:rounded-full tw:bg-border-primary"
                />
                <span
                  className={`${METRIC_GRANULARITY_CLASS_NAME} tw:text-xs tw:font-semibold`}>
                  {getMetricEnumLabel(t, metric.granularity)}
                </span>
              </>
            )}
            {(metric.childrenCount ?? 0) > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="tw:size-0.5 tw:rounded-full tw:bg-border-primary"
                />
                <span
                  className="tw:text-xs tw:text-tertiary"
                  data-testid="metric-variant-count">
                  {metric.childrenCount}{' '}
                  <span className="tw:lowercase">
                    {metric.childrenCount === 1
                      ? t('label.variant')
                      : t('label.variant-plural')}
                  </span>
                </span>
              </>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderGroupName = (
    row: Extract<MetricTableRow, { isGroupRow: true }>
  ) => {
    const isCollapsed = collapsedGroupIds.includes(row.id);

    return (
      <Button
        aria-expanded={!isCollapsed}
        className={[
          'tw:w-full tw:justify-start tw:rounded-none tw:bg-secondary tw:px-4 tw:py-2.5 tw:hover:bg-secondary',
          'tw:[&_[data-text]]:flex tw:[&_[data-text]]:w-full tw:[&_[data-text]]:min-w-0 tw:[&_[data-text]]:items-center tw:[&_[data-text]]:gap-2',
        ].join(' ')}
        color="tertiary"
        data-testid={`metric-group-${row.group.name}`}
        isLoading={loadingGroupIds.includes(row.group.id)}
        size="sm"
        onPress={() => toggleGroup(row.id)}>
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="tw:size-4 tw:shrink-0" />
        ) : (
          <ChevronDown aria-hidden="true" className="tw:size-4 tw:shrink-0" />
        )}
        <span className="tw:grid tw:size-7 tw:shrink-0 tw:place-items-center tw:rounded-md tw:bg-utility-purple-50 tw:text-utility-purple-700">
          <Package aria-hidden="true" className="tw:size-4" />
        </span>
        <Box align="baseline" className="tw:min-w-0 tw:flex-1" gap={2}>
          <Typography
            as="span"
            className="tw:shrink-0 tw:text-primary"
            size="text-sm"
            weight="bold">
            {getEntityName(row.group)}
          </Typography>
          {row.group.description && (
            <Typography
              as="span"
              className="tw:truncate tw:text-tertiary"
              size="text-xs">
              {row.group.description}
            </Typography>
          )}
        </Box>
        <Badge className="tw:ml-auto tw:shrink-0" color="gray" size="sm">
          {row.memberCount}{' '}
          <span className="tw:lowercase">
            {row.memberCount === 1
              ? t('label.metric')
              : t('label.metric-plural')}
          </span>
        </Badge>
      </Button>
    );
  };

  const renderLoadMore = (
    row: Extract<MetricTableRow, { isLoadMoreRow: true }>,
    depth: number
  ) => (
    <Button
      className={getDepthClassName(depth)}
      color="link-color"
      data-testid={
        row.scope === 'group'
          ? `load-more-group-${row.parentId}`
          : `load-more-children-${row.parentId}`
      }
      isLoading={isLoadMoreBusy(row)}
      onPress={() => handleLoadMore(row)}>
      {t('label.show-more-entity', {
        entity: t('label.variant-plural'),
      })}
      {row.remaining > 0 && ` (${row.remaining})`}
    </Button>
  );

  const fullWidthTableColumnCount = 2 + visibleColumns.length;

  const renderTable = () => (
    <Table
      aria-label={t('label.metric-plural')}
      disabledKeys={visibleRows
        .filter(({ row }) => isSyntheticRow(row))
        .map(({ row }) => row.id)}
      selectedKeys={new Set(selectedMetricIds)}
      selectionBehavior="toggle"
      selectionMode="multiple"
      size="sm"
      onRowAction={handleMetricRowAction}
      onSelectionChange={(selection) =>
        setSelectedMetricIds(
          selection === 'all'
            ? selectableMetricIds
            : Array.from(selection)
                .map(String)
                .filter((id) => selectableMetricIds.includes(id))
        )
      }>
      <Table.Header>
        <Table.Head
          isRowHeader
          className="tw:min-w-80"
          label={t('label.metric')}
        />
        {visibleColumns.includes('description') && (
          <Table.Head className="tw:min-w-72" label={t('label.description')} />
        )}
        {visibleColumns.includes('glossary') && (
          <Table.Head label={t('label.glossary-term-plural')} />
        )}
        {visibleColumns.includes('entityStatus') && (
          <Table.Head label={t('label.status')} />
        )}
        {visibleColumns.includes('health') && (
          <Table.Head label={t('label.health')} />
        )}
        {visibleColumns.includes('owners') && (
          <Table.Head label={t('label.owner-plural')} />
        )}
        {visibleColumns.includes('tags') && (
          <Table.Head label={t('label.tag-plural')} />
        )}
        {visibleColumns.includes('domains') && (
          <Table.Head label={t('label.domain-plural')} />
        )}
        {visibleColumns.includes('updatedAt') && (
          <Table.Head label={t('label.last-updated')} />
        )}
      </Table.Header>
      <Table.Body>
        {visibleRows.map(({ row, depth }) => {
          if (isGroupRow(row)) {
            return (
              <Table.Row
                hideSelectionCell
                className="tw:h-auto tw:bg-secondary tw:hover:bg-secondary"
                data-testid={`metric-group-row-${row.group.id}`}
                id={row.id}
                key={row.id}>
                <Table.Cell
                  className="tw:p-0"
                  colSpan={fullWidthTableColumnCount}>
                  {renderGroupName(row)}
                </Table.Cell>
              </Table.Row>
            );
          }

          if (isLoadMoreRow(row)) {
            return (
              <Table.Row
                hideSelectionCell
                className="tw:h-auto"
                id={row.id}
                key={row.id}>
                <Table.Cell colSpan={fullWidthTableColumnCount}>
                  <Box className="tw:py-1" justify="center">
                    {renderLoadMore(row, depth)}
                  </Box>
                </Table.Cell>
              </Table.Row>
            );
          }

          const metric = row;

          return (
            <Table.Row className="tw:cursor-pointer" id={row.id} key={row.id}>
              <Table.Cell>{renderMetricName(metric, depth)}</Table.Cell>
              {visibleColumns.includes('description') && (
                <Table.Cell>
                  {metric.description ?? t('label.empty-dash')}
                </Table.Cell>
              )}
              {visibleColumns.includes('glossary') && (
                <Table.Cell>
                  {renderTagBadges(getGlossaryTerms(metric.tags))}
                </Table.Cell>
              )}
              {visibleColumns.includes('entityStatus') && (
                <Table.Cell>
                  <MetricStatusPill status={metric.entityStatus} />
                </Table.Cell>
              )}
              {visibleColumns.includes('health') && (
                <Table.Cell>
                  <MetricListHealth metricId={metric.id} />
                </Table.Cell>
              )}
              {visibleColumns.includes('owners') && (
                <Table.Cell>{renderOwners(metric.owners)}</Table.Cell>
              )}
              {visibleColumns.includes('tags') && (
                <Table.Cell>{renderTagBadges(getTags(metric.tags))}</Table.Cell>
              )}
              {visibleColumns.includes('domains') && (
                <Table.Cell>
                  {renderTagBadges(
                    (metric.domains ?? []).map((domain) => ({
                      tagFQN: domain.fullyQualifiedName ?? domain.id,
                      name:
                        domain.displayName ??
                        domain.name ??
                        domain.fullyQualifiedName,
                      source: TagSource.Classification,
                    }))
                  )}
                </Table.Cell>
              )}
              {visibleColumns.includes('updatedAt') && (
                <Table.Cell>
                  {metric.updatedAt
                    ? getShortRelativeTime(metric.updatedAt)
                    : t('label.empty-dash')}
                </Table.Cell>
              )}
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );

  const renderCards = () => (
    <Box
      className="tw:grid tw:grid-cols-1 tw:gap-3 tw:p-4 tw:lg:grid-cols-2"
      data-testid="metric-card-view">
      {visibleRows.map(({ row, depth }) => {
        if (isGroupRow(row)) {
          return (
            <Card
              className="tw:lg:col-span-2"
              data-testid={`metric-group-card-${row.group.name}`}
              key={row.id}
              size="sm">
              <Card.Content>{renderGroupName(row)}</Card.Content>
            </Card>
          );
        }

        if (isLoadMoreRow(row)) {
          return (
            <Box
              className="tw:lg:col-span-2 tw:py-2"
              justify="center"
              key={row.id}>
              {renderLoadMore(row, depth)}
            </Box>
          );
        }

        return (
          <Card
            className={depth > 0 ? 'tw:border-l-4 tw:border-l-brand' : ''}
            data-metric-fqn={row.fullyQualifiedName}
            data-testid={`metric-card-${row.id}`}
            isSelected={selectedMetricIds.includes(row.id)}
            key={row.id}
            size="sm">
            <Card.Content>
              <Box direction="col" gap={4}>
                <Box align="start" gap={3} justify="between">
                  <Box className="tw:min-w-0" gap={2}>
                    <Checkbox
                      aria-label={`${t('label.select')} ${getEntityName(row)}`}
                      isSelected={selectedMetricIds.includes(row.id)}
                      onChange={(isSelected) =>
                        setSelectedMetricIds((ids) =>
                          isSelected
                            ? [...ids, row.id]
                            : ids.filter((id) => id !== row.id)
                        )
                      }
                    />
                    {renderMetricName(row, depth)}
                  </Box>
                </Box>
                {visibleColumns.includes('description') && (
                  <Typography className="tw:text-secondary" size="text-sm">
                    {row.description ?? t('label.empty-dash')}
                  </Typography>
                )}
                <Box className="tw:flex-wrap" gap={3}>
                  {visibleColumns.includes('entityStatus') && (
                    <MetricStatusPill status={row.entityStatus} />
                  )}
                  {visibleColumns.includes('health') && (
                    <MetricListHealth metricId={row.id} />
                  )}
                  {visibleColumns.includes('owners') &&
                    renderOwners(row.owners)}
                </Box>
                {visibleColumns.includes('glossary') &&
                  renderTagBadges(getGlossaryTerms(row.tags))}
                {visibleColumns.includes('tags') &&
                  renderTagBadges(getTags(row.tags))}
                {visibleColumns.includes('updatedAt') && (
                  <span className="tw:text-xs tw:text-tertiary">
                    {row.updatedAt
                      ? getShortRelativeTime(row.updatedAt)
                      : t('label.empty-dash')}
                  </span>
                )}
              </Box>
            </Card.Content>
          </Card>
        );
      })}
    </Box>
  );

  const renderPagination = () =>
    totalMetrics > METRIC_PAGE_SIZE ? (
      <Box
        aria-label={t('label.page')}
        className="tw:border-t tw:border-secondary tw:px-4 tw:py-3"
        justify="between"
        role="navigation">
        <Button
          color="secondary"
          data-testid="metric-page-previous"
          isDisabled={page <= 1 || isMetricsBusy}
          onPress={() => setCurrentPage(page - 1)}>
          {t('label.previous')}
        </Button>
        <span className="tw:text-sm tw:text-tertiary tw:tabular-nums">
          {t('label.page')} {page} {t('label.of-lowercase')} {totalPages}
        </span>
        <Button
          color="secondary"
          data-testid="metric-page-next"
          isDisabled={page >= totalPages || isMetricsBusy}
          onPress={() => setCurrentPage(page + 1)}>
          {t('label.next')}
        </Button>
      </Box>
    ) : null;

  const renderLoading = () => (
    <Box
      aria-label={t('label.loading')}
      className="tw:p-4"
      data-testid="metric-list-loading"
      direction="col"
      gap={3}
      role="status">
      {[0, 1, 2, 3].map((row) => (
        <Skeleton height={56} key={row} variant="rounded" />
      ))}
    </Box>
  );

  const renderEmpty = () => {
    const isUnfiltered = !searchText && !statusFilter;

    return (
      <Box className="tw:min-h-96 tw:p-4" justify="center">
        <EmptyPlaceholder
          actions={
            isUnfiltered && permission.Create
              ? [
                  {
                    key: 'new-metric',
                    label: t('label.new-metric'),
                    color: 'primary',
                    iconLeading: Plus,
                    onPress: () => navigate(ROUTES.ADD_METRIC),
                  },
                ]
              : undefined
          }
          description={
            isUnfiltered
              ? t('message.metric-empty-state-description')
              : t('message.no-results-for-filters-description')
          }
          features={
            isUnfiltered
              ? [
                  {
                    key: 'define',
                    icon: <FileCheck03 className="tw:text-fg-brand-primary" />,
                    title: t('label.define-it'),
                    description: t('message.metric-define-it-description'),
                  },
                  {
                    key: 'action',
                    icon: (
                      <CursorClick01 className="tw:text-fg-warning-primary" />
                    ),
                    title: t('label.define-the-action'),
                    description: t('message.metric-define-action-description'),
                  },
                  {
                    key: 'owner',
                    icon: <User01 className="tw:text-fg-success-primary" />,
                    title: t('label.assign-an-owner'),
                    description: t('message.metric-assign-owner-description'),
                  },
                ]
              : undefined
          }
          title={
            isUnfiltered
              ? t('message.metric-empty-state-title')
              : t('label.no-data')
          }
          variant={isUnfiltered ? 'features' : 'blank'}
        />
      </Box>
    );
  };

  const renderError = () => (
    <Box className="tw:min-h-80 tw:p-6" justify="center">
      <Card data-testid="metric-list-error" size="sm">
        <Card.Content>
          <Box align="center" direction="col" gap={3}>
            <Typography className="tw:text-error-primary" size="text-sm">
              <span role="alert">
                {getErrorText(listingError as AxiosError, listingErrorMessage)}
              </span>
            </Typography>
            <Button color="secondary" onPress={handleRetry}>
              {t('label.try-again')}
            </Button>
          </Box>
        </Card.Content>
      </Card>
    </Box>
  );

  const metricActions = (
    <Box align="center" gap={2}>
      {permission.Create && (
        <LimitWrapper resource="metric">
          <Button
            color="primary"
            data-testid="create-metric"
            iconLeading={Plus}
            onPress={() => navigate(ROUTES.ADD_METRIC)}>
            {t('label.add-entity', { entity: t('label.metric') })}
          </Button>
        </LimitWrapper>
      )}
      {permission.EditAll && (
        <Dropdown.Root
          isOpen={isMetricActionsOpen}
          onOpenChange={setIsMetricActionsOpen}>
          <Dropdown.DotsButton
            aria-label={t('label.action-plural')}
            data-testid="metric-actions"
          />
          <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'export') {
                  handleExport();
                } else if (key === 'import') {
                  handleImport();
                }
              }}>
              <Dropdown.Item
                icon={Download01}
                id="export"
                isDisabled={isExporting}
                label={t('label.export')}
              />
              <Dropdown.Item
                icon={UploadCloud01}
                id="import"
                label={t('label.import')}
              />
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </Box>
  );

  if (isPermissionPending) {
    return (
      <main className="tw:min-h-full tw:bg-primary tw:px-4 tw:py-7 tw:md:px-8">
        <DocumentTitle title={t('label.metric-plural')} />
        {renderLoading()}
      </main>
    );
  }

  return (
    <main
      className="tw:min-h-full tw:bg-primary tw:px-4 tw:py-7 tw:md:px-8 tw:md:pb-10"
      data-testid="metric-list-page">
      <DocumentTitle title={t('label.metric-plural')} />
      <Box
        align="start"
        className="tw:mb-6 tw:flex-wrap"
        data-testid="metric-list-header"
        gap={4}
        justify="between">
        <Box direction="col" gap={1}>
          <Typography as="h1" size="text-xl" weight="bold">
            {t('label.metric-plural')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.metric-description')}
          </Typography>
        </Box>
        {metricActions}
      </Box>

      {!hasViewPermission && !listingError ? (
        <Card>
          <Card.Content>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.no-permission-to-view')}
            </Typography>
          </Card.Content>
        </Card>
      ) : (
        <Card size="sm">
          <Box
            align="center"
            className="tw:flex-col tw:border-b tw:border-secondary tw:px-4 tw:py-3 tw:sm:flex-row tw:sm:flex-nowrap"
            data-testid="metric-list-toolbar"
            gap={3}
            justify="between">
            {selectedMetricIds.length ? (
              <Box align="center" className="tw:w-full tw:flex-wrap" gap={3}>
                <Badge color="brand" size="sm">
                  {selectedMetricIds.length} {t('label.selected-lowercase')}
                </Badge>
                <Button
                  color="link-gray"
                  data-testid="clear-metric-selection"
                  iconLeading={XClose}
                  onPress={() => setSelectedMetricIds([])}>
                  {t('label.clear')}
                </Button>
                {permission.EditAll && (
                  <Button
                    className="tw:text-brand-primary! tw:hover:text-brand-primary! tw:*:data-icon:text-fg-brand-primary!"
                    color="link-color"
                    data-testid="bulk-edit-metric"
                    iconLeading={Edit03}
                    onPress={handleBulkEdit}>
                    {t('label.bulk-edit-count', {
                      count: selectedMetricIds.length,
                    })}
                  </Button>
                )}
                {permission.Delete && (
                  <Button
                    color="link-destructive"
                    data-testid="bulk-delete-metric"
                    iconLeading={Trash01}
                    onPress={() => setIsDeleteDialogOpen(true)}>
                    {t('label.delete')}
                  </Button>
                )}
              </Box>
            ) : (
              <Input
                className="tw:w-full tw:sm:max-w-84"
                data-testid="metric-search"
                icon={SearchLg}
                placeholder={t('label.search-entity', {
                  entity: t('label.metric-plural'),
                })}
                value={searchText}
                wrapperClassName="tw:w-full tw:sm:max-w-84"
                onChange={handleSearchTextChange}
              />
            )}

            <Box
              align="center"
              className="tw:w-full tw:flex-wrap tw:sm:w-auto tw:sm:flex-nowrap"
              gap={3}
              justify="end">
              {!selectedMetricIds.length && (
                <>
                  <Dropdown.Root>
                    <Button color="link-color" iconTrailing={ChevronDown}>
                      {statusFilter
                        ? getStatusLabel(statusFilter)
                        : t('label.status')}
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        selectedKeys={new Set([statusFilter ?? 'all'])}
                        onAction={(key) =>
                          handleStatusFilterChange(
                            key === 'all' ? undefined : (key as EntityStatus)
                          )
                        }>
                        <Dropdown.Item id="all" label={t('label.all')} />
                        {METRIC_STATUS_FILTER_OPTIONS.map((status) => (
                          <Dropdown.Item
                            id={status}
                            key={status}
                            label={getStatusLabel(status)}
                          />
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                  {permission.EditAll && (
                    <Button
                      className="tw:focus-visible:outline-none! tw:focus-visible:bg-brand-primary_alt"
                      color="link-color"
                      data-testid="bulk-edit-metric"
                      iconLeading={Edit03}
                      onPress={handleBulkEdit}>
                      {t('label.bulk-edit-all')}
                    </Button>
                  )}
                  <span
                    aria-hidden="true"
                    className="tw:h-5 tw:w-px tw:bg-border-secondary"
                  />
                  {isTreeMode && hasGroups && (
                    <>
                      <Button
                        color="link-gray"
                        data-testid="toggle-expand-all"
                        iconLeading={Rows03}
                        onPress={
                          areAllGroupsExpanded ? collapseAll : expandAll
                        }>
                        {areAllGroupsExpanded
                          ? t('label.collapse-all')
                          : t('label.expand-all')}
                      </Button>
                      <span
                        aria-hidden="true"
                        className="tw:h-5 tw:w-px tw:bg-border-secondary"
                      />
                    </>
                  )}
                </>
              )}
              <ButtonGroup
                aria-label={t('label.view')}
                selectedKeys={new Set([viewMode])}
                size="sm"
                onSelectionChange={(keys) => {
                  const nextMode = Array.from(keys)[0];
                  if (nextMode === 'card' || nextMode === 'table') {
                    handleViewModeChange(nextMode);
                  }
                }}>
                <ButtonGroupItem
                  aria-label={t('label.table')}
                  data-testid="metric-table-view-button"
                  iconLeading={Rows03}
                  id="table"
                />
                <ButtonGroupItem
                  aria-label={t('label.card')}
                  data-testid="metric-card-view-button"
                  iconLeading={Grid01}
                  id="card"
                />
              </ButtonGroup>
              {!selectedMetricIds.length && (
                <>
                  <span
                    aria-hidden="true"
                    className="tw:h-5 tw:w-px tw:bg-border-secondary"
                  />
                  <Dropdown.Root>
                    <Button
                      className="tw:focus-visible:outline-none! tw:focus-visible:bg-brand-primary_alt"
                      color="link-color"
                      iconLeading={Settings01}>
                      {t('label.customize')}
                    </Button>
                    <Dropdown.Popover>
                      <Box className="tw:p-2" direction="col" gap={1}>
                        <Button
                          color="link-color"
                          onPress={() =>
                            persistVisibleColumns(
                              visibleColumns.length ===
                                METRIC_COLUMN_ORDER.length
                                ? []
                                : METRIC_COLUMN_ORDER
                            )
                          }>
                          {visibleColumns.length === METRIC_COLUMN_ORDER.length
                            ? t('label.hide-all')
                            : t('label.view-all')}
                        </Button>
                        {METRIC_COLUMN_ORDER.map((columnId) => (
                          <Button
                            color="tertiary"
                            iconLeading={
                              visibleColumns.includes(columnId) ? Eye : EyeOff
                            }
                            key={columnId}
                            onPress={() => handleToggleColumn(columnId)}>
                            {t(METRIC_COLUMN_LABEL_KEYS[columnId])}
                          </Button>
                        ))}
                      </Box>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                </>
              )}
            </Box>
          </Box>

          <span aria-live="polite" className="tw:sr-only">
            {isMetricsBusy || isSearchTextPending
              ? t('label.loading')
              : `${totalMetrics} ${t('label.result-plural')}`}
          </span>

          {listingError
            ? renderError()
            : isMetricsPending || isSearchTextPending
            ? renderLoading()
            : rows.length === 0
            ? renderEmpty()
            : viewMode === 'table'
            ? renderTable()
            : renderCards()}
          {!listingError && !isMetricsPending && renderPagination()}
        </Card>
      )}

      <ModalOverlay
        isDismissable
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}>
        <Modal>
          <Dialog
            showCloseButton
            title={t('label.delete-entity', {
              entity: t('label.metric-plural'),
            })}
            onClose={() => setIsDeleteDialogOpen(false)}>
            <Dialog.Content>
              <Typography className="tw:text-secondary" size="text-sm">
                {t('message.delete-metrics-warning')}
              </Typography>
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                onPress={() => setIsDeleteDialogOpen(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary-destructive"
                data-testid="confirm-button"
                isLoading={isDeletingMetrics}
                onPress={handleBulkDelete}>
                {t('label.delete')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </main>
  );
};

export default MetricListPage;
