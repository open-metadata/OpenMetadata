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
  ButtonUtility,
  Card,
  FileIcon,
  Skeleton,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { Folder } from '../../../generated/entity/data/folder';
import { deleteFolder, listFolders } from '../../../rest/assetAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import CreateFolderModal from '../CreateFolderModal/CreateFolderModal.component';

export interface DocumentFolderViewProps {
  files?: ContextFile[];
  selectedFolderId?: string;
  onSelectFolder: (folderId: string | undefined) => void;
  onFoldersLoaded?: (folders: Folder[]) => void;
}

const DocumentFolderView = ({
  files = [],
  selectedFolderId,
  onSelectFolder,
  onFoldersLoaded,
}: DocumentFolderViewProps) => {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder>();
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

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
    onSelectFolder(selectedFolderId === folderId ? undefined : folderId);
  };

  return (
    <>
      <Card className="tw:p-4 tw:h-full tw:flex tw:flex-col tw:min-w-70">
        <div className="tw:flex tw:items-center tw:justify-between tw:mb-5">
          <div className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:p-3 tw:rounded-lg tw:bg-gray-blue-50 tw:leading-0">
              <FolderIcon className="tw:text-tertiary" height={20} width={20} />
            </div>
            <div>
              <Typography size="text-md" weight="semibold">
                {t('label.folder')}
              </Typography>
              <Typography
                className="tw:text-gray-500 tw:flex tw:items-center tw:gap-2"
                size="text-xs">
                <span>
                  {folders.length} {t('label.folder-plural')}
                </span>
                <span className="tw:select-none tw:text-lg">&middot;</span>
                <span>
                  {files.length} {t('label.file-plural')}
                </span>
              </Typography>
            </div>
          </div>
          <ButtonUtility
            color="secondary"
            data-testid="add-folder-btn"
            icon={Plus}
            size="sm"
            tooltip={t('label.add-entity', { entity: t('label.folder') })}
            onClick={() => setIsCreateModalOpen(true)}
          />
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
            <Tree aria-label={t('label.folder-plural')} className="tw:w-full">
              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id;
                const folderFiles = files.filter(
                  (file) => file.folder?.id === folder.id
                );

                return (
                  <Tree.Item
                    className={isSelected ? 'tw:bg-blue-50 tw:rounded-lg' : ''}
                    id={folder.id}
                    key={folder.id}
                    textValue={folder.displayName ?? folder.name}>
                    <Tree.ItemContent>
                      <div className="custom-group tw:flex tw:flex-1 tw:items-center tw:gap-2 tw:min-w-0">
                        <button
                          className="tw:flex tw:flex-1 tw:items-center tw:gap-2 tw:min-w-0 tw:text-left tw:bg-transparent tw:border-none tw:cursor-pointer tw:p-0 tw:font-normal"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFolderItemSelect(folder.id);
                          }}>
                          <FolderIcon
                            className="tw:shrink-0 tw:text-gray-500"
                            height={16}
                            width={16}
                          />
                          <div className="tw:w-full">
                            <Typography
                              as="p"
                              className="tw:truncate tw:flex-1">
                              {folder.displayName ?? folder.name}
                            </Typography>
                          </div>
                        </button>

                        <ButtonUtility
                          className="tw:opacity-0 group-hover-opacity-100 tw:shrink-0"
                          color="tertiary"
                          data-testid={`delete-folder-btn-${folder.id}`}
                          icon={Trash01}
                          size="xs"
                          tooltip={t('label.delete')}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setFolderToDelete(folder);
                          }}
                        />
                      </div>
                    </Tree.ItemContent>

                    {folderFiles.map((file) => (
                      <Tree.Item
                        id={file.id}
                        key={file.id}
                        textValue={file.name}>
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
                            {file.name}
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
