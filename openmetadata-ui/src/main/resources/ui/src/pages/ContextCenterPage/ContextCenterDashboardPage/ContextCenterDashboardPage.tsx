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

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ArticleListSection from '../../../components/ContextCenter/ArticleListSection/ArticleListSection.component';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import UploadedDocumentsSection from '../../../components/ContextCenter/UploadedDocumentsSection/UploadedDocumentsSection.component';
import { ROUTES } from '../../../constants/constants';
import { MOCK_ARTICLES, MOCK_DOCUMENTS } from '../ContextCenterPage.mock';

const ContextCenterDashboardPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
        onCreateArticle={() => navigate(ROUTES.CONTEXT_CENTER_ARTICLES)}
        onUploadFile={() => setIsUploadModalOpen(true)}
      />

      <div className="tw:flex tw:flex-col tw:gap-6">
        <ArticleListSection
          articles={MOCK_ARTICLES}
          subtitle={t('message.internal-knowledge-base-agent-training', {
            defaultValue: 'Internal knowledge base for agent training',
          })}
          title={t('label.article-amp-quick-link-plural')}
          onViewAll={() => navigate(ROUTES.CONTEXT_CENTER_ARTICLES)}
        />

        <UploadedDocumentsSection
          documents={MOCK_DOCUMENTS}
          onViewAll={() => navigate(ROUTES.CONTEXT_CENTER_DOCUMENTS)}
        />
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
};

export default ContextCenterDashboardPage;
