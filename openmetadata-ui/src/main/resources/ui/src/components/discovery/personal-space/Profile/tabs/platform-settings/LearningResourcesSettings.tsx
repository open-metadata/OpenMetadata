/*
 *  Copyright 2023 Collate.
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

/* eslint-disable openmetadata-imports/no-lower-layer-page-imports -- reuses the classic page's data hooks */
import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Grid,
  Input,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Edit01,
  Plus,
  Search,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { debounce } from 'lodash';
import { DateTime } from 'luxon';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import {
  MAX_VISIBLE_CONTEXTS,
  MAX_VISIBLE_TAGS,
  PAGE_IDS,
} from '../../../../../../constants/Learning.constants';
import { VIEW_MODE_PAGE } from '../../../../../../constants/platform/personaAppLayout.constants';
import { PageViewMode } from '../../../../../../generated/type/personaPreferences';
import { usePersonaViewMode } from '../../../../../../hooks/platform/usePersonaViewMode';
import { useLearningResourceActions } from '../../../../../../pages/LearningResourcesPage/hooks/useLearningResourceActions';
import {
  LearningResourceFilterState,
  useLearningResourceFilters,
} from '../../../../../../pages/LearningResourcesPage/hooks/useLearningResourceFilters';
import { useLearningResources } from '../../../../../../pages/LearningResourcesPage/hooks/useLearningResources';
import { LearningResource } from '../../../../../../rest/learningResourceAPI';
import { DeleteModal } from '../../../../../common/DeleteModal/DeleteModal';
import NextPrevious from '../../../../../common/NextPrevious/NextPrevious';
import ViewToggle from '../../../../../common/ViewToggle/ViewToggle';
import {
  CATEGORY_BADGE_COLORS,
  LEARNING_CATEGORIES,
  ResourceCategory,
} from '../../../../../Learning/Learning.interface';
import { LearningResourceCard } from '../../../../../Learning/LearningResourceCard/LearningResourceCard.component';
import { ResourceTypeIcon } from '../../../../../Learning/ResourceTypeIcon/ResourceTypeIcon';
import { getInitialLearningListState } from './LearningResourceSettings.utils';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';

const CARD_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
};

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_ID = 'learning-resources';

const getCategoryLabel = (category: string) =>
  LEARNING_CATEGORIES[category as ResourceCategory]?.label ?? category;

const getCategoryColor = (category: string) =>
  CATEGORY_BADGE_COLORS[category as ResourceCategory] ?? 'gray';

const getContextLabel = (pageId: string) =>
  PAGE_IDS.find((page) => page.value === pageId)?.label ?? pageId;

const BadgeList = ({
  labels,
  max,
  color,
}: {
  labels: { key: string; label: string; color: string }[];
  max: number;
  color: string;
}) => (
  <Box align="center" className="tw:min-w-0 tw:gap-1.5 tw:overflow-hidden">
    {labels.slice(0, max).map((item) => (
      <Badge color={item.color as 'gray'} key={item.key} size="sm" type="color">
        {item.label}
      </Badge>
    ))}
    {labels.length > max && (
      <Badge color={color as 'gray'} size="sm" type="color">
        {`+${labels.length - max}`}
      </Badge>
    )}
  </Box>
);

