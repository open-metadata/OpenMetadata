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

import { Home02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import contextCenterClassBase from 'utils/ContextCenterClassBase';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import DocumentsView from '../../../components/ContextCenter/DocumentsView/DocumentsView.component';
import { DocFile } from '../../../components/ContextCenter/DocumentsView/DocumentsView.interface';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { deleteAsset } from '../../../rest/assetAPI';
import {
  assetToDocumentItem,
  CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK,
  fetchContextCenterDocuments,
  handleAssetDownload,
} from '../../../utils/ContextCenterUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const ContextCenterDocumentsPage: FC = () => {
  const { t } = useTranslation();
  const { getResourcePermission } = usePermissionProvider();
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DocFile>();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const { hasCreatePermission, hasDeletePermission } = useMemo(
    () => ({
      hasCreatePermission: permissions.Create,
      hasDeletePermission: permissions.Delete,
    }),
    [permissions.Create, permissions.Delete]
  );

  const fetchDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    try {
      const assets = await fetchContextCenterDocuments();
      setDocuments(assets.map(assetToDocumentItem));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, []);

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

  const handleDeleteFile = useCallback((file: DocFile) => {
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
      await deleteAsset(fileToDelete.id, true);
      setDocuments((prev) =>
        prev.filter((document) => document.id !== fileToDelete.id)
      );
      showSuccessToast(
        t('server.entity-deleted-successfully', {
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

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-documents-page">
      <ContextCenterHeader
        breadcrumbs={[
          {
            name: '',
            icon: <Home02 size={14} />,
            url: '/',
            activeTitle: true,
          },
          {
            name: t('label.context-center'),
            url: contextCenterClassBase.getContextCenterPath(),
          },
          {
            activeTitle: true,
            name: t('label.document-plural'),
            url: '',
          },
        ]}
        hasPermission={hasCreatePermission}
        subtitle={t('message.context-center-documents-subtitle')}
        title={t('label.document-plural')}
        onUploadFile={() => setIsUploadModalOpen(true)}
      />

      <div className="tw:flex-1 tw:overflow-hidden">
        <DocumentsView
          canDelete={hasDeletePermission}
          data={documents}
          isLoading={isDocumentsLoading}
          onDeleteFile={handleDeleteFile}
          onDownload={handleAssetDownload}
        />
      </div>

      <UploadDocumentModal
        entityLink={CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={() => fetchDocuments()}
      />

      {fileToDelete && (
        <DeleteModal
          entityTitle={fileToDelete.name}
          isDeleting={isDeletingFile}
          message={t('message.delete-entity-message', {
            entity: fileToDelete.name,
          })}
          open={Boolean(fileToDelete)}
          onCancel={handleCancelDelete}
          onDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
};

export default ContextCenterDocumentsPage;
