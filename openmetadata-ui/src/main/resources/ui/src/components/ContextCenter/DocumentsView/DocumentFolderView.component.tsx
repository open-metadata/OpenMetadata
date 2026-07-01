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
  Button,
  ButtonUtility,
  Card,
  Dot,
  FileIcon,
  Skeleton,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { Folder } from '../../../generated/entity/data/folder';
import {
  deleteFolder,
  listContextFiles,
  listFolders,
} from '../../../rest/assetAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import CreateFolderModal from '../CreateFolderModal/CreateFolderModal.component';

export interface FileMovedEvent {
  file: ContextFile;
  targetFolderId: string | null;
}

export interface DocumentFolderViewProps {
  totalFileCount?: number;
  selectedFolderId?: string;
  canCreate?: boolean;
  canDelete?: boolean;
  lastFileMoved?: FileMovedEvent;
  lastFilesDeleted?: ContextFile[];
  onSelectFolder: (folderId: string | undefined) => void;
  onFoldersLoaded?: (folders: Folder[]) => void;
}

const DocumentFolderView = ({
  totalFileCount = 0,
  selectedFolderId,
  canCreate = false,
  canDelete = false,
  lastFileMoved,
  lastFilesDeleted,
  onSelectFolder,
  onFoldersLoaded,
}: DocumentFolderViewProps) => {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder>();
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [folderFilesCache, setFolderFilesCache] = useState<
    Map<string, ContextFile[]>
  >(new Map());

  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listFolders();
      setFolders(data);
      onFoldersLoaded?.(data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [onFoldersLoaded]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const fetchFolderFilesIfNeeded = useCallback(
    async (folderId: string) => {
      if (folderFilesCache.has(folderId)) {
        return;
      }
      try {
        const response = await listContextFiles({ folderId });
        setFolderFilesCache((prev) =>
          new Map(prev).set(folderId, response.data)
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [folderFilesCache]
  );

  useEffect(() => {
    if (!lastFileMoved) {
      return;
    }
    const { file, targetFolderId } = lastFileMoved;
    const sourceFolderId = file.folder?.id;

    setFolders((prev) =>
      prev.map((f) => {
        if (f.id === targetFolderId) {
          return { ...f, childrenCount: (f.childrenCount ?? 0) + 1 };
        }
        if (sourceFolderId && f.id === sourceFolderId) {
          return {
            ...f,
            childrenCount: Math.max(0, (f.childrenCount ?? 0) - 1),
          };
        }

        return f;
      })
    );

    setFolderFilesCache((prev) => {
      const next = new Map(prev);

      if (sourceFolderId && next.has(sourceFolderId)) {
        next.set(
          sourceFolderId,
          (next.get(sourceFolderId) ?? []).filter((f) => f.id !== file.id)
        );
      }

      if (targetFolderId && next.has(targetFolderId)) {
        const existing = next.get(targetFolderId) ?? [];
        if (!existing.some((f) => f.id === file.id)) {
          next.set(targetFolderId, [file, ...existing]);
        }
      }

      return next;
    });
  }, [lastFileMoved]);

  useEffect(() => {
    if (!lastFilesDeleted?.length) {
      return;
    }

    fetchFolders();

    setFolderFilesCache((prev) => {
      const next = new Map(prev);
      lastFilesDeleted.forEach((file) => {
        const folderId = file.folder?.id;
        if (folderId && next.has(folderId)) {
          next.set(
            folderId,
            (next.get(folderId) ?? []).filter((f) => f.id !== file.id)
          );
        }
      });

      return next;
    });
  }, [lastFilesDeleted, fetchFolders]);

  const handleFolderCreated = (folder: Folder) => {
    const updated = [...folders, folder];
    setFolders(updated);
    onFoldersLoaded?.(updated);
  };

  const handleDeleteConfirm = async () => {
    if (!folderToDelete) {
      return;
    }

    try {
      setIsDeletingFolder(true);
      await deleteFolder(folderToDelete.id);
      const updated = folders.filter((f) => f.id !== folderToDelete.id);
      setFolders(updated);
      onFoldersLoaded?.(updated);
      if (selectedFolderId === folderToDelete.id) {
        onSelectFolder(undefined);
      }
      showSuccessToast(
        t('server.entity-deleted-successfully', { entity: t('label.folder') })
      );
      setFolderToDelete(undefined);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setFolderToDelete(undefined);
      setIsDeletingFolder(false);
    }
  };

  const handleFolderItemSelect = (folderId: string) => {
    const next = selectedFolderId === folderId ? undefined : folderId;
    onSelectFolder(next);
  };

  const handleExpandedChange = (keys: Set<string | number>) => {
    const next = new Set(Array.from(keys).map(String));
    const added = Array.from(next).find((k) => !expandedKeys.has(k));
    setExpandedKeys(next);
    if (added) {
      fetchFolderFilesIfNeeded(added);
    }
  };

  return (
    <>
      <Card className="tw:p-4 tw:h-full tw:flex tw:flex-col tw:min-w-70">
        <div className="tw:flex tw:items-center tw:justify-between tw:mb-5 tw:shrink-0">
          <div className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:p-3 tw:rounded-lg tw:bg-gray-blue-50 tw:leading-0">
              <FolderIcon className="tw:text-tertiary" height={20} width={20} />
            </div>
            <div>
              <Typography size="text-md" weight="semibold">
                {t('label.folder')}
              </Typography>
              <Typography
                className="tw:text-quaternary tw:flex tw:items-center tw:gap-2"
                size="text-xs">
                <span>
                  {folders.length} {t('label.folder-plural')}
                </span>
                <Dot className="tw:text-quaternary" size="micro" />
                <span data-testid="folder-view-file-count">
                  {totalFileCount} {t('label.file-plural')}
                </span>
              </Typography>
            </div>
          </div>
          {canCreate && (
            <ButtonUtility
              color="secondary"
              data-testid="add-folder-btn"
              icon={Plus}
              size="sm"
              tooltip={t('label.add-entity', { entity: t('label.folder') })}
              onClick={() => setIsCreateModalOpen(true)}
            />
          )}
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto">
          {isLoading ? (
            <div className="tw:flex tw:flex-col tw:gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  height="32px"
                  key={i}
                  variant="rounded"
                  width="100%"
                />
              ))}
            </div>
          ) : (
            <Tree
              aria-label={t('label.folder-plural')}
              className="tw:w-full"
              expandedKeys={expandedKeys}
              onExpandedChange={handleExpandedChange}>
              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id;
                const isExpanded = expandedKeys.has(folder.id);
                const folderFiles = isExpanded
                  ? folderFilesCache.get(folder.id) ?? []
                  : [];

                return (
                  <Tree.Item
                    className={
                      isSelected ? 'tw:bg-utility-blue-50 tw:rounded-lg' : ''
                    }
                    id={folder.id}
                    key={folder.id}
                    textValue={folder.displayName ?? folder.name}>
                    <Tree.ItemContent
                      hasChildItems={(folder.childrenCount ?? 0) > 0}>
                      <div className="custom-group tw:flex tw:flex-1 tw:items-center tw:gap-2 tw:min-w-0">
                        <Button
                          ellipsis
                          className="tw:flex-1 tw:min-w-0 tw:text-left tw:p-0 tw:text-primary tw:justify-start tw:font-normal!"
                          color="tertiary"
                          iconLeading={FolderIcon}
                          size="sm"
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            handleFolderItemSelect(folder.id);
                          }}>
                          {getEntityName(folder)}
                        </Button>

                        {canDelete && (
                          <ButtonUtility
                            className="tw:opacity-0 group-hover-opacity-100 tw:shrink-0"
                            color="tertiary"
                            data-testid={`delete-folder-btn-${folder.id}`}
                            icon={Trash01}
                            size="xs"
                            tooltip={t('label.delete')}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              setFolderToDelete(folder);
                            }}
                          />
                        )}
                      </div>
                    </Tree.ItemContent>

                    {folderFiles.map((file) => (
                      <Tree.Item
                        id={file.id}
                        key={file.id}
                        textValue={getEntityName(file)}>
                        <Tree.ItemContent
                          className="tw:ml-7!"
                          showExpandIcon={false}>
                          <FileIcon
                            className="tw:size-5 tw:shrink-0"
                            theme="light"
                            type={file.fileExtension ?? ''}
                            variant="default"
                          />
                          <Typography
                            ellipsis
                            className="tw:truncate tw:text-secondary tw:max-w-[70%]"
                            size="text-sm"
                            weight="medium">
                            {getEntityName(file)}
                          </Typography>
                        </Tree.ItemContent>
                      </Tree.Item>
                    ))}
                  </Tree.Item>
                );
              })}
            </Tree>
          )}
        </div>
      </Card>

      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleFolderCreated}
      />

      {folderToDelete && (
        <DeleteModal
          entityTitle={folderToDelete.displayName ?? folderToDelete.name}
          isDeleting={isDeletingFolder}
          message={t('message.delete-entity-message', {
            entity: folderToDelete.displayName ?? folderToDelete.name,
          })}
          open={Boolean(folderToDelete)}
          onCancel={() => setFolderToDelete(undefined)}
          onDelete={handleDeleteConfirm}
        />
      )}
    </>
  );
};

export default DocumentFolderView;
