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
import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Grid,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/ic_video.svg';
import { useSearch } from '../../components/common/atoms/navigation/useSearch';
import { useViewToggle } from '../../components/common/atoms/navigation/useViewToggle';
import { DeleteModal } from '../../components/common/DeleteModal/DeleteModal';
import Loader from '../../components/common/Loader/Loader';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import {
  CATEGORY_BADGE_COLORS,
  LEARNING_CATEGORIES,
  ResourceCategory,
} from '../../components/Learning/Learning.interface';
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

const CARD_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

const RESOURCE_TYPE_ICONS: Record<
  string,
  React.FunctionComponent<React.SVGProps<SVGSVGElement>>
> = {
  Video: VideoIcon,
  Storylane: StoryLaneIcon,
};

const getResourceTypeIcon = (type: string) => {
  const Icon = RESOURCE_TYPE_ICONS[type] ?? VideoIcon;

  return (
    <Box
      align="center"
      className="tw:size-8 tw:shrink-0 tw:justify-center tw:rounded-md">
      <Icon height={24} width={24} />
    </Box>
  );
};

const getCategoryLabel = (category: string) =>
  LEARNING_CATEGORIES[category as ResourceCategory]?.label ?? category;

const getCategoryColor = (category: string) =>
  CATEGORY_BADGE_COLORS[category as ResourceCategory] ?? 'gray';

