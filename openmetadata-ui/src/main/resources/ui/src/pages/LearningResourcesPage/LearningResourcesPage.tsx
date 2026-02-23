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
import type { BadgeColors } from '@openmetadata/ui-core-components';
import {
  Badge,
  Button,
  ButtonUtility,
  Table,
  TableCard,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/ic_video.svg';

import { useSearch } from '../../components/common/atoms/navigation/useSearch';
import { useViewToggle } from '../../components/common/atoms/navigation/useViewToggle';
import { DeleteModalMUI } from '../../components/common/DeleteModal/DeleteModalMUI';
import Loader from '../../components/common/Loader/Loader';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { LEARNING_CATEGORIES } from '../../components/Learning/Learning.interface';
import { LearningResourceCard } from '../../components/Learning/LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';

import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  MAX_VISIBLE_CONTEXTS,
  MAX_VISIBLE_TAGS,
  PAGE_IDS,
} from '../../constants/Learning.constants';

import { LearningResource } from '../../rest/learningResourceAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { useLearningResourceActions } from './hooks/useLearningResourceActions';
import {
  LearningResourceFilterState,
  useLearningResourceFilters,
} from './hooks/useLearningResourceFilters';
import { useLearningResources } from './hooks/useLearningResources';
import { LearningResourceForm } from './LearningResourceForm.component';

const CATEGORY_BADGE_COLORS: Record<string, BadgeColors> = {
  Discovery: 'blue',
  Administration: 'blue-light',
  DataGovernance: 'indigo',
  DataQuality: 'orange',
  Observability: 'orange',
  AI: 'purple',
};

type TableColumn = { id: string; label: string; className?: string };

const getResourceTypeIcon = (type: string) => {
  const icons: Record<
    string,
    React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  > = {
    Video: VideoIcon,
    Storylane: StoryLaneIcon,
  };

  const Icon = icons[type] ?? VideoIcon;

  return (
    <div className="tw:flex tw:items-center tw:justify-center tw:w-8 tw:h-8 tw:rounded tw:shrink-0">
      <Icon height={24} width={24} />
    </div>
  );
};

