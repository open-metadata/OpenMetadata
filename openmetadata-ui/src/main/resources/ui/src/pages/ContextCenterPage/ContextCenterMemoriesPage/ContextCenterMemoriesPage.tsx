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
  Box,
  Button,
  Card,
  Dropdown,
  Input,
  PaginationCardMinimal,
  Tabs,
  Typography
} from '@openmetadata/ui-core-components';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Database01,
  FilterFunnel02,
  Plus,
  SearchLg,
  User03,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import CreateMemoryModal from '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.component';
import MemoriesView from '../../../components/ContextCenter/MemoriesView/MemoriesView.component';
import {
  MemoryFilterTab,
  MemorySortBy,
} from '../../../components/ContextCenter/MemoriesView/MemoriesView.interface';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import DataAssetSelectList from '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList';
import {
  FILTER_TABS,
  MEMORIES_PER_PAGE,
  MEMORY_FIELDS,
} from '../../../constants/ContextCenter.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  ContextMemoryListParams,
  deleteContextMemory,
  getContextMemoryById,
  getContextMemoryByName,
  getListContextMemories,
  pinContextMemory,
  unpinContextMemory,
} from '../../../rest/contextMemoryAPI';
import { getUserAndTeamSearch } from '../../../rest/miscAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getSortConfig } from '../../../utils/ContextCenterPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  MemoryCounts,
  MemoryFilterOption,
  SearchOptionSource,
} from './ContextCenterMemoriesPage.interface';

const FILTER_BUTTON_BASE_CLS =
  'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:px-3' +
  ' tw:py-2 tw:text-sm tw:font-medium tw:shadow-xs tw:ring-1 tw:ring-inset' +
  ' tw:cursor-pointer tw:transition tw:duration-100' +
  ' tw:ease-linear hover:tw:ring-brand tw:outline-hidden tw:whitespace-nowrap';

const FILTER_BUTTON_CLS = `${FILTER_BUTTON_BASE_CLS} tw:bg-primary tw:ring-primary`;
const FILTER_BUTTON_ACTIVE_CLS = `${FILTER_BUTTON_BASE_CLS} tw:bg-utility-brand-50 tw:ring-utility-brand-100`;