const LearningResourcesSettings = ({
  onNavigate,
  onSetHeaderActions,
  savedState,
  onSaveState,
}: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  // Restored after previewing a resource, so the list is where the user left it.
  const [initial] = useState(() => getInitialLearningListState(savedState));
  const [searchText, setSearchText] = useState(initial.searchText);
  const [searchInput, setSearchInput] = useState(initial.searchText);
  const [filterState, setFilterState] = useState<LearningResourceFilterState>(
    initial.filterState
  );
  const [currentPage, setCurrentPage] = useState(initial.currentPage);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  const { resources, paging, isLoading, refetch } = useLearningResources({
    searchText,
    filterState,
    pageSize,
    currentPage,
  });
  const {
    isDeleteModalOpen,
    isDeleting,
    deletingResource,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useLearningResourceActions({ onRefetch: refetch });
  const { quickFilters, filterSelectionDisplay } = useLearningResourceFilters({
    filterState,
    onFilterChange: setFilterState,
  });

  const personaView = usePersonaViewMode(VIEW_MODE_PAGE.LearningResources);
  const [selectedView, setSelectedView] = useState<PageViewMode | undefined>(
    initial.selectedView
  );
  const view = selectedView ?? personaView;

  const debouncedSearch = useMemo(
    () => debounce(setSearchText, SEARCH_DEBOUNCE_MS),
    []
  );
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // A new search or filter starts from page 1. Compared with the previous
  // values rather than skipping the first run, so a restored page survives
  // mount — including StrictMode's mount, unmount, mount in development.
  const lastQuery = useRef({ searchText, filterState });
  useEffect(() => {
    if (
      lastQuery.current.searchText === searchText &&
      lastQuery.current.filterState === filterState
    ) {
      return;
    }
    lastQuery.current = { searchText, filterState };
    setCurrentPage(1);
  }, [searchText, filterState]);

  useEffect(() => {
    onSaveState?.({
      searchText,
      filterState,
      currentPage,
      pageSize,
      selectedView,
    });
  }, [
    searchText,
    filterState,
    currentPage,
    pageSize,
    selectedView,
    onSaveState,
  ]);

  const openResource = (resource: LearningResource) =>
    onNavigate({
      type: 'page',
      page: PAGE_ID,
      isEditing: false,
      itemId: resource.id,
    });

  const openForm = (resource?: LearningResource) =>
    onNavigate({
      type: 'page',
      page: PAGE_ID,
      isEditing: true,
      ...(resource ? { itemId: resource.id } : {}),
    });

  useEffect(() => {
    onSetHeaderActions(
      <Button
        color="primary"
        data-testid="create-resource"
        iconLeading={Plus}
        size="xs"
        onPress={() =>
          onNavigate({
            type: 'page',
            page: PAGE_ID,
            isEditing: true,
          })
        }>
        {t('label.add-entity', { entity: t('label.resource') })}
      </Button>
    );

    return () => onSetHeaderActions(undefined);
  }, [onNavigate, onSetHeaderActions, t]);

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.content-name') },
      {
        id: 'categories',
        label: t('label.category-plural'),
        className: 'tw:w-52',
      },
      { id: 'context', label: t('label.context'), className: 'tw:w-52' },
      { id: 'updated', label: t('label.updated-at'), className: 'tw:w-32' },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-24' },
    ],
    [t]
  );

  const renderCell = (record: LearningResource, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <Box align="center" className="tw:min-w-0" gap={2}>
            <ResourceTypeIcon resourceType={record.resourceType} />
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
        return (
          <BadgeList
            color="brand"
            labels={(record.categories ?? []).map((category) => ({
              key: category,
              label: getCategoryLabel(category),
              color: getCategoryColor(category),
            }))}
            max={MAX_VISIBLE_TAGS}
          />
        );
      case 'context':
        return (
          <BadgeList
            color="gray"
            labels={(record.contexts ?? []).map((context, index) => ({
              key: context.pageId ?? String(index),
              label: getContextLabel(context.pageId),
              color: 'gray',
            }))}
            max={MAX_VISIBLE_CONTEXTS}
          />
        );
      case 'updated':
        return (
          <Typography as="span" className="tw:text-tertiary" size="text-sm">
            {record.updatedAt
              ? DateTime.fromMillis(record.updatedAt).toFormat('LLL d, yyyy')
              : '-'}
          </Typography>
        );
      default:
        return (
          <Box gap={1}>
            <ButtonUtility
              color="tertiary"
              data-testid={`edit-${record.name}`}
              icon={Edit01}
              size="xs"
              tooltip={t('label.edit')}
              onPress={() => openForm(record)}
            />
            <ButtonUtility
              color="tertiary"
              data-testid={`delete-${record.name}`}
              icon={Trash01}
              size="xs"
              tooltip={t('label.delete')}
              onPress={() => handleDelete(record)}
            />
          </Box>
        );
    }
  };

  const pagination = (
    <Box className="tw:shrink-0 tw:justify-center tw:border-t tw:border-secondary tw:p-2">
      <NextPrevious
        isNumberBased
        currentPage={currentPage}
        isLoading={isLoading}
        pageSize={pageSize}
        pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
        paging={{ total: paging.total }}
        pagingHandler={({ currentPage: page }) => setCurrentPage(page)}
        onShowSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />
    </Box>
  );

  return (
    <Box data-testid="learning-resources-settings" direction="col">
      <TableCard.Root className="tw:flex tw:flex-col" size="sm" variant="muted">
        <Box className="tw:shrink-0 tw:p-3" direction="col" gap={2}>
          <Box align="center" gap={2} wrap="wrap">
            <Input
              className="tw:max-w-72"
              data-testid="search-resources"
              icon={Search}
              placeholder={t('label.search-entity', {
                entity: t('label.resource'),
              })}
              value={searchInput}
              onChange={(value) => {
                setSearchInput(value);
                debouncedSearch(value);
              }}
            />
            {quickFilters}
            <Box className="tw:flex-1" />
            <ViewToggle value={view} onChange={setSelectedView} />
          </Box>
          {filterSelectionDisplay}
        </Box>

        {view === PageViewMode.Card ? (
          <Box className="tw:p-3" direction="col">
            {isLoading ? (
              <SettingsSkeleton rows={4} variant="default" />
            ) : (
              <Grid gap="4" style={CARD_GRID_STYLE}>
                {resources.map((resource) => (
                  <LearningResourceCard
                    key={resource.id}
                    resource={resource}
                    onClick={openResource}
                  />
                ))}
              </Grid>
            )}
          </Box>
        ) : (
          <Table
            aria-label={t('label.learning-resource')}
            data-testid="learning-resources-table"
            size="sm">
            <Table.Header columns={columns}>
              {(column) => (
                <Table.Head
                  className={column.className}
                  id={column.id}
                  isRowHeader={column.id === 'name'}
                  key={column.id}
                  label={column.label}
                />
              )}
            </Table.Header>
            <Table.Body
              items={isLoading ? [] : resources}
              renderEmptyState={() => (
                <Box className="tw:justify-center tw:py-12">
                  {isLoading ? (
                    <SettingsSkeleton rows={3} variant="default" />
                  ) : (
                    <Typography className="tw:text-tertiary" size="text-sm">
                      {t('server.no-records-found')}
                    </Typography>
                  )}
                </Box>
              )}>
              {(record) => (
                <Table.Row
                  columns={columns}
                  data-testid={record.name}
                  id={record.id}
                  key={record.id}
                  onAction={() => openResource(record)}>
                  {(column) => (
                    <Table.Cell className={column.className} key={column.id}>
                      {renderCell(record, column.id)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
        {pagination}
      </TableCard.Root>

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
  );
};

export default LearningResourcesSettings;
