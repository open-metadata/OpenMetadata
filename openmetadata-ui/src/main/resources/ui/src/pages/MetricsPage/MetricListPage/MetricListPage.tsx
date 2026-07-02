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
  Button,
  Dialog,
  DialogTrigger,
  Dropdown,
  Input,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  BarChartSquare02,
  Check,
  ChevronDown,
  Download01,
  Edit03,
  Eye,
  EyeOff,
  Plus,
  SearchLg,
  Settings01,
  Trash01,
  UploadCloud01,
  XClose,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { debounce, startCase } from 'lodash';
import {
  ChangeEvent,
  Key,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { CSV_JOBS_REFRESH_EVENT } from '../../../components/common/EntityImport/CsvJobsTray/CsvJobsTray.component';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../../components/common/Table/TableV2';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { INITIAL_PAGING_VALUE, ROUTES } from '../../../constants/constants';
import { METRICS_DOCS } from '../../../constants/docs.constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityStatus, Metric } from '../../../generated/entity/data/metric';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { usePaging } from '../../../hooks/paging/usePaging';
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
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { getErrorText } from '../../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  MetricBulkEditListFilters,
  MetricBulkEditScope,
} from '../../EntityImport/BulkEntityImportPage/BulkEntityImportPage.interface';
import './metric-list-page.less';

type MetricColumnId =
  | 'description'
  | 'glossary'
  | 'entityStatus'
  | 'owners'
  | 'tags'
  | 'domains'
  | 'updatedAt';

const METRIC_COLUMN_STORAGE_KEY = 'metricsList.columnPrefs.v1';

const METRIC_COLUMN_ORDER: MetricColumnId[] = [
  'description',
  'glossary',
  'entityStatus',
  'owners',
  'tags',
  'domains',
  'updatedAt',
];

const DEFAULT_VISIBLE_METRIC_COLUMNS: MetricColumnId[] = [
  'description',
  'glossary',
  'entityStatus',
  'owners',
];

const METRIC_COLUMN_LABEL_KEYS: Record<MetricColumnId, string> = {
  description: 'label.description',
  glossary: 'label.glossary-term-plural',
  entityStatus: 'label.status',
  owners: 'label.owner-plural',
  tags: 'label.tag-plural',
  domains: 'label.domain-plural',
  updatedAt: 'label.last-updated',
};

// The Status filter shows the distinct metric statuses (the design's
// Approved / In review / Draft) — not every EntityStatus enum value, several
// of which collapse to the same "Draft" label and render as duplicates.
const METRIC_STATUS_FILTER_OPTIONS: EntityStatus[] = [
  EntityStatus.Approved,
  EntityStatus.InReview,
  EntityStatus.Draft,
];

const getInputChangeValue = (value: string | ChangeEvent<HTMLInputElement>) =>
  typeof value === 'string' ? value : value.target.value;

const METRIC_SEARCH_DEBOUNCE_MS = 500;

const MetricListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    pageSize,
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    paging,
    showPagination,
  } = usePaging();

  const { getResourcePermission } = usePermissionProvider();
  const [permission, setPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntityStatus>();
  const [selectedMetricIds, setSelectedMetricIds] = useState<Key[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isMetricActionsOpen, setIsMetricActionsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<MetricColumnId[]>(() => {
    try {
      const storedColumns = localStorage.getItem(METRIC_COLUMN_STORAGE_KEY);

      return storedColumns
        ? (JSON.parse(storedColumns) as MetricColumnId[])
        : DEFAULT_VISIBLE_METRIC_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_METRIC_COLUMNS;
    }
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingMetrics, setIsDeletingMetrics] = useState(false);

  // All filtering (search + status) and pagination is done server-side via the
  // metric search index, so the Status filter and search stay consistent with
  // pagination totals.
  const fetchMetrics = useCallback(
    async ({
      page,
      search,
      status,
      size,
    }: {
      page: number;
      search: string;
      status?: EntityStatus;
      size: number;
    }) => {
      try {
        setLoadingMore(true);
        const response = await searchQuery({
          query: search,
          pageNumber: page,
          pageSize: size,
          searchIndex: SearchIndex.METRIC,
          trackTotalHits: true,
          queryFilter: status
            ? getTermQuery({ entityStatus: status })
            : undefined,
        });
        setMetrics(response.hits.hits.map((hit) => hit._source));
        handlePagingChange({ total: response.hits.total.value });
      } catch (error) {
        const errorMessage = getErrorText(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.metric-plural'),
          })
        );
        showErrorToast(errorMessage);
        setError(errorMessage);
      } finally {
        setLoadingMore(false);
      }
    },
    [handlePagingChange, t]
  );

  const init = async () => {
    try {
      setLoading(true);
      const permission = await getResourcePermission(ResourceEntity.METRIC);
      setPermission(permission);
      if (permission.ViewAll || permission.ViewBasic) {
        await fetchMetrics({
          page: currentPage,
          search: searchText,
          status: statusFilter,
          size: pageSize,
        });
      }
    } catch (error) {
      const errorMessage = getErrorText(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.metric-plural'),
        })
      );
      showErrorToast(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Search box changes debounce a fresh first-page query; filters and paging
  // fetch immediately.
  const debouncedSearchFetch = useMemo(
    () =>
      debounce(
        (search: string, status: EntityStatus | undefined, size: number) => {
          handlePageChange(INITIAL_PAGING_VALUE);
          fetchMetrics({ page: INITIAL_PAGING_VALUE, search, status, size });
        },
        METRIC_SEARCH_DEBOUNCE_MS
      ),
    [fetchMetrics, handlePageChange]
  );

  useEffect(() => () => debouncedSearchFetch.cancel(), [debouncedSearchFetch]);

  const handleStatusFilterChange = useCallback(
    (status?: EntityStatus) => {
      setStatusFilter(status);
      handlePageChange(INITIAL_PAGING_VALUE);
      fetchMetrics({
        page: INITIAL_PAGING_VALUE,
        search: searchText,
        status,
        size: pageSize,
      });
    },
    [fetchMetrics, handlePageChange, pageSize, searchText]
  );

  const onPageChange = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page);
      fetchMetrics({
        page,
        search: searchText,
        status: statusFilter,
        size: pageSize,
      });
    },
    [fetchMetrics, handlePageChange, pageSize, searchText, statusFilter]
  );

  const onShowSizeChange = useCallback(
    (size: number) => {
      handlePageSizeChange(size);
      fetchMetrics({
        page: INITIAL_PAGING_VALUE,
        search: searchText,
        status: statusFilter,
        size,
      });
    },
    [fetchMetrics, handlePageSizeChange, searchText, statusFilter]
  );

  const glossaryTerms = useCallback(
    (tags?: TagLabel[]) =>
      tags?.filter((tag) => tag.source === TagSource.Glossary) ?? [],
    []
  );

  const metricTags = useCallback(
    (tags?: TagLabel[]) =>
      tags?.filter((tag) => tag.source !== TagSource.Glossary) ?? [],
    []
  );

  const getMetricStatus = useCallback(
    (status?: EntityStatus) => {
      switch (status) {
        case EntityStatus.Approved:
          return {
            label: t('label.approved'),
            className: 'metric-status-approved',
            Icon: Check,
          };
        case EntityStatus.InReview:
          return {
            label: t('label.in-review'),
            className: 'metric-status-review',
            Icon: AlertCircle,
          };
        case EntityStatus.Draft:
        default:
          return {
            label: t('label.draft'),
            className: 'metric-status-draft',
            Icon: Edit03,
          };
      }
    },
    [t]
  );

  const handleImport = useCallback(() => {
    setIsMetricActionsOpen(false);
    navigate(getEntityImportPath(EntityType.METRIC, WILD_CARD_CHAR));
  }, [navigate]);

  const handleExport = useCallback(async () => {
    try {
      setIsMetricActionsOpen(false);
      setIsExporting(true);
      await exportMetricDetailsInCSV(WILD_CARD_CHAR);
      window.dispatchEvent(new Event(CSV_JOBS_REFRESH_EVENT));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const getOwnerInitials = useCallback(
    (owner: NonNullable<Metric['owners']>[number]) =>
      startCase(owner.displayName ?? owner.name)
        .slice(0, 2)
        .toUpperCase(),
    []
  );

  const selectedMetrics = useMemo(
    () => metrics.filter((metric) => selectedMetricIds.includes(metric.id)),
    [metrics, selectedMetricIds]
  );

  const canConfirmDelete = useMemo(() => {
    const confirmation = deleteConfirmation.trim().toLowerCase();

    return (
      confirmation === String(selectedMetricIds.length) ||
      confirmation === 'delete'
    );
  }, [deleteConfirmation, selectedMetricIds.length]);

  const persistVisibleColumns = useCallback((columns: MetricColumnId[]) => {
    setVisibleColumns(columns);
    localStorage.setItem(METRIC_COLUMN_STORAGE_KEY, JSON.stringify(columns));
  }, []);

  const handleToggleColumn = useCallback(
    (columnId: MetricColumnId) => {
      const nextColumns = visibleColumns.includes(columnId)
        ? visibleColumns.filter((id) => id !== columnId)
        : METRIC_COLUMN_ORDER.filter(
            (id) => id === columnId || visibleColumns.includes(id)
          );

      persistVisibleColumns(nextColumns);
    },
    [persistVisibleColumns, visibleColumns]
  );

  const handleBulkEdit = useCallback(() => {
    const filters: MetricBulkEditListFilters = {
      searchText: searchText.trim(),
      statusFilter,
    };
    const metricBulkEditScope: MetricBulkEditScope = selectedMetricIds.length
      ? {
          mode: 'selected',
          metricIds: selectedMetricIds.map(String),
          metricNames: selectedMetrics.map((metric) => metric.name),
          filters,
        }
      : {
          mode: 'filtered',
          filters,
        };
    navigate(getEntityBulkEditPath(EntityType.METRIC, WILD_CARD_CHAR), {
      state: {
        metricBulkEditScope,
      },
    });
  }, [navigate, searchText, selectedMetricIds, selectedMetrics, statusFilter]);

  const handleSearchTextChange = useCallback(
    (value: string | ChangeEvent<HTMLInputElement>) => {
      const text = getInputChangeValue(value);
      setSearchText(text);
      debouncedSearchFetch(text, statusFilter, pageSize);
    },
    [debouncedSearchFetch, pageSize, statusFilter]
  );

  const handleDeleteConfirmationChange = useCallback(
    (value: string | ChangeEvent<HTMLInputElement>) =>
      setDeleteConfirmation(getInputChangeValue(value)),
    []
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      setIsDeletingMetrics(true);
      await Promise.all(
        selectedMetrics.map((metric) => deleteMetricAsync(metric.id))
      );
      showSuccessToast(
        t('message.metrics-delete-success', {
          count: selectedMetrics.length,
        })
      );
      setSelectedMetricIds([]);
      setDeleteConfirmation('');
      setIsDeleteDialogOpen(false);
      // Deletion can shrink the result set below the current page; return to the
      // first page so the user never lands on an empty page.
      handlePageChange(INITIAL_PAGING_VALUE);
      fetchMetrics({
        page: INITIAL_PAGING_VALUE,
        search: searchText,
        status: statusFilter,
        size: pageSize,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeletingMetrics(false);
    }
  }, [
    fetchMetrics,
    handlePageChange,
    pageSize,
    searchText,
    selectedMetrics,
    statusFilter,
    t,
  ]);

  const columns = useMemo(() => {
    const emptyDash = (
      <span className="metric-list-empty-dash">{t('label.empty-dash')}</span>
    );

    const renderTagPills = (tags: TagLabel[], className: string) => (
      <div className="metric-list-glossary">
        {tags.length
          ? tags.map((tag) => (
              <Badge
                className={className}
                color="blue"
                key={tag.tagFQN}
                size="sm"
                type="color">
                {tag.name ?? tag.tagFQN}
              </Badge>
            ))
          : emptyDash}
      </div>
    );

    const metricColumn = {
      title: t('label.metric'),
      dataIndex: 'name',
      width: '320px',
      key: 'name',
      render: (_: string, record: Metric) => {
        return (
          <div className="metric-list-identity">
            <div className="metric-list-icon">
              <BarChartSquare02 />
            </div>
            <div className="metric-list-cell">
              <Link
                className="metric-list-name"
                data-testid="metric-name"
                to={getEntityDetailsPath(
                  EntityType.METRIC,
                  record.fullyQualifiedName ?? ''
                )}>
                {getEntityName(record)}
              </Link>
              <div className="metric-list-meta">
                {record.metricType && (
                  <Badge
                    className={`metric-list-type-pill metric-list-type-${record.metricType.toLowerCase()}`}
                    color="brand"
                    size="sm"
                    type="color">
                    {record.metricType}
                  </Badge>
                )}
                {record.granularity && (
                  <span className="metric-list-granularity">
                    {record.granularity}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    };

    const toggleableColumns = {
      description: {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 420,
        render: (description: string) => (
          <p className="m-0 metric-list-description">
            {description || emptyDash}
          </p>
        ),
      },
      glossary: {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        width: 240,
        render: (tags: TagLabel[]) =>
          renderTagPills(glossaryTerms(tags), 'metric-list-glossary-pill'),
      },
      entityStatus: {
        title: t('label.status'),
        dataIndex: 'entityStatus',
        key: 'entityStatus',
        width: 160,
        render: (status?: EntityStatus) => {
          const metricStatus = getMetricStatus(status);
          const StatusIcon = metricStatus.Icon;

          return (
            <Badge
              className={`metric-status-pill ${metricStatus.className}`}
              color="gray"
              size="sm"
              type="pill-color">
              <span className="metric-status-content">
                <StatusIcon className="metric-status-icon" size={10} />
                {metricStatus.label}
              </span>
            </Badge>
          );
        },
      },
      owners: {
        title: t('label.owner-plural'),
        dataIndex: 'owners',
        key: 'owners',
        width: 160,
        render: (owners: Metric['owners']) =>
          owners?.length ? (
            <div className="metric-owner-group">
              {owners.slice(0, 3).map((owner) => (
                <Avatar
                  className="metric-owner-avatar"
                  initials={getOwnerInitials(owner)}
                  key={owner.id}
                  size="sm"
                />
              ))}
              {owners.length > 3 && (
                <span className="metric-owner-extra">+{owners.length - 3}</span>
              )}
            </div>
          ) : (
            emptyDash
          ),
      },
      tags: {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: 220,
        render: (tags: TagLabel[]) =>
          renderTagPills(metricTags(tags), 'metric-list-tag-pill'),
      },
      domains: {
        title: t('label.domain-plural'),
        dataIndex: 'domains',
        key: 'domains',
        width: 220,
        render: (domains: Metric['domains']) => (
          <div className="metric-list-glossary">
            {domains?.length
              ? domains.map((domain) => (
                  <Badge
                    className="metric-list-glossary-pill"
                    color="blue"
                    key={domain.id}
                    size="sm"
                    type="color">
                    {domain.displayName ??
                      domain.name ??
                      domain.fullyQualifiedName}
                  </Badge>
                ))
              : emptyDash}
          </div>
        ),
      },
      updatedAt: {
        title: t('label.last-updated'),
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (updatedAt?: number) => (
          <span className="metric-list-muted">
            {updatedAt ? getShortRelativeTime(updatedAt) : emptyDash}
          </span>
        ),
      },
    };

    return [
      metricColumn,
      ...METRIC_COLUMN_ORDER.filter((id) => visibleColumns.includes(id)).map(
        (id) => toggleableColumns[id]
      ),
    ];
  }, [
    getMetricStatus,
    getOwnerInitials,
    glossaryTerms,
    metricTags,
    t,
    visibleColumns,
  ]);

  useEffect(() => {
    init();
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (error && !loading) {
    return (
      <ErrorPlaceHolder>
        <p className="text-center m-auto">{error}</p>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.metric-plural')}>
      <div className="p-b-md m-t-xs metric-list-page-stack">
        <div>
          <div className="d-flex justify-between">
            <PageHeader
              data={{
                header: t('label.metric-plural'),
                subHeader: t('message.metric-description'),
              }}
              learningPageId={LEARNING_PAGE_IDS.METRICS}
              title={t('label.metric')}
            />
            <div className="d-flex gap-2 metric-list-actions">
              {permission.Create && (
                <LimitWrapper resource="metric">
                  <Button
                    className="metric-list-add-button"
                    color="primary"
                    data-testid="create-metric"
                    iconLeading={Plus}
                    size="sm"
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
                    className="metric-list-kebab"
                    data-testid="metric-actions"
                  />
                  <Dropdown.Popover className="metric-actions-menu">
                    <div className="metric-actions-menu-content">
                      <button
                        aria-busy={isExporting}
                        className="metric-actions-menu-item"
                        disabled={isExporting}
                        type="button"
                        onClick={handleExport}>
                        <span className="metric-actions-icon">
                          <Download01 size={18} />
                        </span>
                        <span>
                          <span className="metric-actions-title">
                            {t('label.export')}
                          </span>
                          <span className="metric-actions-description">
                            {t('message.metrics-export-description')}
                          </span>
                        </span>
                      </button>
                      <button
                        className="metric-actions-menu-item"
                        type="button"
                        onClick={handleImport}>
                        <span className="metric-actions-icon">
                          <UploadCloud01 size={18} />
                        </span>
                        <span>
                          <span className="metric-actions-title">
                            {t('label.import')}
                          </span>
                          <span className="metric-actions-description">
                            {t('message.metrics-import-description')}
                          </span>
                        </span>
                      </button>
                      <span className="metric-actions-separator" />
                      <button
                        className="metric-actions-menu-item metric-actions-menu-item-danger"
                        type="button">
                        <span className="metric-actions-icon">
                          <Trash01 size={18} />
                        </span>
                        <span>
                          <span className="metric-actions-title">
                            {t('label.delete')}
                          </span>
                          <span className="metric-actions-description">
                            {t('message.metrics-delete-collection-description')}
                          </span>
                        </span>
                      </button>
                    </div>
                  </Dropdown.Popover>
                </Dropdown.Root>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="metric-list-table-card">
            {selectedMetricIds.length ? (
              <div className="metric-list-selection-bar">
                <div className="metric-list-selection-left">
                  <span className="metric-list-selection-count">
                    {selectedMetricIds.length}
                  </span>
                  <span>{t('label.selected-lowercase')}</span>
                  <Button
                    className="metric-list-selection-clear"
                    color="link-gray"
                    iconLeading={XClose}
                    onPress={() => setSelectedMetricIds([])}>
                    {t('label.clear')}
                  </Button>
                </div>
                <div className="metric-list-selection-actions">
                  {permission.EditAll && (
                    <Button
                      className="metric-list-selection-action"
                      color="link-color"
                      data-testid="bulk-edit-metric"
                      iconLeading={Edit03}
                      onPress={handleBulkEdit}>
                      {t('label.edit')}
                    </Button>
                  )}
                  {permission.Delete && (
                    <Button
                      className="metric-list-selection-action metric-list-selection-delete"
                      color="link-gray"
                      iconLeading={Trash01}
                      onPress={() => setIsDeleteDialogOpen(true)}>
                      {t('label.delete')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="metric-list-toolbar">
                <Input
                  className="metric-list-search"
                  data-testid="metric-search"
                  icon={SearchLg}
                  placeholder={t('label.search-entity', {
                    entity: t('label.metric-plural'),
                  })}
                  value={searchText}
                  wrapperClassName="metric-list-search-wrapper"
                  onChange={handleSearchTextChange}
                />
                <div className="metric-list-toolbar-actions">
                  <Dropdown.Root>
                    <Button
                      className="metric-list-toolbar-link metric-list-status-trigger"
                      color="link-gray"
                      iconTrailing={ChevronDown}>
                      {statusFilter
                        ? getMetricStatus(statusFilter).label
                        : t('label.status')}
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu
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
                            label={getMetricStatus(status).label}
                          />
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                  {permission.EditAll && (
                    <Button
                      className="metric-list-toolbar-link"
                      color="link-color"
                      data-testid="bulk-edit-metric"
                      iconLeading={Edit03}
                      onPress={handleBulkEdit}>
                      {t('label.edit')}
                    </Button>
                  )}
                  <span
                    aria-hidden="true"
                    className="metric-list-toolbar-divider"
                  />
                  <Dropdown.Root>
                    <Button
                      className="metric-list-toolbar-link"
                      color="link-color"
                      iconLeading={Settings01}>
                      {t('label.customize')}
                    </Button>
                    <Dropdown.Popover className="metric-customize-menu">
                      <div className="metric-customize-header">
                        <span>{t('label.column')}</span>
                        <button
                          className="metric-customize-toggle"
                          type="button"
                          onClick={() =>
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
                        </button>
                      </div>
                      <div className="metric-customize-list">
                        {METRIC_COLUMN_ORDER.map((columnId) => {
                          const isVisible = visibleColumns.includes(columnId);

                          return (
                            <button
                              className="metric-customize-row"
                              key={columnId}
                              type="button"
                              onClick={() => handleToggleColumn(columnId)}>
                              <span className="metric-customize-grip">::</span>
                              <span>
                                {t(METRIC_COLUMN_LABEL_KEYS[columnId])}
                              </span>
                              {isVisible ? (
                                <Eye className="metric-customize-eye" />
                              ) : (
                                <EyeOff className="metric-customize-eye" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                </div>
              </div>
            )}
            <Table
              columns={columns}
              customPaginationProps={{
                showPagination,
                currentPage,
                isLoading: loadingMore,
                isNumberBased: true,
                pageSize,
                paging,
                pagingHandler: onPageChange,
                onShowSizeChange,
              }}
              dataSource={metrics}
              loading={loadingMore}
              locale={{
                emptyText: (
                  <ErrorPlaceHolder
                    className="p-y-md border-none"
                    doc={METRICS_DOCS}
                    heading={t('label.metric')}
                    permission={permission.Create}
                    permissionValue={t('label.create-entity', {
                      entity: t('label.metric'),
                    })}
                    type={ERROR_PLACEHOLDER_TYPE.CREATE}
                    onClick={() => navigate(ROUTES.ADD_METRIC)}
                  />
                ),
              }}
              pagination={false}
              rowKey="id"
              rowSelection={{
                selectedRowKeys: selectedMetricIds,
                onChange: setSelectedMetricIds,
              }}
              size="small"
            />
          </div>
        </div>
      </div>
      {isDeleteDialogOpen && (
        <DialogTrigger
          isOpen={isDeleteDialogOpen}
          onOpenChange={(isOpen) => {
            setIsDeleteDialogOpen(isOpen);
            if (!isOpen) {
              setDeleteConfirmation('');
            }
          }}>
          <span />
          <ModalOverlay>
            <Modal className="metric-delete-modal">
              <Dialog
                showCloseButton
                title={t('message.delete-metrics-title', {
                  count: selectedMetricIds.length,
                })}
                onClose={() => setIsDeleteDialogOpen(false)}>
                <div className="metric-delete-dialog">
                  <div className="metric-delete-icon">
                    <Trash01 size={22} />
                  </div>
                  <p className="metric-delete-description">
                    {t('message.delete-metrics-warning')}
                  </p>
                  <div className="metric-delete-list">
                    {selectedMetrics.slice(0, 3).map((metric) => (
                      <div className="metric-delete-list-item" key={metric.id}>
                        <span className="metric-delete-list-name">
                          {metric.name}
                        </span>
                        <span className="metric-delete-list-display">
                          {getEntityName(metric)}
                        </span>
                      </div>
                    ))}
                    {selectedMetrics.length > 3 && (
                      <div className="metric-delete-list-item">
                        {t('label.plus-count-more', {
                          count: selectedMetrics.length - 3,
                        })}
                      </div>
                    )}
                  </div>
                  <Input
                    data-testid="metric-delete-confirmation"
                    label={t('message.delete-metrics-type-to-confirm', {
                      count: selectedMetricIds.length,
                    })}
                    value={deleteConfirmation}
                    onChange={handleDeleteConfirmationChange}
                  />
                  <div className="metric-delete-actions">
                    <Button
                      color="secondary"
                      onPress={() => setIsDeleteDialogOpen(false)}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      className="metric-delete-confirm-button"
                      color="primary"
                      iconLeading={Trash01}
                      isDisabled={!canConfirmDelete || isDeletingMetrics}
                      onPress={handleBulkDelete}>
                      {t('message.delete-metrics-action', {
                        count: selectedMetricIds.length,
                      })}
                    </Button>
                  </div>
                </div>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      )}
    </PageLayoutV1>
  );
};

export default MetricListPage;
