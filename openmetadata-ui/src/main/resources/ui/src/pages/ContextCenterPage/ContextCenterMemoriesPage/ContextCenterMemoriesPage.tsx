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
  Button,
  Card,
  Dropdown,
  PaginationCardMinimal,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, FilterLines, Home02, Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import AlertBar from '../../../components/AlertBar/AlertBar';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import CreateMemoryModal from '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.component';
import MemoriesView from '../../../components/ContextCenter/MemoriesView/MemoriesView.component';
import {
  MemoryFilterTab,
  MemoryItem,
  MemorySortBy,
} from '../../../components/ContextCenter/MemoriesView/MemoriesView.interface';
import { MemoryStatus } from '../../../generated/entity/context/contextMemory';
import { useAlertStore } from '../../../hooks/useAlertStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deleteContextMemory,
  getListContextMemories,
} from '../../../rest/contextMemoryAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const MEMORIES_PER_PAGE = 10;
const MEMORY_FIELDS = 'owners,tags,domains,relatedEntities';

const FILTER_TABS = [
  { id: 'all', label: 'label.all' },
  { id: 'created-by-me', label: 'label.created-by-me' },
  // { id: 'pinned', label: 'label.pinned' },
  // { id: 'needs-review', label: 'label.needs-review' },
] as const;

const FILTER_BUTTON_BASE_CLS =
  'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:px-3' +
  ' tw:py-2 tw:text-sm tw:font-medium tw:shadow-xs tw:ring-1 tw:ring-inset' +
  ' tw:cursor-pointer tw:transition tw:duration-100' +
  ' tw:ease-linear hover:tw:ring-brand tw:outline-hidden tw:whitespace-nowrap';

const FILTER_BUTTON_CLS = `${FILTER_BUTTON_BASE_CLS} tw:bg-primary tw:ring-primary`;
const FILTER_BUTTON_ACTIVE_CLS = `${FILTER_BUTTON_BASE_CLS} tw:bg-brand-50 tw:ring-brand-100`;

