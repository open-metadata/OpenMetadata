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

import { AxiosError } from 'axios';
import { ArticleCardItem } from 'components/ContextCenter/ArticleCard/ArticleCard.interface';
import ArticleListSection from 'components/ContextCenter/ArticleListSection/ArticleListSection.component';
import ContextCenterHeader from 'components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import UploadDocumentModal from 'components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { UploadedDocumentItem } from 'components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';
import UploadedDocumentsSection from 'components/ContextCenter/UploadedDocumentsSection/UploadedDocumentsSection.component';
import { ROUTES } from 'constants/constants';
import { Asset } from 'generated/attachments/asset';
import { useApplicationStore } from 'hooks/useApplicationStore';
import { KnowledgePage, PageType } from 'interface/knowledge-center.interface';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getListKnowledgePages } from 'rest/knowledgeCenterAPI';
import {
  CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK,
  assetToDocumentItem,
  createArticleKnowledgePage,
  fetchContextCenterDocuments,
  knowledgePageToArticleItem,
} from 'utils/ContextCenterUtils';
import { showErrorToast } from 'utils/ToastUtils';

const RECENT_ARTICLES_LIMIT = 6;

const ContextCenterDashboardPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [articles, setArticles] = useState<ArticleCardItem[]>([]);
  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);

  const handleCreateArticle = useCallback(async () => {
    await createArticleKnowledgePage(currentUser?.id ?? '', navigate);
  }, [currentUser, navigate]);

  const fetchRecentArticles = useCallback(async () => {
    setIsArticlesLoading(true);
    try {
      const response = await getListKnowledgePages({
        fields: 'tags',
        limit: RECENT_ARTICLES_LIMIT,
        pageType: PageType.ARTICLE,
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

  useEffect(() => {
    fetchRecentArticles();
    fetchDocuments();
  }, [fetchRecentArticles, fetchDocuments]);

  const handleUploaded = useCallback((newAssets: Asset[]) => {
    setDocuments((prev) => [...newAssets.map(assetToDocumentItem), ...prev]);
  }, []);

  return (
    <div
      className="tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:px-5"
      data-testid="context-center-dashboard-page">
      <ContextCenterHeader
        breadcrumbs={[
          { name: t('label.context-center'), url: ROUTES.CONTEXT_CENTER },
          {
            activeTitle: true,
            name: t('label.dashboard'),
            url: '',
          },
        ]}
        subtitle={t('message.context-center-dashboard-subtitle', {
          defaultValue: 'Overview of your knowledge base and document library',
        })}
        title={t('label.dashboard')}
        onCreateArticle={handleCreateArticle}
        onUploadFile={() => setIsUploadModalOpen(true)}
      />

      <div className="tw:flex tw:flex-col tw:gap-6">
        <ArticleListSection
          articles={articles}
          isLoading={isArticlesLoading}
          subtitle={t('message.internal-knowledge-base-agent-training', {
            defaultValue: 'Internal knowledge base for agent training',
          })}
          title={t('label.article-amp-quick-link-plural')}
          onViewAll={() => navigate(ROUTES.CONTEXT_CENTER_ARTICLES)}
        />

        <UploadedDocumentsSection
          documents={documents}
          isLoading={isDocumentsLoading}
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
