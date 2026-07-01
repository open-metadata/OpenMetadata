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

import { Box } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { useSearchParams } from 'react-router-dom';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import '../../../components/common/ResizablePanels/resizable-panels.less';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import DocumentFolderView, {
  FileMovedEvent,
} from '../../../components/ContextCenter/DocumentsView/DocumentFolderView.component';
import DocumentPreviewPanel from '../../../components/ContextCenter/DocumentsView/DocumentPreviewPanel.component';
import DocumentsView from '../../../components/ContextCenter/DocumentsView/DocumentsView.component';
import { FolderOption } from '../../../components/ContextCenter/DocumentsView/DocumentsView.interface';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { SearchIndex } from '../../../enums/search.enum';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { Folder } from '../../../generated/entity/data/folder';
import { BulkOperationResult } from '../../../generated/type/bulkOperationResult';
import { usePaging } from '../../../hooks/paging/usePaging';
import {
  bulkDeleteDriveFiles,
  bulkMoveFilesToFolder,
  deleteDriveFile,
  downloadDriveFiles,
  listContextFiles,
} from '../../../rest/assetAPI';
import { searchQuery as fetchSearchResults } from '../../../rest/searchAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import {
  downloadBlob,
  handleAssetDownload,
} from '../../../utils/ContextCenterPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const getSuccessfulIds = (result: BulkOperationResult): Set<string> =>
  new Set(
    (result.successRequest ?? [])
      .map((response) => response.request)
      .filter((request): request is string => typeof request === 'string')
  );

