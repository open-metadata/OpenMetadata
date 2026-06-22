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

import { Box, Card, Tabs } from '@openmetadata/ui-core-components';
import { File06 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import ArchiveView from '../../../components/ContextCenter/ArchiveView/ArchiveView.component';
import { ArchiveItem } from '../../../components/ContextCenter/ArchiveView/ArchiveView.interface';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Include } from '../../../generated/type/include';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { PageType } from '../../../interface/knowledge-center.interface';
import {
  deleteDriveFile,
  listArchivedContextFiles,
  restoreDriveFile,
} from '../../../rest/assetAPI';
import {
  deleteKnowledgePage,
  getListKnowledgePages,
  restoreKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

type FilterKey = 'all' | 'mine' | 'article' | 'document';

const ContextCenterArchivePage: FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { getResourcePermission } = usePermissionProvider();
  const [allItems, setAllItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [itemToDelete, setItemToDelete] = useState<ArchiveItem>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const filterTabItems = useMemo(
    () => [
      { id: 'all', label: t('label.all') },
      { id: 'mine', label: t('label.created-by-me') },
      {
        id: 'article',
        label: (
          <Box align="center" className="tw:gap-1.5">
            <File06 size={14} />
            {t('label.article-plural')}
          </Box>
        ),
      },
      {
        id: 'document',
        label: (
          <Box align="center" className="tw:gap-1.5">
            <FolderIcon height={14} width={14} />
            {t('label.document-plural')}
          </Box>
        ),
      },
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

  const fetchArchivedItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pagesResponse, files] = await Promise.all([
        getListKnowledgePages({
          include: Include.Deleted,
          limit: 1000,
          pageType: PageType.ARTICLE,
        }),
        listArchivedContextFiles(),
      ]);

      const articleItems: ArchiveItem[] = (pagesResponse.data ?? []).map(
        (page) => ({
          id: page.id,
          name: getEntityName(page),
          type: 'article' as const,
          updatedBy: page.updatedBy,
          updatedAt: page.updatedAt,
        })
      );

      const documentItems: ArchiveItem[] = files.map((file) => ({
        id: file.id,
        name: getEntityName(file),
        type: 'document' as const,
        updatedBy: file.updatedBy,
        updatedAt: file.updatedAt,
      }));

      const merged = [...documentItems].sort(
        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
      );

      setAllItems(merged);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermission();
    fetchArchivedItems();
  }, [fetchPermission, fetchArchivedItems]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case 'mine':
        return allItems.filter((item) => item.updatedBy === currentUser?.name);
      case 'article':
        return allItems.filter((item) => item.type === 'article');
      case 'document':
        return allItems.filter((item) => item.type === 'document');
      default:
        return allItems;
    }
  }, [allItems, activeFilter, currentUser?.name]);

  const handleRestore = useCallback(
    async (item: ArchiveItem) => {
      try {
        if (item.type === 'article') {
          await restoreKnowledgePage(item.id);
        } else {
          await restoreDriveFile(item.id);
        }
        setAllItems((prev) => prev.filter((i) => i.id !== item.id));
        showSuccessToast(
          t('message.entity-restored-success', { entity: item.name })
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [t]
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
      if (itemToDelete.type === 'article') {
        await deleteKnowledgePage(itemToDelete.id, false, true);
      } else {
        await deleteDriveFile(itemToDelete.id, true);
      }
      setAllItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      showSuccessToast(
        t('server.entity-deleted-successfully', { entity: itemToDelete.name })
      );
      setItemToDelete(undefined);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  }, [itemToDelete, t]);

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:overflow-scroll tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-archive-page">
      <ContextCenterHeader
        breadcrumbs={[
          {
            label: t('label.context-center'),
            href: contextCenterClassBase.getContextCenterPath(),
          },
          {
            label: t('label.archive'),
          },
        ]}
        hasPermission={permissions?.Create}
        subtitle={t('message.context-center-archive-subtitle')}
        title={t('label.archive-plural')}
      />
      <div className="tw:pb-5">
        <Tabs
          className="tw:w-max"
          selectedKey={activeFilter}
          onSelectionChange={(key) => setActiveFilter(key as FilterKey)}>
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
      <Card
        className="tw:flex tw:flex-col tw:h-auto"
        style={{ overflow: 'unset' }}>
        <ArchiveView
          data={filteredItems}
          isLoading={isLoading}
          onDelete={handleDeleteClick}
          onRestore={handleRestore}
        />
      </Card>

      {itemToDelete && (
        <DeleteModal
          entityTitle={itemToDelete.name}
          isDeleting={isDeleting}
          message={t('message.are-you-sure-you-want-to-delete-this-entity', {
            entity:
              itemToDelete.type === 'article'
                ? t('label.article').toLowerCase()
                : t('label.document').toLowerCase(),
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
