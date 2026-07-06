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

import { Box, Button, Card, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../../components/AppRouter/withActivityFeed';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import ArticleDetailHeader from '../../../components/ContextCenter/ArticleDetailHeader/ArticleDetailHeader.component';
import ArticleVersionHeader from '../../../components/ContextCenter/ArticleVersionHeader/ArticleVersionHeader.component';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import '../../../components/KnowledgeCenter/KnowledgeCenterLayout/knowledge-center-layout.less';
import KnowledgePageDetailComponent from '../../../components/KnowledgeCenter/KnowledgePageDetailComponent/KnowledgePageDetailComponent';
import KnowledgePageListComponent from '../../../components/KnowledgeCenter/KnowledgePageListComponent/KnowledgePageListComponent';
import KnowledgePagesHierarchy from '../../../components/KnowledgeCenter/KnowledgePagesHierarchy/KnowledgePagesHierarchy';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import { getKnowledgePageFields } from '../../../constants/KnowledgeCenter.constant';
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
  KnowledgePage,
  KnowledgePagesHierarchyRef,
  PageType,
} from '../../../interface/knowledge-center.interface';
import {
  getKnowledgePageByFqn,
  postKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { createArticleKnowledgePage } from '../../../utils/ContextCenterPureUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import KnowledgePageVersionPage from '../../KnowledgePageVersionPage/KnowledgePageVersionPage';

const ContextCenterArticlesPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { version } = useRequiredParams<{ version?: string }>();
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
  const [editingQuickLink, setEditingQuickLink] = useState<KnowledgePage>();
  const [articleSearchQuery, setArticleSearchQuery] = useState('');

  const handleFetchKnowledgePageHierarchy = useCallback(
    (forceRefresh?: boolean) =>
      knowledgePagesHierarchyRef.current?.fetchKnowledgePageHierarchy(
        forceRefresh
      ) ?? Promise.resolve(),
    []
  );

  const handleQuickLinkClick = useCallback(async (fqn: string) => {
    try {
      const quickLinkPage = await getKnowledgePageByFqn(fqn, {
        fields: getKnowledgePageFields(),
      });
      setEditingQuickLink(quickLinkPage);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

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

  const fetchPermission = useCallback(async () => {
    try {
      const response = await getResourcePermission(
        ResourceEntity.KNOWLEDGE_PAGE
      );
      setPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [getResourcePermission]);

  const addArticleKnowledgePage = useCallback(async () => {
    await createArticleKnowledgePage(USERId, navigate, () =>
      getResourceLimit('knowledgeCenter', true, true)
    );
  }, [USERId, navigate, getResourceLimit]);

  const addQuickLinkKnowledgePage = useCallback(
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
          owners: [{ id: USERId, type: 'user' }],
          page: { url: formData.url },
          pageType: PageType.QUICK_LINK,
          relatedEntities: formData?.relatedEntities,
          tags,
        };
        const response = await postKnowledgePage(data);
        knowledgeCenterPageRef.current?.addKnowledgePage(response);
        knowledgePagesHierarchyRef.current?.fetchKnowledgePageHierarchy(true);
        showSuccessToast(
          t('message.entity-saved-successfully', {
            entity: t('label.quick-link'),
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [USERId, t]
  );

  const handleOpenAddLinkModal = useCallback(
    () => setShowAddLinkModal(true),
    []
  );

  const handleCloseAddLinkModal = useCallback(
    () => setShowAddLinkModal(false),
    []
  );

  const handleSaveQuickLink = useCallback(
    async (data: QuickLinkFormModalFormData) => {
      await addQuickLinkKnowledgePage(data);
      setShowAddLinkModal(false);
    },
    [addQuickLinkKnowledgePage]
  );

  const handleCloseEditQuickLink = useCallback(
    () => setEditingQuickLink(undefined),
    []
  );

  const handleSaveEditQuickLink = useCallback(() => {
    setEditingQuickLink(undefined);
    knowledgePagesHierarchyRef.current?.fetchKnowledgePageHierarchy(true);
  }, []);

  useEffect(() => {
    fetchPermission();
  }, [fetchPermission]);

  const renderHeader = () => {
    if (version) {
      return <ArticleVersionHeader knowledgePage={page.data} />;
    }

    if (fqn) {
      return (
        <ArticleDetailHeader
          activeTab={page.activeTab}
          contentChangeState={
            page.handlers?.contentChangeState ?? ContentChangeState.SAVED
          }
          feedCount={page?.feedCount}
          fetchKnowledgePageHierarchy={handleFetchKnowledgePageHierarchy}
          isRightPanelOpen={isRightPanelOpen}
          knowledgePage={page.data}
          permissions={permissions}
          tabs={page.tabs}
          onFollowChange={
            page.handlers?.onFollowChange ?? (async () => undefined)
          }
          onSave={page.handlers?.onSave}
          onSetThreadLink={page.handlers?.onSetThreadLink ?? (() => undefined)}
          onTabChange={page.onTabChange}
          onToggleRightPanel={handleToggleRightPanel}
          onUpdate={page.handlers?.onUpdate}
          onVoteChange={page.handlers?.onVoteChange ?? (async () => undefined)}
        />
      );
    }

    return (
      <ContextCenterHeader
        actionsSlot={
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
                    onAction={addArticleKnowledgePage}>
                    {t('label.article')}
                  </Dropdown.Item>

                  <Dropdown.Item
                    data-testid="create-quick-link-btn"
                    key={PageType.QUICK_LINK}
                    onAction={handleOpenAddLinkModal}>
                    {t('label.quick-link')}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </LimitWrapper>
        }
        breadcrumbs={[{ label: t('label.article-plural') }]}
        hasPermission={permissions?.Create}
        searchPlaceholder={t('label.search-entity', {
          entity: t('label.article-plural'),
        })}
        searchQuery={articleSearchQuery}
        subtitle={t('message.internal-knowledge-base-agent-training')}
        title={t('label.article-plural')}
        onSearch={setArticleSearchQuery}
      />
    );
  };

  const isActivityFeedTab =
    Boolean(fqn) && page.activeTab === EntityTabs.ACTIVITY_FEED;

  const leftSidebar = isActivityFeedTab ? null : (
    <KnowledgePagesHierarchy
      activeKey={fqn}
      activePage={page.data}
      homeRoute={contextCenterClassBase.getArticlesListPath()}
      permissions={permissions}
      ref={knowledgePagesHierarchyRef}
      onPageDelete={knowledgeCenterPageRef.current?.onPageDelete}
      onQuickLinkClick={handleQuickLinkClick}
    />
  );

  const rightSidebar = useMemo(() => {
    if (isActivityFeedTab) {
      return null;
    }

    if (version || isRightPanelOpen) {
      return page.rightPanel;
    }

    return null;
  }, [isActivityFeedTab, version, isRightPanelOpen, page.rightPanel]);

  const centerContent = useMemo(() => {
    if (version) {
      return <KnowledgePageVersionPage onPageChange={handlePageChange} />;
    }

    if (fqn) {
      return (
        <KnowledgePageDetailComponent
          fetchKnowledgePageHierarchy={handleFetchKnowledgePageHierarchy}
          isRightPanelOpen={isRightPanelOpen}
          onPageChange={handlePageChange}
          onToggleRightPanel={handleToggleRightPanel}
        />
      );
    }

    return (
      <KnowledgePageListComponent
        hideAddButton
        permissions={permissions}
        ref={knowledgeCenterPageRef}
        rightPanelSlot={
          contextCenterClassBase.isEmbeddedMode() ? null : undefined
        }
        searchQuery={articleSearchQuery}
        onPageChange={handlePageChange}
      />
    );
  }, [
    version,
    fqn,
    isRightPanelOpen,
    permissions,
    articleSearchQuery,
    handlePageChange,
    handleFetchKnowledgePageHierarchy,
    handleToggleRightPanel,
  ]);

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:p-5 tw:pt-0 ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-articles-page">
      {renderHeader()}

      <Box
        className="tw:flex-1 tw:min-h-0 "
        dir={i18n.dir()}
        direction="col"
        id="knowledge-center-layout-container">
        <DocumentTitle title={page.title || t('label.article-plural')} />
        <ReflexContainer
          className="knowledge-center-layout tw:h-full"
          orientation="vertical">
          {/* left */}
          <ReflexElement
            propagateDimensions
            className={classNames('left-panel', {
              'left-panel-collapsed': !leftSidebar,
            })}
            data-testid="left-panel"
            flex={0.2}
            minSize={280}>
            {leftSidebar}
          </ReflexElement>

          <ReflexSplitter
            className={classNames('splitter left-panel-splitter', {
              hidden: !leftSidebar,
            })}>
            {leftSidebar && (
              <div className="panel-grabber-vertical">
                <div className="handle-icon handle-icon-vertical" />
              </div>
            )}
          </ReflexSplitter>

          {/* middle */}
          <ReflexElement
            propagateDimensions
            className={classNames('center-panel', {
              'has-sidebar': leftSidebar,
            })}
            data-testid="center-panel"
            flex={rightSidebar ? 0.6 : 1}
            minSize={700}>
            {fqn || version ? (
              <Card className="tw:h-full tw:flex tw:flex-col tw:p-0">
                <Card.Content
                  className={classNames(
                    'tw:flex-1 tw:min-h-0 tw:overflow-auto',
                    isActivityFeedTab && !version ? 'tw:p-0' : 'tw:p-6 tw:pl-8'
                  )}>
                  {centerContent}
                </Card.Content>
              </Card>
            ) : (
              <Box
                className="tw:h-full tw:min-h-0 tw:overflow-auto tw:py-0.5"
                direction="col">
                {centerContent}
              </Box>
            )}
          </ReflexElement>

          <ReflexSplitter
            className={classNames('splitter right-panel-splitter', {
              hidden: !rightSidebar,
            })}>
            {!!rightSidebar && (
              <div className="panel-grabber-vertical">
                <div className="handle-icon handle-icon-vertical" />
              </div>
            )}
          </ReflexSplitter>

          <ReflexElement
            propagateDimensions
            className={classNames('right-panel', {
              'right-panel-collapsed': !rightSidebar,
            })}
            data-testid="right-panel"
            flex={rightSidebar ? 0.2 : 0}
            minSize={280}
            style={rightSidebar ? {} : { display: 'none' }}>
            {rightSidebar}
          </ReflexElement>
        </ReflexContainer>
      </Box>

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
        onCancel={handleCloseAddLinkModal}
        onSave={handleSaveQuickLink}
      />

      <QuickLinkFormModal
        isOpen={Boolean(editingQuickLink)}
        permissions={permissions}
        quickLink={editingQuickLink}
        onCancel={handleCloseEditQuickLink}
        onSave={handleSaveEditQuickLink}
      />
    </div>
  );
};

export default withActivityFeed(ContextCenterArticlesPage);
