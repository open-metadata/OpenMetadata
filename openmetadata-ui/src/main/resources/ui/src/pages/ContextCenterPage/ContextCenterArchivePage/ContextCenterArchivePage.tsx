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

import { Card, Tabs } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import ArchiveView from '../../../components/ContextCenter/ArchiveView/ArchiveView.component';
import { ArchiveItem } from '../../../components/ContextCenter/ArchiveView/ArchiveView.interface';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { ARCHIVE_PAGE_SIZE } from '../../../constants/ContextCenter.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deleteDriveFile,
  listArchivedContextFiles,
  restoreDriveFile,
} from '../../../rest/assetAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

type FilterKey = 'all' | 'mine' | 'article' | 'document';

const ContextCenterArchivePage: FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { getResourcePermission } = usePermissionProvider();
  const { paging, pageSize, handlePagingChange } = usePaging(ARCHIVE_PAGE_SIZE);
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [itemToDelete, setItemToDelete] = useState<ArchiveItem>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [hasEverHadItems, setHasEverHadItems] = useState(false);
  const fetchGenerationRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const filterTabItems = useMemo(
    () => [
      { id: 'all', label: t('label.all') },
      { id: 'mine', label: t('label.created-by-me') },
    ],
    [t]
  );

  const fetchPermission = useCallback(async () => {
    try {
      const response = await getResourcePermission(
        ResourceEntity.KNOWLEDGE_PAGE
      );
      setPermissions(response);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [getResourcePermission]);

  const fetchArchivedItems = useCallback(
    async (after?: string) => {
      if (!after) {
        fetchGenerationRef.current += 1;
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
      const generation = fetchGenerationRef.current;

      if (after) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      try {
        const updatedBy =
          activeFilter === 'mine' ? currentUser?.name : undefined;

        const response = await listArchivedContextFiles({
          after,
          limit: pageSize,
          updatedBy,
        });
        if (generation !== fetchGenerationRef.current) {
          return;
        }

        const documentItems: ArchiveItem[] = response.data.map((file) => ({
          id: file.id,
          name: getEntityName(file),
          type: 'document' as const,
          fileExtension: file.fileExtension,
          updatedBy: file.updatedBy,
          updatedAt: file.updatedAt,
        }));

        setItems((prev) =>
          after ? [...prev, ...documentItems] : documentItems
        );
        if (documentItems.length > 0) {
          setHasEverHadItems(true);
        }
        handlePagingChange(response.paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        if (generation === fetchGenerationRef.current) {
          if (after) {
            isLoadingMoreRef.current = false;
            setIsLoadingMore(false);
          } else {
            setIsLoading(false);
          }
        }
      }
    },
    [pageSize, activeFilter, currentUser?.name, handlePagingChange]
  );

  const handleScrollEnd = useCallback(() => {
    if (paging.after && !isLoading && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      fetchArchivedItems(paging.after);
    }
  }, [paging.after, isLoading, fetchArchivedItems]);

  useEffect(() => {
    fetchPermission();
  }, [fetchPermission]);

  useEffect(() => {
    fetchArchivedItems();
  }, [fetchArchivedItems]);

  const handleFilterChange = useCallback((key: FilterKey) => {
    setActiveFilter(key);
  }, []);

  const handleRestore = useCallback(
    async (item: ArchiveItem) => {
      try {
        await restoreDriveFile(item.id);
        showSuccessToast(
          t('message.entity-restored-success', { entity: item.name })
        );
        await fetchArchivedItems();
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [t, fetchArchivedItems]
  );

  const handleDeleteClick = useCallback((item: ArchiveItem) => {
    setItemToDelete(item);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setItemToDelete(undefined);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!itemToDelete) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteDriveFile(itemToDelete.id, true);
      showSuccessToast(
        t('server.entity-deleted-successfully', { entity: itemToDelete.name })
      );
      setItems((prev) => prev.filter((item) => item.id !== itemToDelete.id));
      handlePagingChange((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setItemToDelete(undefined);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  }, [itemToDelete, t, handlePagingChange]);

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:overflow-hidden tw:bg-secondary ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-archive-page">
      <div className="context-center-header-section tw:px-5">
        <ContextCenterHeader
          breadcrumbs={[
            {
              label: t('label.archive'),
            },
          ]}
          hasPermission={permissions?.Create}
          subtitle={t('label.view-archived-document-plural')}
          title={t('label.archive-plural')}
        />
      </div>
      <div className="context-center-content-section tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:px-5 tw:pb-5">
        {!isLoading && (hasEverHadItems || items.length > 0) && (
          <div className="tw:pb-5">
            <Tabs
              className="tw:w-max"
              selectedKey={activeFilter}
              onSelectionChange={(key) => handleFilterChange(key as FilterKey)}>
              <Tabs.List
                className="tw:gap-2"
                items={filterTabItems}
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
          </div>
        )}
        <Card className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:overflow-hidden">
          <ArchiveView
            canDelete={permissions?.Delete}
            canRestore={permissions?.EditAll}
            data={items}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            onDelete={handleDeleteClick}
            onRestore={handleRestore}
            onScrollEnd={handleScrollEnd}
          />
        </Card>
      </div>

      {itemToDelete && (
        <DeleteModal
          entityTitle={itemToDelete.name}
          isDeleting={isDeleting}
          message={t('message.are-you-sure-you-want-to-delete-this-entity', {
            entity: t('label.document-lowercase'),
          })}
          open={Boolean(itemToDelete)}
          onCancel={handleCancelDelete}
          onDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
};

export default ContextCenterArchivePage;
