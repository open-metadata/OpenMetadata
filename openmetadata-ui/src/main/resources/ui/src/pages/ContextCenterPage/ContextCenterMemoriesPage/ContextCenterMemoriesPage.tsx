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
  PaginationCardMinimal,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
  Database01,
  FilterFunnel02,
  Pin01,
  Plus,
  User03
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import AlertBar from '../../../components/AlertBar/AlertBar';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import CreateMemoryModal from '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.component';
import MemoriesView from '../../../components/ContextCenter/MemoriesView/MemoriesView.component';
import {
  MemoryFilterTab,
  MemorySortBy,
} from '../../../components/ContextCenter/MemoriesView/MemoriesView.interface';
import DataAssetFilterPopover from '../../../components/DataAssets/DataAssetSelectList/DataAssetFilterPopover';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  ContextMemory,
  MemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { useAlertStore } from '../../../hooks/useAlertStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deleteContextMemory,
  getListContextMemories,
} from '../../../rest/contextMemoryAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const MEMORIES_PER_PAGE = 10;
const MEMORY_FIELDS =
  'owners,tags,domains,primaryEntity,relatedEntities,sourceEntity';

const FILTER_TABS = [
  { id: 'all', label: 'label.all' },
  { id: 'created-by-me', label: 'label.created-by-me' },
  { id: 'pinned', label: 'label.pinned', icon: Pin01 },
  // { id: 'needs-review', label: 'label.needs-review' },
] as const;

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
  const { alert } = useAlertStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getResourcePermission } = usePermissionProvider();

  const [memories, setMemories] = useState<ContextMemory[]>([]);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(true);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<ContextMemory>();
  const [memoryToEdit, setMemoryToEdit] = useState<ContextMemory>();
  const [memoryToView, setMemoryToView] = useState<ContextMemory>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeFilter, setActiveFilter] = useState<MemoryFilterTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [sortBy, setSortBy] = useState<MemorySortBy>('updated');

  const SORT_OPTIONS = useMemo(
    () => [
      { id: 'updated', label: t('label.recently-updated') },
      { id: 'usage', label: t('label.most-used') },
      { id: 'author', label: t('label.author-a-z') },
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

  const fetchMemories = useCallback(async () => {
    setIsMemoriesLoading(true);
    try {
      const response = await getListContextMemories({
        limit: 1000,
        fields: MEMORY_FIELDS,
      });
      setMemories(response.data ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMemoriesLoading(false);
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
    fetchMemories();
    fetchPermission();
  }, [fetchMemories, fetchPermission]);

  const assetOptions = useMemo(() => {
    const seen = new Map<
      string,
      { name: string; displayName: string; type: string }
    >();

    const addRef = (ref: {
      fullyQualifiedName?: string;
      id?: string;
      name?: string;
      displayName?: string;
      type?: string;
    }) => {
      const fqn = ref.fullyQualifiedName ?? ref.id;
      if (fqn && !seen.has(fqn)) {
        seen.set(fqn, {
          name: ref.name ?? fqn,
          displayName: ref.displayName ?? ref.name ?? fqn,
          type: ref.type ?? '',
        });
      }
    };

    memories.forEach((m) => {
      if (m.primaryEntity) {
        addRef(m.primaryEntity);
      }
      m.relatedEntities?.forEach(addRef);
    });

    return Array.from(seen.entries())
      .sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName))
      .map(([fqn, meta]) => ({
        id: fqn,
        label: meta.displayName,
        displayName: meta.displayName,
        type: meta.type,
      }));
  }, [memories]);

  const authorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    memories.forEach((m) => {
      const owner = m.owners?.[0];
      if (owner?.name) {
        seen.set(owner.name, owner.displayName ?? owner.name);
      }
    });

    return [
      ...Array.from(seen.entries())
        .sort(([, a], [, b]) => a.localeCompare(b))
        .map(([name, displayName]) => ({ id: name, label: displayName })),
    ];
  }, [memories, t]);

  const filteredMemories = useMemo(() => {
    let list = memories;

    if (activeFilter === 'created-by-me') {
      list = list.filter((m) =>
        m.owners?.some((o) => o.name === currentUser?.name)
      );
    } else if (activeFilter === 'pinned') {
      list = list.filter(
        (m) => m.status === MemoryStatus.Active && (m.usageCount ?? 0) > 0
      );
    } else if (activeFilter === 'needs-review') {
      list = list.filter((m) => m.status === MemoryStatus.Draft);
    }

    if (selectedAsset) {
      list = list.filter((m) => {
        const primaryFqn =
          m.primaryEntity?.fullyQualifiedName ?? m.primaryEntity?.id;
        if (primaryFqn === selectedAsset) {
          return true;
        }

        return m.relatedEntities?.some(
          (ref) => (ref.fullyQualifiedName ?? ref.id) === selectedAsset
        );
      });
    }

    if (selectedAuthor) {
      list = list.filter((m) =>
        m.owners?.some((o) => o.name === selectedAuthor)
      );
    }

    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      list = list.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.summary?.toLowerCase().includes(q) ||
          m.question?.toLowerCase().includes(q) ||
          m.answer?.toLowerCase().includes(q)
      );
    }

    // Client-side sort
    const sorted = [...list];
    if (sortBy === 'updated') {
      sorted.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    } else if (sortBy === 'usage') {
      sorted.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    } else if (sortBy === 'author') {
      sorted.sort((a, b) =>
        (a.owners?.[0]?.displayName ?? a.owners?.[0]?.name ?? '').localeCompare(
          b.owners?.[0]?.displayName ?? b.owners?.[0]?.name ?? ''
        )
      );
    }

    return sorted;
  }, [
    memories,
    activeFilter,
    selectedAsset,
    selectedAuthor,
    searchValue,
    sortBy,
    currentUser,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMemories.length / MEMORIES_PER_PAGE)
  );

  const pagedMemories = useMemo(() => {
    const start = (currentPage - 1) * MEMORIES_PER_PAGE;

    return filteredMemories.slice(start, start + MEMORIES_PER_PAGE);
  }, [filteredMemories, currentPage]);

  const hasActiveFilters = Boolean(selectedAsset || selectedAuthor);

  const handleClearFilters = useCallback(() => {
    setSelectedAsset('');
    setSelectedAuthor('');
    setActiveFilter('all');
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((key: MemoryFilterTab) => {
    setActiveFilter(key);
    if (key === 'all') {
      setSelectedAsset('');
      setSelectedAuthor('');
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
      fetchMemories();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeletingMemory(false);
    }
  }, [memoryToDelete, fetchMemories, t]);

  const handleEditMemory = useCallback((memory: ContextMemory) => {
    setMemoryToEdit(memory);
    setIsViewModalOpen(false);
    setMemoryToView(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewMemory = useCallback(
    (memory: ContextMemory) => {
      setMemoryToView(memory);
      setIsViewModalOpen(true);
      setSearchParams((prev) => {
        if (memory.name) {
          prev.set('memory', memory.name);
        }

        return prev;
      });
    },
    [setSearchParams]
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
    if (!memoryName || isMemoriesLoading || isViewModalOpen) {
      return;
    }
    const match = memories.find((m) => m.name === memoryName);
    if (match) {
      handleViewMemory(match);
    } else {
      showErrorToast(
        `${t('message.no-entity-available-with-name', {
          entity: t('label.memory'),
        })} "${memoryName}"`
      );
      setSearchParams((prev) => {
        prev.delete('memory');

        return prev;
      });
    }
  }, [
    memories,
    isMemoriesLoading,
    isViewModalOpen,
    searchParams,
    handleViewMemory,
    t,
    setSearchParams,
  ]);

  const handleModalSuccess = useCallback(() => {
    handleModalClose();
    fetchMemories();
  }, [handleModalClose, fetchMemories]);

  const createdByMeCount = memories.filter((m) =>
    m.owners?.some((o) => o.name === currentUser?.name)
  ).length;

  const statsCards = useMemo(
    () => [
      {
        filterKey: 'all' as const,
        label: t('label.total-memory-plural'),
        value: memories.length,
        icon: null,
      },
      {
        filterKey: 'pinned' as const,
        label: t('label.pinned'),
        value: memories.filter(
          (m) => m.status === MemoryStatus.Active && (m.usageCount ?? 0) > 0
        ).length,
        icon: <Pin01 className="tw:text-brand-600" size={12} strokeWidth={2} />,
      },
      {
        filterKey: 'created-by-me' as const,
        label: t('label.created-by-me'),
        value: createdByMeCount,
        icon: null,
      },
    ],
    [memories, createdByMeCount, t]
  );
  const totalUsageCount = memories.reduce(
    (sum, m) => sum + (m.usageCount ?? 0),
    0
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
      {alert && <AlertBar message={alert.message} type={alert.type} />}
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

      {/* Stats cards — clickable filters */}
      <div className="tw:grid tw:grid-cols-4 tw:gap-6">
        {statsCards.map(({ filterKey, label, value, icon }) => {
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

        {/* Non-interactive usage card */}
        <Card className="tw:p-4 tw:flex tw:flex-col tw:gap-1">
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('label.cited-in-chats')}
          </Typography>
          <Typography size="display-xs" weight="semibold">
            {totalUsageCount}
          </Typography>
        </Card>
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
              label:
                'icon' in tab ? (
                  <Box align="center" className="tw:gap-1.5 tw:leading-4.5">
                    <tab.icon size={12} strokeWidth={2} />
                    {t(tab.label)}
                  </Box>
                ) : (
                  <div className="tw:leading-4.5">{t(tab.label)}</div>
                ),
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
          <DataAssetFilterPopover
            allowAllOption
            options={assetOptions}
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
                    {assetOptions.find((o) => o.id === selectedAsset)?.label ??
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
            selectedId={selectedAsset}
            onChange={(value) => {
              setSelectedAsset(value);
              if (activeFilter === 'all') {
                setActiveFilter('');
              }
              setCurrentPage(1);
            }}
          />

          <Dropdown.Root>
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
                  {authorOptions.find((o) => o.id === selectedAuthor)?.label ??
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
              <Dropdown.Menu
                className="tw:p-1.5"
                selectedKeys={selectedAuthor ? [selectedAuthor] : []}
                selectionMode="single"
                onAction={(key) => {
                  const next = String(key);
                  const value = next === selectedAuthor ? '' : next;
                  setSelectedAuthor(value);
                  if (activeFilter === 'all') {
                    setActiveFilter('');
                  }
                  setCurrentPage(1);
                }}>
                <Dropdown.Item
                  id="all-author"
                  key="all-author"
                  textValue={t('label.all-entity', {
                    entity: t('label.author'),
                  })}>
                  <Box align="center" gap={2}>
                    <span>
                      {t('label.all-entity', { entity: t('label.author') })}
                    </span>
                  </Box>
                </Dropdown.Item>
                <Dropdown.Separator />
                {authorOptions.map((opt) => (
                  <Dropdown.Item id={opt.id} key={opt.id} textValue={opt.label}>
                    <Box align="center" gap={2}>
                      {opt.id && <ProfilePicture name={opt.id} size={20} />}
                      <span>{opt.label}</span>
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
            data={pagedMemories}
            isAdminUser={currentUser?.isAdmin}
            isLoading={isMemoriesLoading}
            onDeleteMemory={handleDeleteMemory}
            onEditMemory={handleEditMemory}
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