const getContextLabel = (pageId: string) =>
  PAGE_IDS.find((p) => p.value === pageId)?.label ?? pageId;

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

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.content-name'), width: 360 },
      { id: 'categories', label: t('label.category-plural'), width: 220 },
      { id: 'context', label: t('label.context'), width: 220 },
      { id: 'updated', label: t('label.updated-at'), width: 140 },
      { id: 'actions', label: t('label.action-plural'), width: 100 },
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

  const renderCategoriesCell = (record: LearningResource) => {
    const categories = record.categories ?? [];
    const remaining = categories.length - MAX_VISIBLE_TAGS;

    return (
      <Box align="center" className="tw:min-w-0 tw:gap-1.5 tw:overflow-hidden">
        {categories.slice(0, MAX_VISIBLE_TAGS).map((cat) => (
          <Badge color={getCategoryColor(cat)} key={cat} size="sm" type="color">
            {getCategoryLabel(cat)}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge color="brand" size="sm" type="color">
            +{remaining}
          </Badge>
        )}
      </Box>
    );
  };

  const renderContextCell = (record: LearningResource) => {
    const contexts = record.contexts ?? [];
    const remaining = contexts.length - MAX_VISIBLE_CONTEXTS;

    return (
      <Box align="center" className="tw:min-w-0 tw:gap-1.5 tw:overflow-hidden">
        {contexts.slice(0, MAX_VISIBLE_CONTEXTS).map((ctx, i) => (
          <Badge color="gray" key={ctx.pageId ?? i} size="sm" type="color">
            {getContextLabel(ctx.pageId)}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge color="gray" size="sm" type="color">
            +{remaining}
          </Badge>
        )}
      </Box>
    );
  };

  const renderActionsCell = (record: LearningResource) => (
    <Box gap={2}>
      <ButtonUtility
        aria-label={t('label.edit')}
        color="secondary"
        data-testid={`edit-${record.name}`}
        icon={<IconEdit height={14} width={14} />}
        size="xs"
        tooltip={t('label.edit')}
        onClick={() => handleEdit(record)}
      />
      <ButtonUtility
        aria-label={t('label.delete')}
        color="secondary"
        data-testid={`delete-${record.name}`}
        icon={<Trash01 size={14} />}
        size="xs"
        tooltip={t('label.delete')}
        onClick={() => handleDelete(record)}
      />
    </Box>
  );

  const renderCell = (record: LearningResource, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <Box align="center" className="tw:min-w-0" gap={2}>
            {getResourceTypeIcon(record.resourceType)}
            <Typography
              ellipsis
              as="span"
              className="tw:min-w-0 tw:text-secondary"
              size="text-sm"
              title={record.displayName || record.name}
              weight="medium">
              {record.displayName || record.name}
            </Typography>
          </Box>
        );
      case 'categories':
        return renderCategoriesCell(record);
      case 'context':
        return renderContextCell(record);
      case 'updated':
        return (
          <Typography as="span" className="tw:text-tertiary" size="text-sm">
            {record.updatedAt
              ? DateTime.fromMillis(record.updatedAt).toFormat('LLL d, yyyy')
              : '-'}
          </Typography>
        );
      case 'actions':
        return renderActionsCell(record);
      default:
        return null;
    }
  };

  const renderEmptyState = () =>
    isLoading ? (
      <Box className="tw:justify-center tw:py-12">
        <Loader />
      </Box>
    ) : (
      <Box className="tw:justify-center tw:py-12">
        <Typography as="span" className="tw:text-tertiary" size="text-sm">
          {t('server.no-records-found')}
        </Typography>
      </Box>
    );

  return (
    <PageLayoutV1
      fullHeight
      mainContainerClassName="learning-resources-page-layout"
      pageContainerStyle={{
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
      pageTitle={t('label.learning-resource')}>
      <Box
        className="tw:h-full tw:min-h-0 tw:overflow-hidden tw:px-0.5"
        data-testid="learning-resources-page"
        direction="col">
        <Box className="tw:mb-2 tw:shrink-0">
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Box>

        <Box
          align="center"
          className="tw:mt-1 tw:mb-2 tw:shrink-0 tw:justify-between tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-6 tw:shadow-xs">
          <Box className="tw:gap-1" direction="col">
            <Typography
              className="tw:text-primary"
              size="text-md"
              weight="semibold">
              {t('label.learning-resource')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.learning-resources-management-description')}
            </Typography>
          </Box>

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
        </Box>

        <TableCard.Root className="tw:mt-2.5 tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
          <Box className="tw:shrink-0 tw:p-3" direction="col" gap={2}>
            <Box align="center" gap={2}>
              {search}
              {quickFilters}
              <Box className="tw:flex-1" />
              {viewToggle}
            </Box>
            {filterSelectionDisplay}
          </Box>

          {view === 'table' && (
            <>
              <Table
                stickyHeader
                aria-label={t('label.learning-resource')}
                containerStyle={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
                data-testid="learning-resources-table-body">
                <Table.Header columns={columns}>
                  {(col) => (
                    <Table.Head
                      id={col.id}
                      key={col.id}
                      label={col.label}
                      width={col.width}
                    />
                  )}
                </Table.Header>
                <Table.Body
                  items={isLoading ? [] : resources}
                  renderEmptyState={renderEmptyState}>
                  {(record) => (
                    <Table.Row
                      columns={columns}
                      data-testid={record.name}
                      id={record.id}
                      key={record.id}
                      onAction={() => handlePreview(record)}>
                      {(col) => (
                        <Table.Cell key={col.id}>
                          {renderCell(record, col.id)}
                        </Table.Cell>
                      )}
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>

              <Box className="tw:shrink-0 tw:justify-center tw:border-t tw:border-secondary tw:p-2">
                <NextPrevious {...paginationData} />
              </Box>
            </>
          )}

          {view === 'card' && (
            <>
              <Box
                className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-3"
                direction="col">
                {isLoading ? (
                  <Loader />
                ) : (
                  <Grid gap="4" style={CARD_GRID_STYLE}>
                    {resources.map((r) => (
                      <LearningResourceCard
                        key={r.id}
                        resource={r}
                        onClick={handlePreview}
                      />
                    ))}
                  </Grid>
                )}
              </Box>

              <Box className="tw:shrink-0 tw:justify-center tw:border-t tw:border-secondary tw:p-2">
                <NextPrevious {...paginationData} />
              </Box>
            </>
          )}
        </TableCard.Root>

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
          <DeleteModal
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
      </Box>
    </PageLayoutV1>
  );
};