const ContextCenterMemoriesPage: FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getResourcePermission } = usePermissionProvider();

  const [memories, setMemories] = useState<ContextMemory[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [memoryCounts, setMemoryCounts] = useState<MemoryCounts>({
    totalVisible: 0,
    pinnedVisible: 0,
    createdByMeVisible: 0,
  });
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(true);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);
  const [isPinningMemoryId, setIsPinningMemoryId] = useState<string>();
  const [memoryToDelete, setMemoryToDelete] = useState<ContextMemory>();
  const [memoryToEdit, setMemoryToEdit] = useState<ContextMemory>();
  const [memoryToView, setMemoryToView] = useState<ContextMemory>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeFilter, setActiveFilter] = useState<MemoryFilterTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<DataAssetOption>();
  const [selectedAuthor, setSelectedAuthor] = useState<MemoryFilterOption>();
  const [authorOptions, setAuthorOptions] = useState<MemoryFilterOption[]>([]);
  const [authorSearch, setAuthorSearch] = useState('');
  const [isAuthorOptionsLoading, setIsAuthorOptionsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<MemorySortBy>('updated');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedAuthorSearch, setDebouncedAuthorSearch] = useState('');
  const isAuthorSearchMounted = useRef(false);

  const SORT_OPTIONS = useMemo(
    () => [
      { id: 'updated', label: t('label.recently-updated') },
      { id: 'usage', label: t('label.most-used') },
      { id: 'updatedBy', label: t('label.updated-by') },
    ],
    [t]
  );

  const { hasCreatePermission, hasDeletePermission, hasEditPermission } =
    useMemo(
      () => ({
        hasCreatePermission: permissions.Create,
        hasDeletePermission: permissions.Delete,
        hasEditPermission: permissions.EditAll,
      }),
      [permissions.Create, permissions.Delete, permissions.EditAll]
    );

  const canDeleteMemory = useMemo(() => {
    const memory = memoryToEdit ?? memoryToView;

    const isOwner =
      memory?.owners?.some((o) => o.name === currentUser?.name) ?? false;

    return hasDeletePermission && (isOwner || Boolean(currentUser?.isAdmin));
  }, [
    hasDeletePermission,
    memoryToEdit,
    memoryToView,
    currentUser?.name,
    currentUser?.isAdmin,
  ]);

  const fetchMemories = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setIsMemoriesLoading(true);
      }
      try {
        const sortConfig = getSortConfig(sortBy);
        const authorFilter =
          activeFilter === 'created-by-me'
            ? currentUser?.id ?? currentUser?.name
            : selectedAuthor?.id;
        const response = await getListContextMemories({
          limit: MEMORIES_PER_PAGE,
          offset: (currentPage - 1) * MEMORIES_PER_PAGE,
          fields: MEMORY_FIELDS,
          q: debouncedSearch.trim() || undefined,
          assets: selectedAsset?.id,
          author: authorFilter,
          pinned: activeFilter === 'pinned' ? true : undefined,
          sortBy: sortConfig.sortBy,
          sortOrder: sortConfig.sortOrder,
        });
        setMemories(response.data ?? []);
        setTotalMemories(response.paging?.total ?? 0);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsMemoriesLoading(false);
      }
    },
    [
      activeFilter,
      currentPage,
      currentUser?.id,
      currentUser?.name,
      debouncedSearch,
      selectedAsset?.id,
      selectedAuthor?.id,
      sortBy,
    ]
  );

  const getVisibleMemoryCount = useCallback(
    async (params?: ContextMemoryListParams) => {
      const response = await getListContextMemories({
        ...params,
        limit: 0,
        offset: 0,
      });

      return response.paging?.total ?? 0;
    },
    []
  );

  const fetchMemoryCounts = useCallback(async () => {
    try {
      const authorFilter = currentUser?.id ?? currentUser?.name;
      const [totalVisible, pinnedVisible, createdByMeVisible] =
        await Promise.all([
          getVisibleMemoryCount(),
          getVisibleMemoryCount({ pinned: true }),
          authorFilter
            ? getVisibleMemoryCount({ author: authorFilter })
            : Promise.resolve(0),
        ]);
      setMemoryCounts({ totalVisible, pinnedVisible, createdByMeVisible });
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [currentUser?.id, currentUser?.name, getVisibleMemoryCount]);

  const fetchAuthorOptions = useCallback(async (query: string) => {
    setIsAuthorOptionsLoading(true);
    try {
      const response = await getUserAndTeamSearch(query, true, 25);
      const options = response.data.hits.hits
        .map((hit): MemoryFilterOption | undefined => {
          const source = hit._source as SearchOptionSource;
          const id = source.name ?? source.id ?? hit._id;
          if (!id) {
            return undefined;
          }

          return {
            id,
            label: getEntityName(source),
            displayName: source.displayName,
            name: source.name,
            type: source.entityType ?? source.type,
          };
        })
        .filter((option): option is MemoryFilterOption => Boolean(option));
      setAuthorOptions(options);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsAuthorOptionsLoading(false);
    }
  }, []);

  const fetchPermission = useCallback(async () => {
    try {
      const response = await getResourcePermission(
        ResourceEntity.CONTEXT_MEMORY
      );
      setPermissions(response);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [getResourcePermission]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchValue), 300);

    return () => clearTimeout(id);
  }, [searchValue]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedAuthorSearch(authorSearch), 300);

    return () => clearTimeout(id);
  }, [authorSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!isAuthorSearchMounted.current) {
      isAuthorSearchMounted.current = true;

      return;
    }
    fetchAuthorOptions(debouncedAuthorSearch);
  }, [debouncedAuthorSearch, fetchAuthorOptions]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    fetchPermission();
    fetchMemoryCounts();
  }, [fetchPermission, fetchMemoryCounts]);

  const totalPages = Math.max(1, Math.ceil(totalMemories / MEMORIES_PER_PAGE));

  const hasActiveFilters = Boolean(selectedAsset || selectedAuthor);

  const handleClearFilters = useCallback(() => {
    setSelectedAsset(undefined);
    setSelectedAuthor(undefined);
    setActiveFilter('all');
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((key: MemoryFilterTab) => {
    setActiveFilter(key);
    if (key === 'all') {
      setSelectedAsset(undefined);
      setSelectedAuthor(undefined);
    }
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
  }, []);

  const handleDeleteMemory = useCallback((memory: ContextMemory) => {
    setMemoryToDelete(memory);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setMemoryToDelete(undefined);
  }, []);

  const handleTogglePin = useCallback(
    async (memory: ContextMemory) => {
      setIsPinningMemoryId(memory.id);
      try {
        memory.pinned
          ? await unpinContextMemory(memory.id)
          : await pinContextMemory(memory.id);
        await fetchMemories(false);
        await fetchMemoryCounts();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsPinningMemoryId(undefined);
      }
    },
    [fetchMemories, fetchMemoryCounts]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!memoryToDelete) {
      return;
    }
    setIsDeletingMemory(true);
    try {
      await deleteContextMemory(memoryToDelete.id);
      showSuccessToast(
        t('server.entity-deleted-success', { entity: t('label.memory') })
      );
      setMemoryToDelete(undefined);
      await fetchMemories();
      await fetchMemoryCounts();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeletingMemory(false);
    }
  }, [memoryToDelete, fetchMemories, fetchMemoryCounts, t]);

  const fetchCompleteMemory = useCallback(async (memory: ContextMemory) => {
    try {
      return await getContextMemoryById(memory.id, MEMORY_FIELDS);
    } catch (err) {
      showErrorToast(err as AxiosError);

      return memory;
    }
  }, []);

  const handleEditMemory = useCallback(
    async (memory: ContextMemory) => {
      const completeMemory = await fetchCompleteMemory(memory);
      setMemoryToEdit(completeMemory);
      setIsViewModalOpen(false);
      setMemoryToView(undefined);
      setIsCreateModalOpen(true);
    },
    [fetchCompleteMemory]
  );

  const handleViewMemory = useCallback(
    async (memory: ContextMemory) => {
      const completeMemory = await fetchCompleteMemory(memory);
      setMemoryToView(completeMemory);
      setIsViewModalOpen(true);
      setSearchParams((prev) => {
        if (completeMemory.name) {
          prev.set('memory', completeMemory.name);
        }

        return prev;
      });
    },
    [fetchCompleteMemory, setSearchParams]
  );

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setMemoryToEdit(undefined);
  }, []);

  const handleViewModalClose = useCallback(() => {
    setIsViewModalOpen(false);
    setMemoryToView(undefined);
    setSearchParams((prev) => {
      prev.delete('memory');

      return prev;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const memoryName = searchParams.get('memory');
    if (!memoryName || isViewModalOpen) {
      return;
    }

    getContextMemoryByName(memoryName, MEMORY_FIELDS)
      .then((memory) => handleViewMemory(memory))
      .catch((err: AxiosError) => {
        showErrorToast(err);
        setSearchParams((prev) => {
          prev.delete('memory');

          return prev;
        });
      });
  }, [isViewModalOpen, searchParams, handleViewMemory, setSearchParams]);

  const handleModalSuccess = useCallback(() => {
    handleModalClose();
    fetchMemories();
    fetchMemoryCounts();
  }, [handleModalClose, fetchMemories, fetchMemoryCounts]);

  const countCards = useMemo(
    () => [
      {
        filterKey: 'all' as const,
        label: t('label.total-memory-plural'),
        value: memoryCounts.totalVisible,
        icon: null,
      },
      {
        filterKey: 'created-by-me' as const,
        label: t('label.created-by-me'),
        value: memoryCounts.createdByMeVisible,
        icon: null,
      },
    ],
    [memoryCounts, t]
  );

  const headerActions = (
    <Button
      color="primary"
      data-testid="add-memory-btn"
      iconLeading={Plus}
      size="sm"
      onClick={() => setIsCreateModalOpen(true)}>
      {t('label.add-entity', { entity: t('label.memory') })}
    </Button>
  );

  return (
    <Box
      className={`tw:w-full tw:h-full tw:bg-secondary tw:p-5 tw:pt-0 tw:overflow-scroll ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-memories-page"
      direction="col">
      <ContextCenterHeader
        actionsSlot={headerActions}
        breadcrumbs={[
          {
            label: t('label.context-center'),
            href: contextCenterClassBase.getContextCenterPath(),
          },
          {
            label: t('label.memory-plural'),
          },
        ]}
        hasPermission={hasCreatePermission}
        searchPlaceholder={t('label.search-memories')}
        searchQuery={searchValue}
        subtitle={t('message.context-center-memories-subtitle')}
        title={t('label.memory-plural')}
        onSearch={handleSearchChange}
      />

      <div className="tw:grid tw:grid-cols-3 tw:gap-6">
        {countCards.map(({ filterKey, label, value, icon }) => {
          const isActive = activeFilter === filterKey;

          return (
            <Card
              className={classNames(
                'tw:group tw:relative tw:p-4 tw:flex tw:flex-col tw:gap-1',
                'tw:cursor-pointer tw:transition-all tw:duration-150 tw:ease-out tw:hover:-translate-y-px',
                { 'tw:bg-utility-blue-50 tw:border-utility-blue-200': isActive }
              )}
              key={filterKey}
              onClick={() => handleFilterChange(filterKey)}>
              <ChevronRight
                className={classNames(
                  'tw:absolute tw:top-3 tw:right-3 tw:text-brand-600 tw:transition-opacity tw:duration-150',
                  {
                    'tw:opacity-100': isActive,
                    'tw:opacity-0 tw:group-hover:opacity-100': !isActive,
                  }
                )}
                size={14}
                strokeWidth={2}
              />
              <Box align="center" className="tw:mb-1" gap={2}>
                {icon}
                <Typography className="tw:text-tertiary" size="text-xs">
                  {label}
                </Typography>
              </Box>
              <Typography size="display-xs" weight="semibold">
                {value}
              </Typography>
            </Card>
          );
        })}
      </div>

      <Box align="center" className="tw:py-5" gap={3} wrap="wrap">
        <Tabs
          className="tw:w-max"
          selectedKey={activeFilter}
          onSelectionChange={(key) =>
            handleFilterChange(key as MemoryFilterTab)
          }>
          <Tabs.List
            className="tw:gap-2"
            items={FILTER_TABS.map((tab) => ({
              id: tab.id,
              label: <div className="tw:leading-4.5">{t(tab.label)}</div>,
            }))}
            type="button-brand">
            {(tab) => (
              <Tabs.Item
                {...tab}
                className={({ isSelected }) =>
                  classNames(
                    'tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-sm tw:font-medium tw:cursor-pointer',
                    {
                      'tw:border-utility-brand-100 tw:bg-brand-primary_alt tw:text-brand-secondary':
                        isSelected,
                      'tw:border-primary tw:bg-primary tw:text-secondary':
                        !isSelected,
                    }
                  )
                }
              />
            )}
          </Tabs.List>
        </Tabs>

        <Box align="center" gap={2}>
           <DataAssetSelectList
            allowAllOption
            popoverPlacement="bottom"
            renderTrigger={({ open }) => (
              <AriaButton
                className={classNames(
                  selectedAsset ? FILTER_BUTTON_ACTIVE_CLS : FILTER_BUTTON_CLS
                )}
                onPress={open}>
                <Database01
                  className={classNames('tw:shrink-0', {
                    'tw:text-brand-secondary': selectedAsset,
                    'tw:text-secondary': !selectedAsset,
                  })}
                  size={14}
                />
                <div className="tw:max-w-50">
                  <Typography
                    ellipsis
                    className={
                      selectedAsset
                        ? 'tw:text-utility-brand-700'
                        : 'tw:text-secondary'
                    }
                    weight="medium">
                    {selectedAsset?.label ??
                      t('label.all-entity', {
                        entity: t('label.asset-plural'),
                      })}
                  </Typography>
                </div>
                <ChevronDown
                  className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
                  size={16}
                  strokeWidth={2.5}
                />
              </AriaButton>
            )}
            selectionMode = "single"
            value={selectedAsset}
            onChange={(value) => {
              setSelectedAsset(value as DataAssetOption);
              if (activeFilter === 'all') {
                setActiveFilter('');
              }
              setCurrentPage(1);
            }}
          />

          <Dropdown.Root
            onOpenChange={(isOpen) => {
              if (isOpen) {
                setAuthorSearch('');
                fetchAuthorOptions('');
              }
            }}>
            <AriaButton
              className={
                selectedAuthor ? FILTER_BUTTON_ACTIVE_CLS : FILTER_BUTTON_CLS
              }>
              <User03
                className={classNames('tw:shrink-0', {
                  'tw:text-brand-secondary': selectedAuthor,
                  'tw:text-secondary': !selectedAuthor,
                })}
                size={14}
              />
              <div className="tw:max-w-50">
                <Typography
                  ellipsis
                  className={
                    selectedAuthor
                      ? 'tw:text-brand-secondary'
                      : 'tw:text-secondary'
                  }
                  weight="medium">
                  {selectedAuthor?.label ??
                    t('label.all-entity', { entity: t('label.author') })}
                </Typography>
              </div>
              <ChevronDown
                className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
                size={16}
                strokeWidth={2.5}
              />
            </AriaButton>
            <Dropdown.Popover>
              <div className="tw:p-2 tw:border-b tw:border-secondary">
                <Input
                  autoFocus
                  className="tw:w-full"
                  icon={SearchLg}
                  placeholder={t('label.search-entity', {
                    entity: t('label.author'),
                  })}
                  value={authorSearch}
                  onChange={(value) => {
                    setAuthorSearch(value);
                  }}
                />
              </div>
              <Dropdown.Menu
                selectedKeys={selectedAuthor ? [selectedAuthor.id] : []}
                selectionMode="single"
                onAction={(key) => {
                  const next = String(key);
                  if (next === 'all-authors') {
                    setSelectedAuthor(undefined);
                  } else {
                    const option = authorOptions.find((opt) => opt.id === next);
                    setSelectedAuthor(
                      next === selectedAuthor?.id ? undefined : option
                    );
                  }
                  if (activeFilter === 'all') {
                    setActiveFilter('');
                  }
                  setCurrentPage(1);
                }}>
                <Dropdown.Item
                  id="all-authors"
                  key="all-authors"
                  textValue={t('label.all-entity', {
                    entity: t('label.author'),
                  })}>
                  <span>
                    {t('label.all-entity', { entity: t('label.author') })}
                  </span>
                </Dropdown.Item>
                {isAuthorOptionsLoading && (
                  <Dropdown.Item
                    id="loading-authors"
                    textValue={t('label.loading')}>
                    <span>{t('label.loading')}</span>
                  </Dropdown.Item>
                )}
                {authorOptions.map((opt) => (
                  <Dropdown.Item id={opt.id} key={opt.id} textValue={opt.label}>
                    <Box align="center" gap={2} justify="between">
                      {opt.id && <ProfilePicture name={opt.id} size={20} />}
                      <span className="tw:flex-1">{opt.label}</span>
                      {selectedAuthor?.id === opt.id && (
                        <Check
                          className="tw:shrink-0 tw:text-brand-600"
                          size={14}
                          strokeWidth={2.5}
                        />
                      )}
                    </Box>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
              {authorOptions.length === 0 && (
                <Box
                  align="center"
                  className="tw:pb-4 tw:pt-1.5"
                  justify="center">
                  <Typography className="tw:text-quaternary" size="text-xs">
                    {t('label.no-data-found')}
                  </Typography>
                </Box>
              )}
            </Dropdown.Popover>
          </Dropdown.Root>
        </Box>

        <Box align="center" className="tw:ml-auto" gap={4}>
          {hasActiveFilters && (
            <Button color="link-color" size="sm" onClick={handleClearFilters}>
              {t('label.clear-entity', { entity: t('label.all') })}
            </Button>
          )}
          <Dropdown.Root>
            <AriaButton className={FILTER_BUTTON_CLS}>
              <FilterFunnel02 size={16} />
              <Typography className="tw:text-secondary" weight="medium">
                {t('label.sort')}:
              </Typography>
              <Typography className="tw:text-secondary" weight="medium">
                {SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? ''}
              </Typography>
            </AriaButton>
            <Dropdown.Popover className="tw:w-56">
              <Dropdown.Menu
                selectedKeys={[sortBy]}
                selectionMode="single"
                onAction={(key) => {
                  setSortBy((key as MemorySortBy) ?? 'updated');
                  setCurrentPage(1);
                }}>
                {SORT_OPTIONS.map((opt) => (
                  <Dropdown.Item id={opt.id} key={opt.id} label={opt.label} />
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </Box>
      </Box>
      {/* Memories card with tabs */}
      <Card
        className="tw:flex tw:flex-col tw:h-auto"
        style={{ overflow: 'unset' }}>
        <div>
          <MemoriesView
            canDelete={hasDeletePermission}
            canEdit={hasEditPermission}
            currentUserName={currentUser?.name}
            data={memories}
            isAdminUser={currentUser?.isAdmin}
            isLoading={isMemoriesLoading}
            isPinningMemoryId={isPinningMemoryId}
            onDeleteMemory={handleDeleteMemory}
            onEditMemory={handleEditMemory}
            onTogglePin={handleTogglePin}
            onViewMemory={handleViewMemory}
          />
        </div>

        <PaginationCardMinimal
          page={currentPage}
          total={totalPages}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Edit / Create modal */}
      <CreateMemoryModal
        canCreate={hasCreatePermission}
        canDelete={canDeleteMemory}
        canEdit={hasEditPermission}
        currentUserName={currentUser?.name}
        isAdminUser={currentUser?.isAdmin}
        isOpen={isCreateModalOpen}
        memoryToEdit={memoryToEdit}
        onClose={handleModalClose}
        onCreated={handleModalSuccess}
        onDeleted={handleModalSuccess}
        onUpdated={handleModalSuccess}
      />

      {/* View-only modal */}
      {memoryToView && (
        <CreateMemoryModal
          viewOnly
          canDelete={canDeleteMemory}
          canEdit={hasEditPermission}
          currentUserName={currentUser?.name}
          isAdminUser={currentUser?.isAdmin}
          isOpen={isViewModalOpen}
          memoryToEdit={memoryToView}
          onClose={handleViewModalClose}
          onCreated={handleViewModalClose}
          onDeleted={handleModalSuccess}
          onEditMemory={handleEditMemory}
          onUpdated={handleModalSuccess}
        />
      )}

      {memoryToDelete && (
        <DeleteModal
          entityTitle={memoryToDelete.title ?? memoryToDelete.question ?? ''}
          isDeleting={isDeletingMemory}
          message={t('message.delete-entity-permanently', {
            entityType: t('label.memory-lowercase'),
          })}
          open={Boolean(memoryToDelete)}
          onCancel={handleCancelDelete}
          onDelete={handleConfirmDelete}
        />
      )}
    </Box>
  );
};

export default ContextCenterMemoriesPage;