const ContextCenterMemoriesPage: FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserName = getEntityName(currentUser);
  const { alert } = useAlertStore();

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryItem>();
  const [memoryToEdit, setMemoryToEdit] = useState<MemoryItem>();
  const [memoryToView, setMemoryToView] = useState<MemoryItem>();
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

  const fetchMemories = useCallback(async () => {
    setIsMemoriesLoading(true);
    try {
      const response = await getListContextMemories({
        limit: 1000,
        fields: MEMORY_FIELDS,
      });
      const items: MemoryItem[] = (response.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        title: m.title,
        summary: m.summary,
        question: m.question ?? '',
        answer: m.answer ?? '',
        memoryType: m.memoryType,
        status: m.status,
        updatedBy: m.updatedBy,
        updatedAt: m.updatedAt,
        tags: m.tags,
        usageCount: m.usageCount,
        lastUsedAt: m.lastUsedAt,
        relatedEntities: m.relatedEntities,
      }));
      setMemories(items);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMemoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const assetOptions = useMemo(() => {
    const seen = new Map<
      string,
      { name: string; displayName: string; type: string }
    >();
    memories.forEach((m) =>
      m.relatedEntities?.forEach((ref) => {
        const fqn = ref.fullyQualifiedName ?? ref.id;
        if (fqn && !seen.has(fqn)) {
          seen.set(fqn, {
            name: ref.name ?? fqn,
            displayName: ref.displayName ?? ref.name ?? fqn,
            type: ref.type ?? '',
          });
        }
      })
    );

    return [
      {
        id: '',
        label: t('label.all-entity', { entity: t('label.asset-plural') }),
        displayName: '',
        type: '',
      },
      ...Array.from(seen.entries())
        .sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName))
        .map(([fqn, meta]) => ({
          id: fqn,
          label: meta.displayName,
          displayName: meta.displayName,
          type: meta.type,
        })),
    ];
  }, [memories, t]);

  const authorOptions = useMemo(() => {
    const authors = new Set<string>();
    memories.forEach((m) => {
      if (m.updatedBy) {
        authors.add(m.updatedBy);
      }
    });

    return [
      { id: '', label: t('label.all-entity', { entity: t('label.author') }) },
      ...Array.from(authors)
        .sort()
        .map((name) => ({ id: name, label: name })),
    ];
  }, [memories, t]);

  const filteredMemories = useMemo(() => {
    let list = memories;

    if (activeFilter === 'created-by-me') {
      list = list.filter((m) => m.updatedBy === currentUser?.name);
    } else if (activeFilter === 'pinned') {
      list = list.filter(
        (m) => m.status === MemoryStatus.Active && (m.usageCount ?? 0) > 0
      );
    } else if (activeFilter === 'needs-review') {
      list = list.filter((m) => m.status === MemoryStatus.Draft);
    }

    if (selectedAsset) {
      list = list.filter((m) =>
        m.relatedEntities?.some(
          (ref) => (ref.fullyQualifiedName ?? ref.id) === selectedAsset
        )
      );
    }

    if (selectedAuthor) {
      list = list.filter((m) => m.updatedBy === selectedAuthor);
    }

    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      list = list.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.summary?.toLowerCase().includes(q) ||
          m.question.toLowerCase().includes(q) ||
          m.answer.toLowerCase().includes(q)
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
        (a.updatedBy ?? '').localeCompare(b.updatedBy ?? '')
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

  const handleDeleteMemory = useCallback((memory: MemoryItem) => {
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
        t('server.entity-deleted-successfully', { entity: t('label.memory') })
      );
      setMemoryToDelete(undefined);
      fetchMemories();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeletingMemory(false);
    }
  }, [memoryToDelete, fetchMemories, t]);

  const handleEditMemory = useCallback((memory: MemoryItem) => {
    setMemoryToEdit(memory);
    setIsViewModalOpen(false);
    setMemoryToView(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewMemory = useCallback((memory: MemoryItem) => {
    setMemoryToView(memory);
    setIsViewModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setMemoryToEdit(undefined);
  }, []);

  const handleViewModalClose = useCallback(() => {
    setIsViewModalOpen(false);
    setMemoryToView(undefined);
  }, []);

  const handleModalSuccess = useCallback(() => {
    handleModalClose();
    fetchMemories();
  }, [handleModalClose, fetchMemories]);

  const sharedCount = memories.filter(
    (m) => m.status === MemoryStatus.Active
  ).length;
  const createdByMeCount = memories.filter(
    (m) => m.updatedBy === currentUser?.name
  ).length;
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
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-memories-page">
      {alert && <AlertBar message={alert.message} type={alert.type} />}
      <ContextCenterHeader
        actionsSlot={headerActions}
        breadcrumbs={[
          {
            name: '',
            icon: <Home02 size={14} />,
            url: contextCenterClassBase.getHomePath(),
            activeTitle: true,
          },
          {
            name: t('label.context-center'),
            url: contextCenterClassBase.getContextCenterPath(),
          },
          {
            activeTitle: true,
            name: t('label.memory-plural'),
            url: '',
          },
        ]}
        searchPlaceholder={t('label.search-memories')}
        searchQuery={searchValue}
        subtitle={t('message.context-center-memories-subtitle')}
        title={t('label.memory-plural')}
        onSearch={handleSearchChange}
      />

      {/* Stats cards */}
      <div className="tw:grid tw:grid-cols-4 tw:gap-6 tw:mb-5">
        <Card className="tw:p-4 tw:flex tw:flex-col tw:gap-1">
          <Typography className="tw:text-tertiary" weight="medium">
            {t('label.total-memory-plural')}
          </Typography>
          <Typography size="display-sm" weight="semibold">
            {memories.length}
          </Typography>
        </Card>

        <Card className="tw:p-4 tw:flex tw:flex-col tw:gap-1">
          <Typography className="tw:text-tertiary" weight="medium">
            {t('label.created-by-me')}
          </Typography>
          <Typography size="display-sm" weight="semibold">
            {createdByMeCount}
          </Typography>
        </Card>

        <Card className="tw:p-4 tw:flex tw:flex-col tw:gap-1">
          <Typography className="tw:text-tertiary" weight="medium">
            {t('label.shared-with-workspace')}
          </Typography>
          <Typography size="display-sm" weight="semibold">
            {sharedCount}
          </Typography>
        </Card>

        <Card className="tw:p-4 tw:flex tw:flex-col tw:gap-1">
          <Typography className="tw:text-tertiary" weight="medium">
            {t('label.times-used-in-chats')}
          </Typography>
          <Typography size="display-sm" weight="semibold">
            {totalUsageCount}
          </Typography>
        </Card>
      </div>

      {/* Memories card with tabs */}
      <Card className="tw:flex tw:flex-col tw:flex-1 tw:min-h-115">
        <div className="tw:px-6 tw:py-5">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Typography size="text-md" weight="medium">
              {t('label.memory-plural')}
            </Typography>
            <Badge color="brand" type="pill-color">
              {filteredMemories.length}
            </Badge>
          </div>
          <Typography className="tw:text-gray-600" size="text-sm">
            {t('label.signed-in-as')} <strong>{currentUserName}</strong>.{' '}
            {t('message.you-can-edit-memories-you-created')}.
          </Typography>
        </div>

        <div className="tw:px-5 tw:py-3 tw:bg-tertiary tw:flex tw:items-center tw:gap-3 tw:flex-wrap">
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
                label: t(tab.label),
              }))}
              type="button-brand">
              {(tab) => (
                <Tabs.Item
                  {...tab}
                  className={({ isSelected }) =>
                    isSelected
                      ? 'tw:rounded-md tw:border tw:border-brand-100 tw:bg-brand-50' +
                        ' tw:px-3 tw:py-1.5 tw:text-sm tw:font-semibold' +
                        ' tw:text-brand-700 tw:cursor-pointer'
                      : 'tw:rounded-md tw:border tw:border-gray-300 tw:bg-white' +
                        ' tw:px-3 tw:py-1.5 tw:text-sm tw:font-semibold' +
                        ' tw:text-quaternary tw:cursor-pointer'
                  }
                />
              )}
            </Tabs.List>
          </Tabs>

          <div className="tw:flex tw:items-center tw:gap-2">
            <Dropdown.Root>
              <AriaButton
                className={
                  selectedAsset ? FILTER_BUTTON_ACTIVE_CLS : FILTER_BUTTON_CLS
                }>
                <Typography className="tw:text-gray-700" weight="medium">
                  {assetOptions.find((o) => o.id === selectedAsset)?.label ??
                    t('label.all-entity', { entity: t('label.asset-plural') })}
                </Typography>
                <ChevronDown
                  className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
                  size={16}
                  strokeWidth={2.5}
                />
              </AriaButton>
              <Dropdown.Popover className="tw:w-100">
                <Dropdown.Menu
                  selectedKeys={selectedAsset ? [selectedAsset] : []}
                  selectionMode="single"
                  onAction={(key) => {
                    const next = String(key);
                    const value = next === selectedAsset ? '' : next;
                    setSelectedAsset(value);
                    if (activeFilter === 'all') {
                      setActiveFilter('');
                    }
                    setCurrentPage(1);
                  }}>
                  {assetOptions.map((opt) => (
                    <Dropdown.Item
                      id={opt.id}
                      key={opt.id}
                      textValue={opt.label}>
                      {opt.type ? (
                        <div className="tw:flex tw:items-center tw:gap-2 tw:min-w-0">
                          <div className="tw:shrink-0">
                            {searchClassBase.getEntityIcon(
                              opt.type,
                              'tw:w-6 tw:h-6 tw:text-gray-500'
                            )}
                          </div>
                          <div className="tw:flex tw:flex-1 tw:justify-between tw:items-center">
                            <div className="tw:max-w-55">
                              <Typography
                                ellipsis
                                className="tw:truncate tw:text-gray-800"
                                size="text-sm"
                                weight="medium">
                                {opt.displayName}
                              </Typography>
                              <Typography
                                ellipsis
                                className="tw:text-gray-400 tw:truncate"
                                size="text-xs">
                                {opt.id}
                              </Typography>
                            </div>
                            <Badge
                              className="tw:shrink-0 tw:uppercase"
                              color="gray"
                              size="sm"
                              type="color">
                              {opt.type}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <span>{opt.label}</span>
                      )}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>

            <Dropdown.Root>
              <AriaButton
                className={
                  selectedAuthor ? FILTER_BUTTON_ACTIVE_CLS : FILTER_BUTTON_CLS
                }>
                <Typography className="tw:text-gray-700" weight="medium">
                  {authorOptions.find((o) => o.id === selectedAuthor)?.label ??
                    t('label.all-entity', { entity: t('label.author') })}
                </Typography>
                <ChevronDown
                  className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
                  size={16}
                  strokeWidth={2.5}
                />
              </AriaButton>
              <Dropdown.Popover>
                <Dropdown.Menu
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
                  {authorOptions.map((opt) => (
                    <Dropdown.Item
                      id={opt.id}
                      key={opt.id}
                      textValue={opt.label}>
                      <div className="tw:flex tw:items-center tw:gap-2">
                        {opt.id && <ProfilePicture name={opt.id} size={20} />}
                        <span>{opt.label}</span>
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>

          <div className="tw:ml-auto tw:flex tw:items-center tw:gap-4">
            {hasActiveFilters && (
              <Button color="link-color" size="sm" onClick={handleClearFilters}>
                {t('label.clear-entity', { entity: t('label.all') })}
              </Button>
            )}
            <Dropdown.Root>
              <AriaButton className={FILTER_BUTTON_CLS}>
                <FilterLines size={18} />
                <Typography className="tw:text-gray-700" weight="medium">
                  {t('label.sort')}:
                </Typography>
                <Typography className="tw:text-gray-700" weight="medium">
                  {SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? ''}
                </Typography>
                <ChevronDown
                  className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
                  size={16}
                  strokeWidth={2.5}
                />
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
          </div>
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto">
          <MemoriesView
            canDelete
            data={pagedMemories}
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
          isOpen={isViewModalOpen}
          memoryToEdit={memoryToView}
          onClose={handleViewModalClose}
          onCreated={handleViewModalClose}
        />
      )}

      {memoryToDelete && (
        <DeleteModal
          entityTitle={memoryToDelete.title ?? memoryToDelete.question}
          isDeleting={isDeletingMemory}
          message={t('message.delete-entity-message', {
            entity: memoryToDelete.title ?? memoryToDelete.question,
          })}
          open={Boolean(memoryToDelete)}
          onCancel={handleCancelDelete}
          onDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
};

export default ContextCenterMemoriesPage;