export const LearningResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [filterState, setFilterState] = useState<LearningResourceFilterState>(
    {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);

  const { resources, paging, isLoading, refetch } = useLearningResources({
    searchText,
    filterState,
    pageSize,
    currentPage,
  });

  const {
    isFormOpen,
    isPlayerOpen,
    isDeleteModalOpen,
    isDeleting,
    selectedResource,
    editingResource,
    deletingResource,
    handleCreate,
    handleEdit,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
    handlePreview,
    handleFormClose,
    handlePlayerClose,
  } = useLearningResourceActions({ onRefetch: refetch });

  const { view, viewToggle } = useViewToggle({ defaultView: 'table' });

  const { search } = useSearch({
    searchPlaceholder: t('label.search-entity', {
      entity: t('label.resource'),
    }),
    onSearchChange: setSearchText,
    initialSearchQuery: searchText,
  });

  const { quickFilters, filterSelectionDisplay } = useLearningResourceFilters({
    filterState,
    onFilterChange: setFilterState,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterState]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const breadcrumbs = useMemo(
    () => [
      { name: t('label.setting-plural'), url: getSettingPath() },
      {
        name: t('label.preference-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PREFERENCES),
      },
      { name: t('label.learning-resource'), url: '' },
    ],
    [t]
  );

  const paginationData = useMemo(
    () => ({
      paging: { total: paging.total },
      pagingHandler: ({ currentPage: page }: { currentPage: number }) =>
        setCurrentPage(page),
      pageSize,
      currentPage,
      isNumberBased: true,
      isLoading,
      pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
      onShowSizeChange: handlePageSizeChange,
    }),
    [paging.total, pageSize, currentPage, isLoading, handlePageSizeChange]
  );

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('label.content-name'),
        className: 'tw:min-w-0 tw:w-[35%]',
      },
      {
        id: 'categories',
        label: t('label.category-plural'),
        className: 'tw:min-w-0 tw:w-[22%]',
      },
      {
        id: 'context',
        label: t('label.context'),
        className: 'tw:min-w-0 tw:w-[22%]',
      },
      {
        id: 'updatedAt',
        label: t('label.updated-at'),
        className: 'tw:min-w-0 tw:w-[14%]',
      },
      {
        id: 'actions',
        label: t('label.action-plural'),
        className: 'tw:w-[7%] tw:shrink-0',
      },
    ],
    [t]
  );

  const handleRowAction = useCallback(
    (key: Key) => {
      const resource = resources.find((r) => r.id === String(key));
      if (resource) {
        handlePreview(resource);
      }
    },
    [resources, handlePreview]
  );

  const renderCell = useCallback(
    (colId: string, record: LearningResource) => {
      switch (colId) {
        case 'name':
          return (
            <Table.Cell>
              <div className="tw:flex tw:items-center tw:gap-2 tw:overflow-hidden tw:min-w-0">
                {getResourceTypeIcon(record.resourceType)}
                <span
                  className="tw:truncate tw:min-w-0 tw:text-sm tw:font-medium tw:text-primary"
                  title={record.displayName || record.name}>
                  {record.displayName || record.name}
                </span>
              </div>
            </Table.Cell>
          );

        case 'categories':
          return (
            <Table.Cell>
              <div className="tw:flex tw:items-center tw:gap-2 tw:overflow-hidden tw:flex-nowrap tw:min-w-0">
                <div className="tw:flex tw:items-center tw:gap-2 tw:overflow-hidden tw:shrink tw:min-w-0 tw:flex-nowrap">
                  {record.categories?.slice(0, MAX_VISIBLE_TAGS).map((cat) => (
                    <Badge
                      color={CATEGORY_BADGE_COLORS[cat] ?? 'gray'}
                      key={cat}
                      size="sm"
                      type="color">
                      {LEARNING_CATEGORIES[
                        cat as keyof typeof LEARNING_CATEGORIES
                      ]?.label ?? cat}
                    </Badge>
                  ))}
                </div>
                {record.categories &&
                  record.categories.length > MAX_VISIBLE_TAGS && (
                    <Badge color="brand" size="sm" type="color">
                      {`+${record.categories.length - MAX_VISIBLE_TAGS}`}
                    </Badge>
                  )}
              </div>
            </Table.Cell>
          );

        case 'context':
          return (
            <Table.Cell>
              <div className="tw:flex tw:items-center tw:gap-2 tw:overflow-hidden tw:flex-nowrap tw:min-w-0">
                <div className="tw:flex tw:items-center tw:gap-2 tw:overflow-hidden tw:shrink tw:min-w-0 tw:flex-nowrap">
                  {record.contexts
                    ?.slice(0, MAX_VISIBLE_CONTEXTS)
                    .map((ctx, i) => (
                      <Badge
                        color="gray"
                        key={ctx.pageId ?? i}
                        size="sm"
                        type="color">
                        {PAGE_IDS.find((p) => p.value === ctx.pageId)?.label ??
                          ctx.pageId}
                      </Badge>
                    ))}
                </div>
                {record.contexts &&
                  record.contexts.length > MAX_VISIBLE_CONTEXTS && (
                    <Badge color="gray" size="sm" type="color">
                      {`+${record.contexts.length - MAX_VISIBLE_CONTEXTS}`}
                    </Badge>
                  )}
              </div>
            </Table.Cell>
          );

        case 'updatedAt':
          return (
            <Table.Cell>
              <span className="tw:text-sm tw:text-quaternary">
                {record.updatedAt
                  ? DateTime.fromMillis(record.updatedAt).toFormat(
                      'LLL d, yyyy'
                    )
                  : '-'}
              </span>
            </Table.Cell>
          );

        case 'actions':
          return (
            <Table.Cell>
              <div
                className="tw:flex tw:items-center tw:gap-2"
                onClick={(e) => e.stopPropagation()}>
                <ButtonUtility
                  color="secondary"
                  data-testid={`edit-${record.name}`}
                  icon={<IconEdit height={14} width={14} />}
                  size="xs"
                  tooltip={t('label.edit')}
                  onClick={() => handleEdit(record)}
                />
                <ButtonUtility
                  color="secondary"
                  data-testid={`delete-${record.name}`}
                  icon={<Trash01 size={14} />}
                  size="xs"
                  tooltip={t('label.delete')}
                  onClick={() => handleDelete(record)}
                />
              </div>
            </Table.Cell>
          );

        default:
          return <Table.Cell />;
      }
    },
    [t, handleEdit, handleDelete]
  );

  const filtersRow = (
    <div className="tw:shrink-0 tw:p-3">
      <div className="tw:flex tw:items-center tw:gap-3">
        {search}
        {quickFilters}
        <div className="tw:grow" />
        {viewToggle}
      </div>
      {filterSelectionDisplay}
    </div>
  );

  const paginationRow = (
    <div className="tw:shrink-0 tw:p-4 tw:flex tw:justify-center">
      <NextPrevious {...paginationData} />
    </div>
  );

  return (
    <PageLayoutV1
      fullHeight
      mainContainerClassName="learning-resources-page-layout"
      pageTitle={t('label.learning-resource')}>
      <div
        className="tw:flex tw:flex-col tw:h-full tw:min-h-0 tw:overflow-hidden"
        data-testid="learning-resources-page">
        <div className="tw:shrink-0 tw:mb-4">
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </div>

        {/* Header */}
        <div className="tw:shrink-0 tw:flex tw:justify-between tw:items-center tw:mt-2 tw:p-6 tw:mb-4 tw:bg-primary tw:shadow-xs tw:rounded-lg tw:border tw:border-secondary">
          <div className="tw:flex tw:flex-col tw:gap-1">
            <span className="tw:font-semibold tw:text-md tw:text-primary">
              {t('label.learning-resource')}
            </span>
            <span className="tw:text-sm tw:text-quaternary">
              {t('message.learning-resources-management-description')}
            </span>
          </div>

          <Button
            color="primary"
            data-testid="create-resource"
            iconLeading={Plus}
            size="md"
            onClick={handleCreate}>
            {t('label.add-entity', {
              entity: t('label.resource'),
            })}
          </Button>
        </div>

        {/* Table View */}
        {view === 'table' && (
          <TableCard.Root
            className="tw:flex-1 tw:min-h-0 tw:flex tw:flex-col"
            size="sm">
            {filtersRow}

            <div className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:w-full">
              <Table
                aria-label={t('label.learning-resource')}
                className="tw:table-fixed tw:w-full"
                onRowAction={handleRowAction}>
                <Table.Header columns={columns}>
                  {(col) => (
                    <Table.Head
                      className={col.className}
                      id={col.id}
                      label={col.label}
                    />
                  )}
                </Table.Header>

                <Table.Body
                  data-testid="learning-resources-table-body"
                  items={isLoading ? [] : resources}
                  renderEmptyState={() =>
                    isLoading ? (
                      <div className="tw:flex tw:justify-center tw:p-4">
                        <Loader />
                      </div>
                    ) : (
                      <div className="tw:p-4 tw:text-center tw:text-sm tw:text-tertiary">
                        {t('server.no-records-found')}
                      </div>
                    )
                  }>
                  {(record) => (
                    <Table.Row
                      className="tw:cursor-pointer"
                      columns={columns}
                      id={record.id}>
                      {(col) => renderCell(col.id, record)}
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>

            {paginationRow}
          </TableCard.Root>
        )}

        {/* Card View */}
        {view === 'card' && (
          <div className="tw:flex-1 tw:min-h-0 tw:flex tw:flex-col tw:mt-2.5 tw:rounded-xl tw:border tw:border-secondary tw:overflow-hidden tw:bg-primary">
            {filtersRow}

            <div className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:p-3">
              {isLoading ? (
                <Loader />
              ) : (
                <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] tw:gap-4">
                  {resources.map((r) => (
                    <LearningResourceCard
                      key={r.id}
                      resource={r}
                      onClick={handlePreview}
                    />
                  ))}
                </div>
              )}
            </div>

            {paginationRow}
          </div>
        )}

        {isFormOpen && (
          <LearningResourceForm
            open={isFormOpen}
            resource={editingResource}
            onClose={handleFormClose}
          />
        )}

        {selectedResource && (
          <ResourcePlayerModal
            open={isPlayerOpen}
            resource={selectedResource}
            onClose={handlePlayerClose}
          />
        )}

        {deletingResource && (
          <DeleteModalMUI
            entityTitle={deletingResource.displayName || deletingResource.name}
            isDeleting={isDeleting}
            message={t('message.delete-entity-permanently', {
              entityType: t('label.learning-resource'),
            })}
            open={isDeleteModalOpen}
            onCancel={handleDeleteCancel}
            onDelete={handleDeleteConfirm}
          />
        )}
      </div>
    </PageLayoutV1>
  );
};
