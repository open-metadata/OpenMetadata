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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown, Home02, UploadCloud02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AlertBar from '../../../components/AlertBar/AlertBar';
import { ArticleCardItem } from '../../../components/ContextCenter/ArticleCard/ArticleCard.interface';
import ArticleListSection from '../../../components/ContextCenter/ArticleListSection/ArticleListSection.component';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { UploadedDocumentItem } from '../../../components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';
import UploadedDocumentsSection from '../../../components/ContextCenter/UploadedDocumentsSection/UploadedDocumentsSection.component';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useAlertStore } from '../../../hooks/useAlertStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  CreateKnowledgePage,
  KnowledgePage,
  PageType,
} from '../../../interface/knowledge-center.interface';
import { listContextFiles } from '../../../rest/assetAPI';
import {
  getListKnowledgePages,
  postKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import {
  contextFileToUploadedDocumentItem,
  createArticleKnowledgePage,
  handleAssetDownload,
  knowledgePageToArticleItem,
} from '../../../utils/ContextCenterUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const RECENT_ARTICLES_LIMIT = 20;
const RECENT_DOCUMENTS_LIMIT = 20;

const ContextCenterDashboardPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alert } = useAlertStore();
  const { currentUser } = useApplicationStore();
  const { getResourcePermission } = usePermissionProvider();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [articles, setArticles] = useState<ArticleCardItem[]>([]);
  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const hasCreatePermission = useMemo(
    () => permissions.Create,
    [permissions.Create]
  );

  const handleCreateArticle = useCallback(async () => {
    await createArticleKnowledgePage(currentUser?.id ?? '', navigate);
  }, [currentUser, navigate]);

  const handleAddQuickLink = useCallback(
    async (formData: QuickLinkFormModalFormData) => {
      try {
        const tags = [
          ...(formData.tags ?? []),
          ...(formData.glossaryTerms ?? []),
        ];
        const data: CreateKnowledgePage = {
          description: formData.description,
          displayName: formData.displayName ?? '',
          name: `${PageType.QUICK_LINK}_${cryptoRandomString({
            length: 8,
            type: 'alphanumeric',
          })}`,
          owners: [{ id: currentUser?.id ?? '', type: 'user' }],
          page: { url: formData.url },
          pageType: PageType.QUICK_LINK,
          relatedEntities: formData?.relatedEntities,
          tags,
        };
        const response = await postKnowledgePage(data);
        showSuccessToast(
          t('message.entity-saved-successfully', {
            entity: t('label.quick-link'),
          })
        );
        setArticles((prev) => [
          knowledgePageToArticleItem(response, t('label.untitled')),
          ...prev,
        ]);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [currentUser, t]
  );

  const fetchRecentArticles = useCallback(async () => {
    setIsArticlesLoading(true);
    try {
      const response = await getListKnowledgePages({
        fields: 'tags,page',
        limit: RECENT_ARTICLES_LIMIT,
        pageType: PageType.ARTICLE,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setArticles(
        response.data.map((page: KnowledgePage) =>
          knowledgePageToArticleItem(page, t('label.untitled'))
        )
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsArticlesLoading(false);
    }
  }, [t]);

  const fetchDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    try {
      const files = await listContextFiles(RECENT_DOCUMENTS_LIMIT);
      setDocuments(files.map(contextFileToUploadedDocumentItem));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDocumentsLoading(false);
    }
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
    fetchRecentArticles();
    fetchDocuments();
    fetchPermission();
  }, [fetchRecentArticles, fetchDocuments, fetchPermission]);

  const handleUploaded = useCallback((newFiles: ContextFile[]) => {
    setDocuments((prev) => [
      ...newFiles.map(contextFileToUploadedDocumentItem),
      ...prev,
    ]);
  }, []);

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-dashboard-page">
      {alert && <AlertBar message={alert.message} type={alert.type} />}
      <ContextCenterHeader
        actionsSlot={
          <div className="tw:flex tw:items-center tw:gap-3 tw:shrink-0">
            <Button
              color="secondary"
              iconLeading={UploadCloud02}
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}>
              {t('label.upload-file')}
            </Button>
            <LimitWrapper resource="knowledgeCenter">
              <Dropdown.Root>
                <Button
                  color="primary"
                  data-testid="create-knowledge-page-btn"
                  iconTrailing={ChevronDown}>
                  {t('label.create')}
                </Button>

                <Dropdown.Popover className="tw:w-30">
                  <Dropdown.Menu aria-label="create knowledge page">
                    <Dropdown.Item
                      data-testid="create-article-btn"
                      key={PageType.ARTICLE}
                      onAction={handleCreateArticle}>
                      {t('label.article')}
                    </Dropdown.Item>

                    <Dropdown.Item
                      data-testid="create-quick-link-btn"
                      key={PageType.QUICK_LINK}
                      onAction={() => setShowAddLinkModal(true)}>
                      {t('label.quick-link')}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            </LimitWrapper>
          </div>
        }
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
            name: t('label.dashboard'),
            url: '',
          },
        ]}
        hasPermission={hasCreatePermission}
        subtitle={t('message.context-center-dashboard-subtitle')}
        title={t('label.dashboard')}
      />

      <div className="tw:flex tw:flex-col tw:gap-6">
        <ArticleListSection
          articles={articles}
          isLoading={isArticlesLoading}
          subtitle={t('message.internal-knowledge-base-agent-training')}
          title={t('label.article-amp-quick-link-plural')}
          onViewAll={() =>
            navigate(contextCenterClassBase.getArticlesListPath())
          }
        />

        <UploadedDocumentsSection
          documents={documents}
          isLoading={isDocumentsLoading}
          onDownload={handleAssetDownload}
          onViewAll={() =>
            navigate(contextCenterClassBase.getDocumentsListPath())
          }
        />
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={handleUploaded}
      />

      <QuickLinkFormModal
        isOpen={showAddLinkModal}
        permissions={
          {
            EditAll: true,
            EditDescription: true,
            EditDisplayName: true,
            EditTags: true,
          } as OperationPermission
        }
        onCancel={() => setShowAddLinkModal(false)}
        onSave={async (data) => {
          await handleAddQuickLink(data);
          setShowAddLinkModal(false);
        }}
      />
    </div>
  );
};

export default ContextCenterDashboardPage;
