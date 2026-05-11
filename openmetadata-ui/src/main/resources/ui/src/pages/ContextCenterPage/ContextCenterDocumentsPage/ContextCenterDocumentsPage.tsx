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

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import DocumentsView from '../../../components/ContextCenter/DocumentsView/DocumentsView.component';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { ROUTES } from '../../../constants/constants';
import { MOCK_FOLDERS } from '../ContextCenterPage.mock';
import {
  CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK,
  createArticleKnowledgePage,
} from '../../../utils/ContextCenterUtils';

const ContextCenterDocumentsPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleCreateArticle = useCallback(async () => {
    await createArticleKnowledgePage(currentUser?.id ?? '', navigate);
  }, [currentUser, navigate]);

  return (
    <div
      className="tw:flex tw:flex-col tw:w-full tw:h-full tw:bg-secondary tw:px-5"
      data-testid="context-center-documents-page">
      <ContextCenterHeader
        breadcrumbs={[
          { name: t('label.context-center'), url: ROUTES.CONTEXT_CENTER },
          {
            activeTitle: true,
            name: t('label.document-plural'),
            url: '',
          },
        ]}
        subtitle={t('message.context-center-documents-subtitle', {
          defaultValue: 'Manage and organize your uploaded documents',
        })}
        title={t('label.document-plural')}
        onCreateArticle={handleCreateArticle}
        onUploadFile={() => setIsUploadModalOpen(true)}
      />

      <div className="tw:flex-1 tw:overflow-hidden">
        <DocumentsView folders={MOCK_FOLDERS} />
      </div>

      <UploadDocumentModal
        entityLink={CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
};

export default ContextCenterDocumentsPage;
