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

import { DownOutlined } from '@ant-design/icons';
import { Home02 } from '@untitledui/icons';
import { Button, Dropdown } from 'antd';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../../components/AppRouter/withActivityFeed';
import ArticleDetailHeader from '../../../components/ContextCenter/ArticleDetailHeader/ArticleDetailHeader.component';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import KnowledgeCenterLayout from '../../../components/KnowledgeCenter/KnowledgeCenterLayout/KnowledgeCenterLayout';
import KnowledgePageDetailComponent from '../../../components/KnowledgeCenter/KnowledgePageDetailComponent/KnowledgePageDetailComponent';
import KnowledgePageListComponent from '../../../components/KnowledgeCenter/KnowledgePageListComponent/KnowledgePageListComponent';
import KnowledgePagesHierarchy from '../../../components/KnowledgeCenter/KnowledgePagesHierarchy/KnowledgePagesHierarchy';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import { ROUTES } from '../../../constants/constants';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../../../enums/entity.enum';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  ContentChangeState,
  CreateKnowledgePage,
  KnowledgeCenterPageProps,
  KnowledgeCenterPageRef,
  KnowledgePagesHierarchyRef,
  PageType,
} from '../../../interface/knowledge-center.interface';
import { postKnowledgePage } from '../../../rest/knowledgeCenterAPI';
import { createArticleKnowledgePage } from '../../../utils/ContextCenterUtils';
import { getContextCenterArticlePath } from '../../../utils/KnowledgePageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const ContextCenterArticlesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const { getResourcePermission } = usePermissionProvider();
  const { getResourceLimit } = useLimitStore();
  const knowledgeCenterPageRef = useRef<KnowledgeCenterPageRef>(null);
  const knowledgePagesHierarchyRef = useRef<KnowledgePagesHierarchyRef>(null);

  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [page, setPage] = useState<KnowledgeCenterPageProps>({
    data: undefined,
    header: null,
    rightPanel: null,
    title: '',
  });
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);

  const handleFetchKnowledgePageHierarchy = useCallback(
    (forceRefresh?: boolean) =>
      knowledgePagesHierarchyRef.current?.fetchKnowledgePageHierarchy(
        forceRefresh
      ) ?? Promise.resolve(),
    []
  );

  const handlePageChange = useCallback(
    (incoming: Partial<KnowledgeCenterPageProps>) => {
      setPage((prev) => ({ ...prev, ...incoming }));
    },
    []
  );

  const handleToggleRightPanel = useCallback(
    () => setIsRightPanelOpen((prev) => !prev),
    []
  );

  const fetchPermission = async () => {
    try {
      const response = await getResourcePermission(
        ResourceEntity.KNOWLEDGE_PAGE as unknown as ResourceEntity
      );
      setPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const addArticleKnowledgePage = async () => {
    await createArticleKnowledgePage(USERId, navigate, () =>
      getResourceLimit('knowledgeCenter', true, true)
    );
  };

  const addQuickLinkKnowledgePage = async (
    formData: QuickLinkFormModalFormData
  ) => {
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
        owners: [{ id: USERId, type: 'user' }],
        page: { url: formData.url },
        pageType: PageType.QUICK_LINK,
        relatedEntities: formData?.relatedEntities,
        tags,
      };
      const response = await postKnowledgePage(data);
      knowledgeCenterPageRef.current?.addKnowledgePage(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchPermission();
  }, []);

  const header = fqn ? (
    <ArticleDetailHeader
      activeTab={page.activeTab}
      contentChangeState={
        page.handlers?.contentChangeState ?? ContentChangeState.SAVED
      }
      fetchKnowledgePageHierarchy={handleFetchKnowledgePageHierarchy}
      isRightPanelOpen={isRightPanelOpen}
      knowledgePage={page.data}
      permissions={permissions}
      tabs={page.tabs}
      onFollowChange={page.handlers?.onFollowChange ?? (async () => undefined)}
      onSave={page.handlers?.onSave}
      onSetThreadLink={page.handlers?.onSetThreadLink ?? (() => undefined)}
      onTabChange={page.onTabChange}
      onToggleDelete={page.handlers?.onToggleDelete ?? (() => undefined)}
      onToggleRightPanel={handleToggleRightPanel}
      onVoteChange={page.handlers?.onVoteChange ?? (async () => undefined)}
    />
  ) : (
    <ContextCenterHeader
      actionsSlot={
        permissions.Create && (
          <LimitWrapper resource="knowledgeCenter">
            <Dropdown
              menu={{
                items: [
                  {
                    key: PageType.ARTICLE,
                    label: t('label.article'),
                    onClick: addArticleKnowledgePage,
                  },
                  {
                    key: PageType.QUICK_LINK,
                    label: t('label.quick-link'),
                    onClick: () => setShowAddLinkModal(true),
                  },
                ],
              }}
              trigger={['click']}>
              <Button data-testid="create-knowledge-page-btn" type="primary">
                {t('label.create')}
                <DownOutlined />
              </Button>
            </Dropdown>
          </LimitWrapper>
        )
      }
      breadcrumbs={[
        {
          name: '',
          icon: <Home02 size={14} />,
          url: '/',
          activeTitle: true,
        },
        { name: t('label.context-center'), url: ROUTES.CONTEXT_CENTER },
        { activeTitle: true, name: t('label.article-plural'), url: '' },
      ]}
      subtitle={t('message.internal-knowledge-base-agent-training', {
        defaultValue: 'Internal knowledge base for agent training',
      })}
      title={t('label.article-plural')}
    />
  );

  return (
    <div
      className="tw:flex tw:flex-col tw:w-full tw:h-full tw:p-5 tw:pt-0"
      data-testid="context-center-articles-page">
      {header}

      <KnowledgeCenterLayout
        centerNoPadding={
          Boolean(fqn) && page.activeTab === EntityTabs.ACTIVITY_FEED
        }
        className={fqn ? 'knowledge-details-page' : undefined}
        leftSidebar={
          fqn && page.activeTab === EntityTabs.ACTIVITY_FEED ? null : (
            <KnowledgePagesHierarchy
              hideAddPageButton
              activeKey={fqn}
              activePage={page.data}
              getPagePath={getContextCenterArticlePath}
              homeRoute={ROUTES.CONTEXT_CENTER_ARTICLES}
              isPageHeaderAvailable={Boolean(fqn)}
              permissions={permissions}
              ref={knowledgePagesHierarchyRef}
              onPageDelete={knowledgeCenterPageRef.current?.onPageDelete}
            />
          )
        }
        pageTitle={page.title || t('label.article-plural')}
        rightSidebar={
          fqn && page.activeTab === EntityTabs.ACTIVITY_FEED
            ? null
            : isRightPanelOpen
            ? page.rightPanel
            : null
        }>
        {fqn ? (
          <KnowledgePageDetailComponent
            fetchKnowledgePageHierarchy={handleFetchKnowledgePageHierarchy}
            getArticlePath={getContextCenterArticlePath}
            isRightPanelOpen={isRightPanelOpen}
            onPageChange={handlePageChange}
            onToggleRightPanel={handleToggleRightPanel}
          />
        ) : (
          <KnowledgePageListComponent
            hideAddButton
            getPagePath={getContextCenterArticlePath}
            permissions={permissions}
            ref={knowledgeCenterPageRef}
            rightPanelSlot={null}
            onPageChange={handlePageChange}
          />
        )}
      </KnowledgeCenterLayout>

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
        onSave={(data) => {
          addQuickLinkKnowledgePage(data);
          setShowAddLinkModal(false);
        }}
      />
    </div>
  );
};

export default withActivityFeed(ContextCenterArticlesPage);
