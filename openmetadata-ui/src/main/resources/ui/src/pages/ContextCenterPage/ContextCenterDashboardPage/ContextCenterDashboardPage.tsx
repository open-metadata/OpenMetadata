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
import {
  ChevronDown,
  File05,
  Home02,
  Sun,
  UploadCloud02,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import AlertBar from '../../../components/AlertBar/AlertBar';
import AiActivitySection from '../../../components/ContextCenter/AiActivitySection/AiActivitySection.component';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import ContextKnowledgePillarCard from '../../../components/ContextCenter/ContextKnowledgePillarCard/ContextKnowledgePillarCard.component';
import NeedsAttentionSection from '../../../components/ContextCenter/NeedsAttentionSection/NeedsAttentionSection.component';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import { UploadedDocumentItem } from '../../../components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import {
  RECENT_DASHBOARD_ARTICLES_LIMIT,
  RECENT_DASHBOARD_DOCUMENTS_LIMIT,
} from '../../../constants/ContextCenter.constants';
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
import { listContextFiles, listFolders } from '../../../rest/assetAPI';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import {
  getListKnowledgePages,
  postKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import {
  contextFileToUploadedDocumentItem,
  createArticleKnowledgePage,
} from '../../../utils/ContextCenterUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const ContextCenterDashboardPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alert } = useAlertStore();
  const { currentUser } = useApplicationStore();
  const { getResourcePermission } = usePermissionProvider();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [articles, setArticles] = useState<KnowledgePage[]>([]);
  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [memories, setMemories] = useState<
    Array<{ title: string; meta: string }>
  >([]);
  const [memoriesCount, setMemoriesCount] = useState(0);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(true);
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
        const articleData = await postKnowledgePage(data);
        showSuccessToast(
          t('message.entity-saved-successfully', {
            entity: t('label.quick-link'),
          })
        );
        setArticles((prev) => [articleData, ...prev]);
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
        limit: RECENT_DASHBOARD_ARTICLES_LIMIT,
        pageType: PageType.ARTICLE,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setArticles(response.data.map((page: KnowledgePage) => page));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsArticlesLoading(false);
    }
  }, [t]);

  const fetchDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    try {
      const files = await listContextFiles(RECENT_DASHBOARD_DOCUMENTS_LIMIT, {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setDocuments(files.map(contextFileToUploadedDocumentItem));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const folders = await listFolders();
      setFolderCount(folders.length);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, []);

  const fetchMemories = useCallback(async () => {
    setIsMemoriesLoading(true);
    try {
      const response = await getListContextMemories({
        limit: 3,
        sort: 'updatedAt',
      });
      setMemoriesCount(response.paging.total ?? response.data.length);
      setMemories(
        response.data.map((m) => ({
          title: m.title ?? m.name,
          meta: m.usageCount ? `cited ${m.usageCount}×` : '',
        }))
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMemoriesLoading(false);
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
    fetchFolders();
    fetchMemories();
    fetchPermission();
  }, [
    fetchRecentArticles,
    fetchDocuments,
    fetchFolders,
    fetchMemories,
    fetchPermission,
  ]);

  const handleUploaded = useCallback((newFiles: ContextFile[]) => {
    setDocuments((prev) => [
      ...newFiles.map(contextFileToUploadedDocumentItem),
      ...prev,
    ]);
  }, []);

  const articlesRecentItems = useMemo(
    () =>
      articles.map((article) => ({
        title: getEntityName(article),
        meta: `${article?.owners?.[0]?.displayName || '-'} · ${getRelativeTime(
          article.updatedAt
        )}`,
      })),
    [articles]
  );

  const documentsRecentItems = useMemo(
    () =>
      documents.map((d) => ({
        title: d.name,
        meta: `${d.updatedBy} · ${getRelativeTime(d.updatedAt)}`,
      })),
    [documents]
  );

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:p-5 tw:pt-0 tw:h-full ${contextCenterClassBase.getContainerClassName()}`}
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

      <div className="tw:flex tw:flex-col tw:gap-6 tw:h-full">
        <div className="tw:grid tw:grid-cols-3 tw:gap-4">
          <ContextKnowledgePillarCard
            cta={t('label.view-all-entity', {
              entity: t('label.article-plural'),
            })}
            icon={File05}
            recent={articlesRecentItems}
            stat={isArticlesLoading ? '—' : String(articles.length)}
            statSub={t('label.published')}
            subtitle={t('message.long-form-authored-versioned')}
            title={t('label.article-plural')}
            tone="info"
            trend="0 this week"
            onClick={() =>
              navigate(contextCenterClassBase.getArticlesListPath())
            }
          />
          <ContextKnowledgePillarCard
            cta={t('label.view-all-entity', {
              entity: t('label.document-plural'),
            })}
            icon={FolderIcon}
            recent={documentsRecentItems}
            stat={isDocumentsLoading ? '—' : String(documents.length)}
            statSub={t('label.file-plural')}
            statSubSecondary={`${folderCount} ${t('label.folder-plural')}`}
            subtitle={t('message.files-uploaded-for-ai-retrieval')}
            title={t('label.document-plural')}
            tone="warning"
            trend="0 processing"
            onClick={() =>
              navigate(contextCenterClassBase.getDocumentsListPath())
            }
          />
          <ContextKnowledgePillarCard
            cta={t('label.view-all-entity', {
              entity: t('label.memory-plural'),
            })}
            icon={Sun}
            recent={memories}
            stat={isMemoriesLoading ? '—' : String(memoriesCount)}
            statSub={t('label.memory-plural')}
            subtitle={t('message.atomic-facts-ai-should-remember')}
            title={t('label.memory-plural')}
            tone="success"
            trend="0 cites today"
            onClick={() =>
              navigate(contextCenterClassBase.getMemoriesListPath())
            }
          />
        </div>

        <div
          className="tw:grid tw:gap-4 tw:h-full"
          style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <AiActivitySection items={[]} />
          <NeedsAttentionSection items={[]} />
        </div>
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