const ContextCenterDocumentsPage: FC = () => {
  const { t } = useTranslation();
  const { getResourcePermission } = usePermissionProvider();
  const [searchParams, setSearchParams] = useSearchParams();
  const { paging, pageSize, handlePagingChange } = usePaging();
  const [allDocuments, setAllDocuments] = useState<ContextFile[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ContextFile>();
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [totalFileCount, setTotalFileCount] = useState(0);
  const [globalFileCount, setGlobalFileCount] = useState(0);
  const [previewFile, setPreviewFile] = useState<ContextFile | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastFileMoved, setLastFileMoved] = useState<FileMovedEvent>();
  const [lastFilesDeleted, setLastFilesDeleted] = useState<ContextFile[]>([]);
  const fetchGenerationRef = useRef(0);

  const previewFileUrl = useMemo(() => {
    if (!previewFile) {
      return '';
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('document', previewFile.id);

    return `${window.location.origin}${
      window.location.pathname
    }?${params.toString()}`;
  }, [previewFile, searchParams]);

  const { hasCreatePermission, hasDeletePermission, hasEditPermission } =
    useMemo(
      () => ({
        hasCreatePermission: permissions.Create,
        hasDeletePermission: permissions.Delete,
        hasEditPermission: permissions.EditAll,
      }),
      [permissions.Create, permissions.Delete, permissions.EditAll]
    );

  const selectedFolderFqn = useMemo(
    () =>
      selectedFolderId
        ? folders.find((f) => f.id === selectedFolderId)?.fullyQualifiedName
        : undefined,
    [selectedFolderId, folders]
  );

  const folderOptions = useMemo<FolderOption[]>(
    () =>
      folders.map((f) => ({
        id: f.id,
        name: f.displayName ?? f.name,
      })),
    [folders]
  );

  const fetchDocuments = useCallback(
    async (after?: string) => {
      if (!after) {
        fetchGenerationRef.current += 1;
        setIsLoadingMore(false);
      }
      const generation = fetchGenerationRef.current;

      if (after) {
        setIsLoadingMore(true);
      } else {
        setIsDocumentsLoading(true);
      }
      try {
        if (documentSearchQuery) {
          const results = await fetchSearchResults({
            query: documentSearchQuery,
            searchIndex: SearchIndex.DRIVE_FILE,
            sortField: 'updatedAt',
            sortOrder: 'desc',
          });
          if (generation !== fetchGenerationRef.current) {
            return;
          }
          setAllDocuments(
            results.hits.hits.map(
              (hit) => hit._source as unknown as ContextFile
            )
          );
        } else {
          const response = await listContextFiles({
            after,
            limit: pageSize,
            folderId: selectedFolderId,
          });
          if (generation !== fetchGenerationRef.current) {
            return;
          }
          if (after) {
            setAllDocuments((prev) => [...prev, ...response.data]);
          } else {
            setAllDocuments(response.data);
          }
          handlePagingChange(response.paging);
          setTotalFileCount(response.paging.total);
          if (!after && !selectedFolderId) {
            setGlobalFileCount(response.paging.total);
          }
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        if (generation === fetchGenerationRef.current) {
          if (after) {
            setIsLoadingMore(false);
          } else {
            setIsDocumentsLoading(false);
          }
        }
      }
    },
    [documentSearchQuery, pageSize, handlePagingChange, selectedFolderId]
  );

  const handleLoadMore = useCallback(() => {
    if (
      paging.after &&
      !isDocumentsLoading &&
      !isLoadingMore &&
      !documentSearchQuery
    ) {
      fetchDocuments(paging.after);
    }
  }, [
    paging.after,
    isDocumentsLoading,
    isLoadingMore,
    documentSearchQuery,
    fetchDocuments,
  ]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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

  useEffect(() => {
    fetchPermission();
  }, [fetchPermission]);

  useEffect(() => {
    const documentId = searchParams.get('document');
    if (!documentId || isDocumentsLoading || previewFile) {
      return;
    }
    const match = allDocuments.find((d) => d.id === documentId);
    if (match) {
      setPreviewFile(match);
    } else {
      showErrorToast(
        `${t('message.no-entity-available-with-name', {
          entity: t('label.document'),
        })} "${documentId}"`
      );
      setSearchParams((prev) => {
        prev.delete('document');

        return prev;
      });
    }
  }, [
    allDocuments,
    isDocumentsLoading,
    previewFile,
    searchParams,
    t,
    setSearchParams,
  ]);

  const handleDeleteFile = useCallback((file: ContextFile) => {
    setFileToDelete(file);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setFileToDelete(undefined);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!fileToDelete) {
      return;
    }

    try {
      setIsDeletingFile(true);
      await deleteDriveFile(fileToDelete.id, false);
      setAllDocuments((prev) =>
        prev.filter((document) => document.id !== fileToDelete.id)
      );
      setTotalFileCount((prev) => prev - 1);
      setGlobalFileCount((prev) => prev - 1);
      setLastFilesDeleted([fileToDelete]);
      showSuccessToast(
        t('server.entity-deleted-success', {
          entity: t('label.document'),
        })
      );
      setFileToDelete(undefined);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeletingFile(false);
    }
  }, [fileToDelete, t]);

  const handleFileMoved = useCallback(
    (file: ContextFile, targetFolderId: string | null) => {
      if (targetFolderId === null) {
        setAllDocuments((prev) =>
          prev.map((d) => (d.id === file.id ? { ...d, folder: undefined } : d))
        );
      } else {
        const targetFolder = folders.find((f) => f.id === targetFolderId);
        setAllDocuments((prev) =>
          prev.map((d) =>
            d.id === file.id
              ? {
                  ...d,
                  folder: {
                    ...d.folder,
                    id: targetFolderId,
                    name: targetFolder?.name ?? targetFolderId,
                    displayName: targetFolder?.displayName,
                    type: d.folder?.type ?? 'folder',
                  },
                }
              : d
          )
        );
      }
      setLastFileMoved({ file, targetFolderId });
    },
    [folders]
  );

  const handlePreview = useCallback(
    (file: ContextFile | undefined) => {
      setPreviewFile(file);
      setSearchParams((prev) => {
        if (file?.id) {
          prev.set('document', file.id);
        } else {
          prev.delete('document');
        }

        return prev;
      });
    },
    [setSearchParams]
  );

  const handleSelectFile = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }

      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    setIsBulkDeleteModalOpen(true);
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    setIsBulkDeleting(true);
    try {
      const result = await bulkDeleteDriveFiles(Array.from(selectedIds), false);
      const deletedIds = getSuccessfulIds(result);
      const failedCount = result.numberOfRowsFailed ?? 0;
      const deletedDocuments = allDocuments.filter((d) => deletedIds.has(d.id));

      setAllDocuments((prev) => prev.filter((d) => !deletedIds.has(d.id)));
      setTotalFileCount((prev) => prev - deletedIds.size);
      setGlobalFileCount((prev) => prev - deletedIds.size);
      if (deletedDocuments.length > 0) {
        setLastFilesDeleted(deletedDocuments);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));

        return next;
      });

      if (deletedIds.size > 0) {
        showSuccessToast(
          t('server.entity-deleted-success', {
            entity: t('label.document-plural'),
          })
        );
      }
      if (failedCount > 0) {
        showErrorToast(
          t('server.delete-entity-error', {
            entity: t('label.document-plural'),
          })
        );
      }
      if (failedCount === 0) {
        setIsBulkDeleteModalOpen(false);
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    }

    setIsBulkDeleting(false);
  }, [allDocuments, selectedIds, t]);

  const handleBulkDownload = useCallback(async () => {
    try {
      const blob = await downloadDriveFiles(Array.from(selectedIds));
      downloadBlob(blob, 'context-center-documents.zip');
      setSelectedIds(new Set());
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [selectedIds]);

  const handleBulkMove = useCallback(
    async (targetFolderId: string) => {
      try {
        const result = await bulkMoveFilesToFolder(
          Array.from(selectedIds),
          targetFolderId
        );
        const movedIds = getSuccessfulIds(result);
        const failedCount = result.numberOfRowsFailed ?? 0;
        const targetFolder = folders.find((f) => f.id === targetFolderId);

        setAllDocuments((prev) =>
          prev.map((d) => {
            if (!movedIds.has(d.id)) {
              return d;
            }

            return {
              ...d,
              folder: {
                ...d.folder,
                id: targetFolderId,
                name: targetFolder?.name ?? targetFolderId,
                displayName: targetFolder?.displayName,
                type: d.folder?.type ?? 'folder',
              },
            };
          })
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          movedIds.forEach((id) => next.delete(id));

          return next;
        });

        if (movedIds.size > 0) {
          showSuccessToast(
            t('message.entity-moved-successfully', {
              entity: t('label.document-plural'),
            })
          );
        }
        if (failedCount > 0) {
          showErrorToast(
            t('server.move-entity-error', {
              entity: t('label.document-plural'),
            })
          );
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [folders, selectedIds, t]
  );

  const handleUploaded = useCallback((newFiles: ContextFile[]) => {
    setAllDocuments((prev) => [...newFiles, ...prev]);
    setTotalFileCount((prev) => prev + newFiles.length);
    setGlobalFileCount((prev) => prev + newFiles.length);
  }, []);

  return (
    <Box
      className={`tw:w-full tw:h-full tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-documents-page"
      direction="col">
      <ContextCenterHeader
        breadcrumbs={[
          {
            label: t('label.context-center'),
            href: contextCenterClassBase.getContextCenterPath(),
          },
          {
            label: t('label.document-plural'),
          },
        ]}
        hasPermission={hasCreatePermission}
        searchPlaceholder={t('label.search-entity', {
          entity: t('label.document-plural'),
        })}
        searchQuery={documentSearchQuery}
        subtitle={t('message.context-center-documents-subtitle')}
        title={t('label.document-plural')}
        onSearch={setDocumentSearchQuery}
        onUploadFile={() => setIsUploadModalOpen(true)}
      />

      <ReflexContainer
        className="tw:flex-1 tw:overflow-hidden"
        orientation="vertical">
        <ReflexElement className="tw:min-w-70" flex={0.25} minSize={280}>
          <DocumentFolderView
            canCreate={hasCreatePermission}
            canDelete={hasDeletePermission}
            lastFileMoved={lastFileMoved}
            lastFilesDeleted={lastFilesDeleted}
            selectedFolderId={selectedFolderId}
            totalFileCount={globalFileCount}
            onFoldersLoaded={setFolders}
            onSelectFolder={setSelectedFolderId}
          />
        </ReflexElement>

        <ReflexSplitter
          className="splitter left-panel-splitter"
          style={{ zIndex: 0 }}>
          <div className="panel-grabber-vertical">
            <div className="handle-icon handle-icon-vertical" />
          </div>
        </ReflexSplitter>

        <ReflexElement flex={0.75} minSize={400}>
          <Box className="tw:h-full tw:overflow-hidden" gap={4}>
            <DocumentsView
              canDelete={hasDeletePermission}
              canEdit={hasEditPermission}
              data={allDocuments}
              folders={folderOptions}
              isLoading={isDocumentsLoading}
              isLoadingMore={isLoadingMore}
              previewFileId={previewFile?.id}
              selectedIds={selectedIds}
              totalFileCount={totalFileCount}
              onBulkDelete={handleBulkDelete}
              onBulkDownload={handleBulkDownload}
              onBulkMove={handleBulkMove}
              onDeleteFile={handleDeleteFile}
              onDownload={handleAssetDownload}
              onFileMoved={handleFileMoved}
              onPreview={handlePreview}
              onScrollEnd={handleLoadMore}
              onSelectFile={handleSelectFile}
            />
            {previewFile && (
              <DocumentPreviewPanel
                file={previewFile}
                url={previewFileUrl}
                onClose={() => handlePreview(undefined)}
              />
            )}
          </Box>
        </ReflexElement>
      </ReflexContainer>

      <UploadDocumentModal
        folderFqn={selectedFolderFqn}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={handleUploaded}
      />

      {fileToDelete && (
        <DeleteModal
          entityTitle={getEntityName(fileToDelete)}
          isDeleting={isDeletingFile}
          message={t('message.soft-delete-archive-message', {
            entity: t('label.document').toLowerCase(),
          })}
          open={Boolean(fileToDelete)}
          onCancel={handleCancelDelete}
          onDelete={handleConfirmDelete}
        />
      )}

      <DeleteModal
        entityTitle={`${selectedIds.size} ${(selectedIds.size === 1
          ? t('label.document')
          : t('label.document-plural')
        ).toLowerCase()}`}
        isDeleting={isBulkDeleting}
        message={t('message.soft-delete-message-for-n-entities', {
          count: selectedIds.size,
          entity: (selectedIds.size === 1
            ? t('label.document')
            : t('label.document-plural')
          ).toLowerCase(),
        })}
        open={isBulkDeleteModalOpen}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onDelete={handleConfirmBulkDelete}
      />
    </Box>
  );
};

export default ContextCenterDocumentsPage;
