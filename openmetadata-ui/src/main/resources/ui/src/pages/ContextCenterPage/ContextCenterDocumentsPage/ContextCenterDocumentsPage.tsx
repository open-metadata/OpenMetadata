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
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { useSearchParams } from 'react-router-dom';
import AlertBar from '../../../components/AlertBar/AlertBar';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import '../../../components/common/ResizablePanels/resizable-panels.less';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import DocumentFolderView from '../../../components/ContextCenter/DocumentsView/DocumentFolderView.component';
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
import { useAlertStore } from '../../../hooks/useAlertStore';
import {
  deleteDriveFile,
  listContextFiles,
  moveFileToFolder,
} from '../../../rest/assetAPI';
import { searchQuery as fetchSearchResults } from '../../../rest/searchAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { handleAssetDownload } from '../../../utils/ContextCenterPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const ContextCenterDocumentsPage: FC = () => {
  const { t } = useTranslation();
  const { alert } = useAlertStore();
  const { getResourcePermission } = usePermissionProvider();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allDocuments, setAllDocuments] = useState<ContextFile[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
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
  const [previewFile, setPreviewFile] = useState<ContextFile | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const documents = useMemo(() => {
    if (!selectedFolderId) {
      return allDocuments;
    }

    return allDocuments.filter((d) => d.folder?.id === selectedFolderId);
  }, [allDocuments, selectedFolderId]);

  const fetchDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    try {
      if (documentSearchQuery) {
        const results = await fetchSearchResults({
          query: documentSearchQuery,
          searchIndex: SearchIndex.DRIVE_FILE,
          sortField: 'updatedAt',
          sortOrder: 'desc',
        });
        setAllDocuments(
          results.hits.hits.map((hit) => hit._source as unknown as ContextFile)
        );
      } else {
        const { data: files } = await listContextFiles();
        setAllDocuments(files);
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDocumentsLoading(false);
    }
  }, [documentSearchQuery]);

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
    (file: ContextFile, targetFolderId: string) => {
      setAllDocuments((prev) =>
        prev.map((d) =>
          d.id === file.id
            ? {
                ...d,
                folder: {
                  ...d.folder,
                  id: targetFolderId,
                  type: d.folder?.type ?? 'folder',
                },
              }
            : d
        )
      );
    },
    []
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
    const filesToDelete = allDocuments.filter((d) => selectedIds.has(d.id));

    setIsBulkDeleting(true);
    const results = await Promise.allSettled(
      filesToDelete.map((f) => deleteDriveFile(f.id, false))
    );

    const deletedIds = new Set(
      filesToDelete
        .filter((_, i) => results[i].status === 'fulfilled')
        .map((f) => f.id)
    );
    const failedCount = results.filter((r) => r.status === 'rejected').length;

    setAllDocuments((prev) => prev.filter((d) => !deletedIds.has(d.id)));
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
        t('server.delete-entity-error', { entity: t('label.document-plural') })
      );
    }
    if (failedCount === 0) {
      setIsBulkDeleteModalOpen(false);
    }

    setIsBulkDeleting(false);
  }, [selectedIds, allDocuments, t]);

  const handleBulkDownload = useCallback(() => {
    allDocuments
      .filter((d) => selectedIds.has(d.id))
      .forEach((f) => handleAssetDownload(f));
    setSelectedIds(new Set());
  }, [allDocuments, selectedIds]);

  const handleBulkMove = useCallback(
    async (targetFolderId: string) => {
      const filesToMove = allDocuments.filter((d) => selectedIds.has(d.id));

      const results = await Promise.allSettled(
        filesToMove.map((f) => moveFileToFolder(f.id, targetFolderId))
      );

      const movedIds = new Set(
        filesToMove
          .filter((_, i) => results[i].status === 'fulfilled')
          .map((f) => f.id)
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;

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
    },
    [allDocuments, selectedIds, t]
  );

  return (
    <Box
      className={`tw:w-full tw:h-full tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-documents-page"
      direction="col">
      {alert && <AlertBar message={alert.message} type={alert.type} />}
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
            files={allDocuments}
            selectedFolderId={selectedFolderId}
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
              data={documents}
              folders={folderOptions}
              isLoading={isDocumentsLoading}
              previewFileId={previewFile?.id}
              selectedIds={selectedIds}
              onBulkDelete={handleBulkDelete}
              onBulkDownload={handleBulkDownload}
              onBulkMove={handleBulkMove}
              onDeleteFile={handleDeleteFile}
              onDownload={handleAssetDownload}
              onFileMoved={handleFileMoved}
              onPreview={handlePreview}
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
        onUploaded={(newFiles) =>
          setAllDocuments((prev) => [...newFiles, ...prev])
        }
      />

      {fileToDelete && (
        <DeleteModal
          entityTitle={getEntityName(fileToDelete)}
          isDeleting={isDeletingFile}
          message={t('message.soft-delete-message-for-entity', {
            entity: getEntityName(fileToDelete),
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
