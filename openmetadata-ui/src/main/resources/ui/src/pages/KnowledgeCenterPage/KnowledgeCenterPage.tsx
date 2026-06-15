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
import { Button, Dropdown, MenuProps, Space } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import KnowledgeCenterLayout from '../../components/KnowledgeCenter/KnowledgeCenterLayout/KnowledgeCenterLayout';
import KnowledgePageDetailComponent from '../../components/KnowledgeCenter/KnowledgePageDetailComponent/KnowledgePageDetailComponent';
import KnowledgePageListComponent from '../../components/KnowledgeCenter/KnowledgePageListComponent/KnowledgePageListComponent';
import KnowledgePagesHierarchy from '../../components/KnowledgeCenter/KnowledgePagesHierarchy/KnowledgePagesHierarchy';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal';
import { LearningIcon } from '../../components/Learning/LearningIcon/LearningIcon.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { CREATE_PAGE_HASH } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  CreateKnowledgePage,
  KnowledgeCenterPageProps,
  KnowledgeCenterPageRef,
  KnowledgePagesHierarchyRef,
  PageType,
} from '../../interface/knowledge-center.interface';
import { postKnowledgePage } from '../../rest/knowledgeCenterAPI';
import { getKnowledgePagePath } from '../../utils/KnowledgePagePureUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import KnowledgePageVersionPage from '../KnowledgePageVersionPage/KnowledgePageVersionPage';
import './knowledge-center-page.less';
const KnowledgeCenterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const { getResourcePermission } = usePermissionProvider();
  const { version } = useRequiredParams<{ version: string }>();
  const knowledgeCenterPageRef = useRef<KnowledgeCenterPageRef>(null);
  const knowledgePagesHierarchyRef = useRef<KnowledgePagesHierarchyRef>(null);
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [showAddLinkModal, setShowAddLinkModal] = useState<boolean>(false);
  const { getResourceLimit } = useLimitStore();

  const addArticleKnowledgePage = async () => {
    try {
      const instanceName = `${PageType.ARTICLE}_${cryptoRandomString({
        length: 8,
        type: 'alphanumeric',
      })}`;

      const data: CreateKnowledgePage = {
        name: instanceName,
        displayName: '',
        description: '',
        pageType: PageType.ARTICLE,
        page: {
          publicationDate: new Date(),
          relatedArticles: [],
        },
        owners: [
          {
            type: 'user',
            id: USERId,
          },
        ],
      };
      const response = await postKnowledgePage(data);
      getResourceLimit('knowledgeCenter', true, true);
      navigate({
        pathname: getKnowledgePagePath(response.fullyQualifiedName),
        hash: CREATE_PAGE_HASH,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
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
        name: `${PageType.QUICK_LINK}_${cryptoRandomString({
          length: 8,
          type: 'alphanumeric',
        })}`,
        displayName: formData.displayName ?? '',
        description: formData.description,
        pageType: PageType.QUICK_LINK,
        page: {
          url: formData.url,
        },
        owners: [
          {
            type: 'user',
            id: USERId,
          },
        ],
        tags,
        relatedEntities: formData?.relatedEntities,
      };
      const response = await postKnowledgePage(data);
      knowledgeCenterPageRef.current?.addKnowledgePage(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const addQuickLinkModalElement = useMemo(
    () =>
      showAddLinkModal && (
        <QuickLinkFormModal
          isOpen={showAddLinkModal}
          // this is for add quick link as we are not passing any data
          permissions={
            {
              EditAll: true,
              EditDisplayName: true,
              EditDescription: true,
              EditTags: true,
            } as OperationPermission
          }
          onCancel={() => setShowAddLinkModal(false)}
          onSave={(data) => {
            addQuickLinkKnowledgePage(data);
            setShowAddLinkModal(false);
          }}
        />
      ),
    [showAddLinkModal]
  );

  const items: MenuProps['items'] = [
    {
      label: t('label.article'),
      key: PageType.ARTICLE,
      onClick: addArticleKnowledgePage,
    },
    {
      label: t('label.quick-link'),
      key: PageType.QUICK_LINK,
      onClick: () => setShowAddLinkModal(true),
    },
  ];

  const [page, setPage] = useState<KnowledgeCenterPageProps>({
    data: undefined,
    title: '',
    header: null,
    rightPanel: null,
  });

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

  const handlePageChange = useCallback(
    (page: Partial<KnowledgeCenterPageProps>) => {
      setPage((prev) => ({ ...prev, ...page }));
    },
    [setPage]
  );

  const renderVersionPage = useCallback(
    () => <KnowledgePageVersionPage onPageChange={handlePageChange} />,
    [handlePageChange]
  );

  const renderDetailOrListPage = useCallback(
    () =>
      fqn ? (
        <KnowledgePageDetailComponent
          fetchKnowledgePageHierarchy={
            knowledgePagesHierarchyRef.current?.fetchKnowledgePageHierarchy
          }
          onPageChange={handlePageChange}
        />
      ) : (
        <KnowledgePageListComponent
          permissions={permissions}
          ref={knowledgeCenterPageRef}
          onPageChange={handlePageChange}
        />
      ),
    [fqn, handlePageChange, knowledgeCenterPageRef, permissions]
  );

  const leftSidebarTitle = useMemo(
    () => (
      <Space>
        {t('label.article-plural')}
        <LearningIcon
          pageId={LEARNING_PAGE_IDS.KNOWLEDGE_CENTER}
          title={t('label.knowledge-center')}
        />
      </Space>
    ),
    [t]
  );

  const leftSidebarExtra = useMemo(
    () =>
      permissions.Create && (
        <LimitWrapper resource="knowledgeCenter">
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button data-testid="add-knowledge-page-btn" type="primary">
              {t('label.add')}
              <DownOutlined />
            </Button>
          </Dropdown>
        </LimitWrapper>
      ),
    [permissions, t]
  );

  useEffect(() => {
    fetchPermission();
  }, []);

  const centerContent = useMemo(() => {
    if (version) {
      return renderVersionPage();
    }

    return renderDetailOrListPage();
  }, [version, renderVersionPage, renderDetailOrListPage]);

  return (
    <PageLayoutV1 pageTitle={t('label.knowledge-center')}>
      {page.header}
      <KnowledgeCenterLayout
        className={classNames({ 'knowledge-details-page': fqn })}
        leftSidebar={
          <KnowledgePagesHierarchy
            activeKey={fqn}
            activePage={page.data}
            isPageHeaderAvailable={Boolean(page.header)}
            permissions={permissions}
            ref={knowledgePagesHierarchyRef}
            onPageDelete={knowledgeCenterPageRef.current?.onPageDelete}
          />
        }
        leftSidebarExtra={leftSidebarExtra}
        leftSidebarTitle={leftSidebarTitle}
        pageTitle={page.title}
        rightSidebar={page.rightPanel}>
        {centerContent}
      </KnowledgeCenterLayout>
      {addQuickLinkModalElement}
    </PageLayoutV1>
  );
};

export default withActivityFeed(KnowledgeCenterPage);
