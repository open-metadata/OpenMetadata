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
import { Asset } from 'generated/attachments/asset';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import contextCenterClassBase from 'utils/ContextCenterClassBase';
import { ArticleCardItem } from '../../../components/ContextCenter/ArticleCard/ArticleCard.interface';
import ArticleListSection from '../../../components/ContextCenter/ArticleListSection/ArticleListSection.component';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { UploadedDocumentItem } from '../../../components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';
import UploadedDocumentsSection from '../../../components/ContextCenter/UploadedDocumentsSection/UploadedDocumentsSection.component';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import {
  assetToDocumentItem,
  CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK,
  createArticleKnowledgePage,
  fetchContextCenterDocuments,
  handleDownload,
  knowledgePageToArticleItem,
} from '../../../utils/ContextCenterUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const RECENT_ARTICLES_LIMIT = 25;

const ContextCenterDashboardPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { getResourcePermission } = usePermissionProvider();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
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

  const fetchRecentArticles = useCallback(async () => {
    setIsArticlesLoading(true);
    try {
      const response = await getListKnowledgePages({
        fields: 'tags,page',
        limit: RECENT_ARTICLES_LIMIT,
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
      const assets = await fetchContextCenterDocuments();
      setDocuments(assets.map(assetToDocumentItem));
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

  const handleUploaded = useCallback((newAssets: Asset[]) => {
    setDocuments((prev) => [...prev, ...newAssets.map(assetToDocumentItem)]);
  }, []);

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-dashboard-page">
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
            name: t('label.dashboard'),
            url: '',
          },
        ]}
        hasPermission={hasCreatePermission}
        subtitle={t('message.context-center-dashboard-subtitle')}
        title={t('label.dashboard')}
        onCreateArticle={handleCreateArticle}
        onUploadFile={() => setIsUploadModalOpen(true)}
      />

      <div className="tw:flex tw:flex-col tw:gap-6">
        <ArticleListSection
          articles={articles}
          isLoading={isArticlesLoading}
          subtitle={t('message.internal-knowledge-base-agent-training')}
          title={t('label.article-amp-quick-link-plural')}
          onViewAll={() => navigate(ROUTES.CONTEXT_CENTER_ARTICLES)}
        />

        <UploadedDocumentsSection
          documents={documents}
          isLoading={isDocumentsLoading}
          onDownload={handleDownload}
          onViewAll={() => navigate(ROUTES.CONTEXT_CENTER_DOCUMENTS)}
        />
      </div>

      <UploadDocumentModal
        entityLink={CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={handleUploaded}
      />
    </div>
  );
};

export default ContextCenterDashboardPage;
