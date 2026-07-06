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

import {
  Box,
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  File05,
  File06,
  Sun,
  UploadCloud02,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import { ReactComponent as QuickLinkIcon } from '../../../assets/svg/quick-link.svg';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import ContextKnowledgePillarCard from '../../../components/ContextCenter/ContextKnowledgePillarCard/ContextKnowledgePillarCard.component';
import ContextSimplePillarCard from '../../../components/ContextCenter/ContextSimplePillarCard/ContextSimplePillarCard.component';
import DashboardFoldersCard from '../../../components/ContextCenter/DashboardFoldersCard/DashboardFoldersCard.component';
import UploadDocumentModal from '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import {
  MOST_CITED_MEMORIES_LIMIT,
  RECENT_DASHBOARD_ARTICLES_LIMIT,
  RECENT_DASHBOARD_DOCUMENTS_LIMIT,
  RECENT_DASHBOARD_MEMORIES_LIMIT,
} from '../../../constants/ContextCenter.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { Folder } from '../../../generated/entity/data/folder';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  CreateKnowledgePage,
  KnowledgePage,
  PageType,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import { listContextFiles, listFolders } from '../../../rest/assetAPI';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import {
  getListKnowledgePages,
  postKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { createArticleKnowledgePage } from '../../../utils/ContextCenterPureUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const ContextCenterDashboardPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { getResourcePermission } = usePermissionProvider();
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [articles, setArticles] = useState<KnowledgePage[]>([]);
  const [articlesCount, setArticlesCount] = useState(0);
  const [documents, setDocuments] = useState<ContextFile[]>([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [memories, setMemories] = useState<
    Array<{ title: string; meta: string[] }>
  >([]);
  const [memoriesCount, setMemoriesCount] = useState(0);
  const [mostCitedMemories, setMostCitedMemories] = useState<ContextMemory[]>(
    []
  );
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [isFoldersLoading, setIsFoldersLoading] = useState(true);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(true);
  const [isMostCitedLoading, setIsMostCitedLoading] = useState(true);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const folderCount = folders.length;

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
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setArticlesCount(response.paging.total ?? response.data.length);
      setArticles(response.data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsArticlesLoading(false);
    }
  }, [t]);

  const fetchDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    try {
      const response = await listContextFiles({
        limit: RECENT_DASHBOARD_DOCUMENTS_LIMIT,
      });
      setDocumentsCount(response.paging.total ?? response.data.length);
      setDocuments(response.data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    setIsFoldersLoading(true);
    try {
      const response = await listFolders();
      setFolders(response);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsFoldersLoading(false);
    }
  }, []);

  const fetchMemories = useCallback(async () => {
    setIsMemoriesLoading(true);
    try {
      const response = await getListContextMemories({
        limit: RECENT_DASHBOARD_MEMORIES_LIMIT,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setMemoriesCount(response.paging.total ?? response.data.length);
      setMemories(
        response.data.map((m) => ({
          title: m.title ?? m.name,
          meta: [`cited ${m.usageCount}×`],
        }))
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMemoriesLoading(false);
    }
  }, []);

  const fetchMostCitedMemories = useCallback(async () => {
    setIsMostCitedLoading(true);
    try {
      const response = await getListContextMemories({
        limit: MOST_CITED_MEMORIES_LIMIT,
        sortBy: 'usageCount',
        sortOrder: 'desc',
      });
      setMostCitedMemories(response.data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMostCitedLoading(false);
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
    fetchMostCitedMemories();
    fetchPermission();
  }, [
    fetchRecentArticles,
    fetchDocuments,
    fetchFolders,
    fetchMemories,
    fetchMostCitedMemories,
    fetchPermission,
  ]);

  const handleUploaded = useCallback((newFiles: ContextFile[]) => {
    setDocuments((prev) => [...newFiles, ...prev]);
  }, []);

  const articlesRecentItems = useMemo(
    () =>
      articles.map((article) => {
        const owner = getEntityName(article?.owners?.[0]);
        const time = getShortRelativeTime(article.updatedAt);
        const metaParts = [owner, time].filter(Boolean);
        const icon =
          article.pageType === PageType.QUICK_LINK ? (
            <QuickLinkIcon
              className="tw:text-quaternary tw:shrink-0"
              height={13}
              width={13}
            />
          ) : (
            <File06 className="tw:size-3 tw:text-quaternary tw:shrink-0" />
          );

        return {
          icon,
          meta: metaParts,
          title: getEntityName(article),
        };
      }),
    [articles]
  );

  const documentsRecentItems = useMemo(
    () =>
      documents.map((doc) => {
        const metaParts = [
          doc.updatedBy,
          getShortRelativeTime(doc.updatedAt),
        ].filter(Boolean);

        return { title: getEntityName(doc), meta: metaParts };
      }),
    [documents]
  );

  const recentlyViewedItems = useMemo(() => {
    const recentlyViewed = (recentlyViewedQuickLinks ??
      []) as unknown as RecentlyViewedQuickLinks['data'];

    return recentlyViewed.map((page) => ({
      id: page.id,
      title: getEntityName(page),
      time: page.timestamp ? getShortRelativeTime(page.timestamp) : '',
    }));
  }, [recentlyViewedQuickLinks]);

  const mostCitedItems = useMemo(
    () =>
      mostCitedMemories.map((memory) => ({
        id: memory.id,
        title: memory.title ?? getEntityName(memory),
        citedCount: memory.usageCount ?? 0,
      })),
    [mostCitedMemories]
  );

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:p-5 tw:pt-0 tw:h-full ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-dashboard-page">
      <ContextCenterHeader
        actionsSlot={
          <Box align="center" className="tw:shrink-0" gap={3}>
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
          </Box>
        }
        breadcrumbs={[
          {
            label: t('label.dashboard'),
          },
        ]}
        hasPermission={hasCreatePermission}
        subtitle={t('message.context-center-dashboard-subtitle')}
        title={t('label.dashboard')}
      />

      <Box
        className="tw:h-full tw:min-h-0"
        data-testid="dashboard-detail-card"
        direction="col"
        gap={6}>
        <div className="tw:grid tw:grid-cols-3 tw:gap-4 tw:shrink-0">
          <ContextKnowledgePillarCard
            cta={t('label.view-all-entity', {
              entity: t('label.article-plural'),
            })}
            dataTestId="article-detail-card"
            icon={File05}
            isLoading={isArticlesLoading}
            recent={articlesRecentItems}
            stat={String(articlesCount)}
            statSub={t('label.published')}
            subtitle={t('message.long-form-authored-versioned')}
            title={t('label.article-plural')}
            onClick={() =>
              navigate(contextCenterClassBase.getArticlesListPath())
            }
          />
          <ContextKnowledgePillarCard
            cta={t('label.view-all-entity', {
              entity: t('label.document-plural'),
            })}
            dataTestId="document-detail-card"
            icon={FolderIcon}
            isLoading={isDocumentsLoading}
            recent={documentsRecentItems}
            stat={String(documentsCount)}
            statSub={t('label.file-plural')}
            statSubSecondary={`${folderCount} ${t('label.folder-plural')}`}
            subtitle={t('message.files-uploaded-for-ai-retrieval')}
            title={t('label.document-plural')}
            onClick={() =>
              navigate(contextCenterClassBase.getDocumentsListPath())
            }
          />
          <ContextKnowledgePillarCard
            cta={t('label.view-all-entity', {
              entity: t('label.memory-plural'),
            })}
            dataTestId="memory-detail-card"
            icon={Sun}
            isLoading={isMemoriesLoading}
            recent={memories}
            stat={String(memoriesCount)}
            statSub={t('label.memory-plural')}
            subtitle={t('message.atomic-facts-ai-should-remember')}
            title={t('label.memory-plural')}
            onClick={() =>
              navigate(contextCenterClassBase.getMemoriesListPath())
            }
          />
        </div>

        <div className="tw:grid tw:grid-cols-3 tw:gap-4 tw:flex-1 tw:min-h-0">
          <ContextSimplePillarCard
            dataTestId="recently-viewed-card"
            emptyMessage={t('message.no-recently-viewed-data')}
            isEmpty={recentlyViewedItems.length === 0}
            title={t('label.recently-viewed')}>
            <Box direction="col">
              {recentlyViewedItems.map((item) => (
                <Box
                  align="center"
                  className="tw:py-1.5"
                  gap={2}
                  justify="between"
                  key={item.id}>
                  <Typography
                    ellipsis
                    className="tw:min-w-0 tw:flex-1 tw:text-secondary"
                    size="text-sm"
                    weight="medium">
                    {item.title}
                  </Typography>
                  {item.time && (
                    <Typography
                      className="tw:text-quaternary tw:shrink-0 tw:whitespace-nowrap"
                      size="text-xs">
                      {item.time}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </ContextSimplePillarCard>

          <DashboardFoldersCard folders={folders} isLoading={isFoldersLoading} />

          <ContextSimplePillarCard
            dataTestId="most-cited-memories-card"
            emptyMessage={t('label.no-entity', {
              entity: t('label.memory-plural'),
            })}
            isEmpty={mostCitedItems.length === 0}
            isLoading={isMostCitedLoading}
            title={t('label.most-cited')}>
            <Box direction="col">
              {mostCitedItems.map((item) => (
                <Box
                  align="center"
                  className="tw:py-1.5"
                  gap={2}
                  justify="between"
                  key={item.id}>
                  <Typography
                    ellipsis
                    className="tw:min-w-0 tw:flex-1 tw:text-secondary"
                    size="text-sm"
                    weight="medium">
                    {item.title}
                  </Typography>
                  <Typography
                    className="tw:text-quaternary tw:shrink-0 tw:whitespace-nowrap"
                    size="text-xs">
                    {t('label.cited-n-times', { count: item.citedCount })}
                  </Typography>
                </Box>
              ))}
            </Box>
          </ContextSimplePillarCard>
        </div>
      </Box>

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
