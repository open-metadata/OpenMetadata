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

import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
    CreateKnowledgePage,
    PageType
} from '../../../interface/knowledge-center.interface';
import { postKnowledgePage } from '../../../rest/knowledgeCenterAPI';
import { createArticleKnowledgePage } from '../../../utils/ContextCenterPureUtils';
import {
    CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY,
    CONTEXT_CENTER_DOCUMENTS_COUNT_QUERY_KEY
} from '../../../utils/ContextCenterQueryKeys';
import {
    showErrorToast,
    showSuccessToast
} from '../../../utils/ToastUtils';
import {
    QuickLinkFormModal,
    QuickLinkFormModalFormData
} from '../../KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import { Intent } from '../../platform/ai-shell/AppModule.types';
import { LiveRefreshBoundary } from '../../platform/ai-shell/LiveRefreshBoundary/LiveRefreshBoundary';
import { useIntent } from '../../platform/ai-shell/useIntent';
import UploadDocumentModal from '../UploadDocumentModal/UploadDocumentModal.component';
import './ContextCenterLayout.less';

const ADD_QUICK_LINK_PERMISSIONS = {
  EditAll: true,
  EditDisplayName: true,
  EditDescription: true,
  EditTags: true,
} as unknown as OperationPermission;

const ContextCenterLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const queryClient = useQueryClient();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAddQuickLinkOpen, setIsAddQuickLinkOpen] = useState(false);

  useIntent(
    Intent.UploadFile,
    useCallback(() => setIsUploadModalOpen(true), [])
  );

  useIntent(
    Intent.CreateArticle,
    useCallback(() => {
      createArticleKnowledgePage(currentUser?.id ?? '', navigate);
    }, [currentUser?.id, navigate])
  );

  useIntent(
    Intent.AddQuickLink,
    useCallback(() => setIsAddQuickLinkOpen(true), [])
  );

  const handleSaveQuickLink = useCallback(
    async (formData: QuickLinkFormModalFormData) => {
      try {
        const tags = [
          ...(formData.tags ?? []),
          ...(formData.glossaryTerms ?? []),
        ];
        const data: CreateKnowledgePage = {
          name: `${PageType.QUICK_LINK}_${cryptoRandomString({
            length: 8,
            type: 'alphanumeric',
          })}`,
          displayName: formData.displayName ?? '',
          description: formData.description,
          pageType: PageType.QUICK_LINK,
          page: { url: formData.url },
          owners: currentUser?.id ? [{ type: 'user', id: currentUser.id }] : [],
          tags,
          relatedEntities: formData.relatedEntities,
        };
        await postKnowledgePage(data);
        queryClient.invalidateQueries({
          queryKey: CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY,
        });
        showSuccessToast(
          t('message.entity-saved-successfully', {
            entity: t('label.quick-link'),
          })
        );
        setIsAddQuickLinkOpen(false);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [currentUser?.id, queryClient, t]
  );

  return (
    <div className="context-center-layout tw:flex tw:flex-col tw:h-full tw:overflow-auto tw:pt-5">
      {/* Reloads the embedded page on a contextMemory/page change for the active CC route
          (registry → markRouteDirty); the layout, its modals and intents stay mounted. */}
      <LiveRefreshBoundary>{children}</LiveRefreshBoundary>
      {isUploadModalOpen && (
        <UploadDocumentModal
          isOpen
          onClose={() => setIsUploadModalOpen(false)}
          onUploaded={() => {
            queryClient.invalidateQueries({
              queryKey: CONTEXT_CENTER_DOCUMENTS_COUNT_QUERY_KEY,
            });
            setIsUploadModalOpen(false);
          }}
        />
      )}
      <QuickLinkFormModal
        isOpen={isAddQuickLinkOpen}
        permissions={ADD_QUICK_LINK_PERMISSIONS}
        onCancel={() => setIsAddQuickLinkOpen(false)}
        onSave={handleSaveQuickLink}
      />
    </div>
  );
};

export default ContextCenterLayout;
