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
import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  MenuProps,
  Row,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { isEmpty, map, uniqBy, uniqueId } from 'lodash';
import React, {
  forwardRef,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/add-placeholder.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import {
  CREATE_PAGE_HASH,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { KNOWLEDGE_CENTER_DOC_LINK } from '../../../constants/docs.constant';
import { getKnowledgePageFields } from '../../../constants/KnowledgeCenter.constant';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Paging } from '../../../generated/type/paging';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useElementInView } from '../../../hooks/useElementInView';
import {
  CreateKnowledgePage,
  KnowledgeCenterPageProps,
  KnowledgeCenterPageRef,
  KnowledgePage,
  PageType,
} from '../../../interface/knowledge-center.interface';
import {
  followKnowledgePage,
  getListKnowledgePages,
  postKnowledgePage,
  unFollowKnowledgePage,
  updateKnowledgePageVote,
} from '../../../rest/knowledgeCenterAPI';
import { searchQuery as fetchSearchResults } from '../../../rest/searchAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../utils/ToastUtils';
import KnowledgeCard from '../KnowledgeCard/KnowledgeCard';
import KnowledgePageListRightPanel from '../KnowledgePageListRightPanel/KnowledgePageListRightPanel';
import {
  QuickLinkFormModal,
  QuickLinkFormModalFormData,
} from '../QuickLinkFormModal/QuickLinkFormModal';
import './knowledge-page-list.less';

interface KnowledgePageListComponentProps {
  onPageChange: (page: Partial<KnowledgeCenterPageProps>) => void;
  permissions: OperationPermission;
  hideAddButton?: boolean;
  rightPanelSlot?: React.ReactNode;
  searchQuery?: string;
}

const KnowledgePageListComponent = forwardRef<
  KnowledgeCenterPageRef,
  KnowledgePageListComponentProps
>(
  (
    {
      onPageChange,
      permissions,
      hideAddButton = false,
      rightPanelSlot,
      searchQuery,
    },
    ref
  ) => {
    const { currentUser, theme } = useApplicationStore();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const USERId = currentUser?.id ?? '';
    const [elementRef, isInView] = useElementInView({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [knowledgePages, setKnowledgePages] = useState<KnowledgePage[]>([]);
    const [paging, setPaging] = useState<Paging>({ total: 0 });
    const [pageOffset, setPageOffset] = useState<number>(0);
    const [isCreatingNewPage, setIsCreatingNewPage] = useState<boolean>(false);
    const [showAddLinkModal, setShowAddLinkModal] = useState<boolean>(false);
    const { getResourceLimit } = useLimitStore();

    const [refreshBookMarkWidget, setRefreshBookMarkWidget] =
      useState<boolean>(false);
    const [refreshTagsCategory, setRefreshTagsCategory] =
      useState<boolean>(false);

    const handleRefreshBookMarkWidget = (value: boolean) =>
      setRefreshBookMarkWidget(value);

    const handleRefreshTagsCategory = (value: boolean) =>
      setRefreshTagsCategory(value);

    const fetchKnowledgePages = async (offset = 0) => {
      if (offset > 0) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      try {
        if (searchQuery) {
          const results = await fetchSearchResults({
            query: searchQuery,
            searchIndex: SearchIndex.KNOWLEDGE_PAGE_INDEX,
            queryFilter: {
              query: { term: { pageType: PageType.ARTICLE } },
            },
            sortField: 'updatedAt',
            sortOrder: 'desc',
            pageSize: PAGE_SIZE_MEDIUM,
          });
          setKnowledgePages(
            results.hits.hits.map((hit) => hit._source as KnowledgePage)
          );
          setPaging({ total: results.hits.total.value });
        } else {
          const { data, paging: pagingObj } = await getListKnowledgePages({
            fields: getKnowledgePageFields(),
            limit: PAGE_SIZE_MEDIUM,
            offset,
            pageType: PageType.ARTICLE,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          });
          setKnowledgePages((prev) =>
            uniqBy<KnowledgePage>(offset > 0 ? [...prev, ...data] : data, 'id')
          );
          setPaging(pagingObj);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    const addArticleKnowledgePage = async () => {
      try {
        setIsCreatingNewPage(true);
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
          pathname: contextCenterClassBase.getArticlePath(
            response.fullyQualifiedName
          ),
          hash: CREATE_PAGE_HASH,
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsCreatingNewPage(false);
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
        setKnowledgePages((prevPages) => [response, ...prevPages]);
        setRefreshTagsCategory(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    };

    const updateVoteHandler = async (data: VotingDataProps, id: string) => {
      try {
        const { entity } = await updateKnowledgePageVote(id, data);

        setKnowledgePages((prevPages) =>
          map(prevPages, (page) => {
            if (page.id === entity.id) {
              return { ...page, votes: entity.votes };
            }

            return page;
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    };

    const followKnowledgePageHandler = async (knowledgePageId: string) => {
      try {
        const res = await followKnowledgePage(knowledgePageId, USERId);
        const { newValue } = res.changeDescription.fieldsAdded[0];
        setKnowledgePages((prevPages) =>
          map(prevPages, (page) => {
            if (page.id === knowledgePageId) {
              return {
                ...page,
                followers: [...(page?.followers ?? []), ...newValue],
              };
            }

            return page;
          })
        );
        setRefreshBookMarkWidget(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    };

    const unFollowKnowledgePageHandler = async (knowledgePageId: string) => {
      try {
        const res = await unFollowKnowledgePage(knowledgePageId, USERId);
        const { oldValue } = res.changeDescription.fieldsDeleted[0];

        setKnowledgePages((prevPages) =>
          map(prevPages, (page) => {
            if (page.id === knowledgePageId) {
              return {
                ...page,
                followers: (page?.followers ?? []).filter(
                  (follower) => follower.id !== oldValue[0].id
                ),
              };
            }

            return page;
          })
        );
        setRefreshBookMarkWidget(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    };

    const handleDelete = (id: string | string[]) => {
      setKnowledgePages((prevPages) =>
        prevPages.filter((page) => {
          if (Array.isArray(id)) {
            return !id.includes(page.id);
          }

          return page.id !== id;
        })
      );
    };

    const hasViewPermission = useMemo(
      () => permissions.ViewAll || permissions.ViewBasic,
      [permissions]
    );

    useEffect(() => {
      if (hasViewPermission) {
        setPageOffset(0);
        fetchKnowledgePages(0);
      } else {
        setIsLoading(false);
      }
    }, [hasViewPermission, searchQuery]);

    useEffect(() => {
      const hasMore = knowledgePages.length < paging.total;
      if (
        isInView &&
        hasMore &&
        !isLoadingMore &&
        !searchQuery &&
        hasViewPermission
      ) {
        const nextOffset = pageOffset + PAGE_SIZE_MEDIUM;
        setPageOffset(nextOffset);
        fetchKnowledgePages(nextOffset);
      }
    }, [
      isInView,
      paging.total,
      knowledgePages.length,
      isLoadingMore,
      searchQuery,
      hasViewPermission,
    ]);

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

    const getRightPanelElement = useCallback(
      () =>
        rightPanelSlot !== undefined ? (
          rightPanelSlot
        ) : (
          <KnowledgePageListRightPanel
            permissions={permissions}
            refreshBookMarkWidget={refreshBookMarkWidget}
            refreshTagsCategory={refreshTagsCategory}
            onAdd={() => setShowAddLinkModal(true)}
            onRefreshBookMarkWidget={handleRefreshBookMarkWidget}
            onRefreshTagsCategory={handleRefreshTagsCategory}
          />
        ),
      [permissions, refreshBookMarkWidget, refreshTagsCategory, rightPanelSlot]
    );

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

    useEffect(() => {
      onPageChange({
        title: t('label.knowledge-center'),
        rightPanel: getRightPanelElement(),
        data: undefined,
        header: null,
      });
    }, [getRightPanelElement]);

    useImperativeHandle(ref, () => ({
      onPageDelete: handleDelete,
      addKnowledgePage: (knowledgePage: KnowledgePage) =>
        setKnowledgePages((prevPages) => [knowledgePage, ...prevPages]),
    }));

    if (isLoading || isCreatingNewPage) {
      return (
        <Row data-testid="knowledge-page-listing" gutter={[0, 56]}>
          {Array.from({ length: 4 }).map(() => (
            <Col className="knowledge-card-col" key={uniqueId()} span={24}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Space>
                    <Skeleton avatar paragraph={{ rows: 1 }} title={false} />
                    <Skeleton
                      paragraph={{ rows: 1, width: 150 }}
                      title={false}
                    />
                  </Space>
                </Col>
                <Col span={24}>
                  <Skeleton
                    active
                    className="m-b-sm"
                    paragraph={{ rows: 1 }}
                    title={false}
                  />
                  <Skeleton active paragraph={{ rows: 2 }} title={false} />
                </Col>
                <Col span={24}>
                  <Space>
                    <Skeleton
                      active
                      paragraph={{ rows: 1, width: 100 }}
                      title={false}
                    />
                    <Skeleton
                      active
                      paragraph={{ rows: 1, width: 100 }}
                      title={false}
                    />
                    <Skeleton
                      active
                      paragraph={{ rows: 1, width: 100 }}
                      title={false}
                    />
                  </Space>
                </Col>
              </Row>
            </Col>
          ))}
        </Row>
      );
    }

    if (!hasViewPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.knowledge-article-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }

    if (!isLoading && isEmpty(knowledgePages)) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          icon={
            <AddPlaceHolderIcon
              data-testid="no-data-image"
              height={SIZE.LARGE}
              width={SIZE.LARGE}
            />
          }
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div
            className="bg-white h-full flex-center"
            data-testid="create-error-placeholder-create">
            <Space
              align="center"
              className="w-full"
              direction="vertical"
              size={10}>
              <div className="text-center text-sm font-normal">
                <Typography.Paragraph>
                  {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
                    entity: t('label.knowledge-page'),
                  })}
                </Typography.Paragraph>

                <Typography.Paragraph>
                  <Transi18next
                    i18nKey="message.refer-to-our-doc"
                    renderElement={
                      <a
                        href={KNOWLEDGE_CENTER_DOC_LINK}
                        rel="noreferrer"
                        style={{ color: theme.primaryColor }}
                        target="_blank"
                      />
                    }
                    values={{
                      doc: t('label.doc-plural-lowercase'),
                    }}
                  />
                </Typography.Paragraph>

                {permissions.Create && !hideAddButton && (
                  <LimitWrapper resource="knowledgeCenter">
                    <Dropdown menu={{ items }} trigger={['click']}>
                      <Button
                        ghost
                        className="p-x-lg"
                        data-testid="add-knowledge-page-btn"
                        type="primary">
                        <PlusOutlined />
                        {t('label.add')}
                      </Button>
                    </Dropdown>
                  </LimitWrapper>
                )}
              </div>
            </Space>
          </div>
          {addQuickLinkModalElement}
        </ErrorPlaceHolder>
      );
    }

    return (
      <>
        <Row data-testid="knowledge-page-listing" gutter={[0, 16]}>
          {map(knowledgePages, (knowledgePage) => (
            <Col
              className="knowledge-card-col"
              key={knowledgePage.id}
              span={24}>
              <KnowledgeCard
                knowledgeItem={knowledgePage}
                onDelete={handleDelete}
                onFollow={followKnowledgePageHandler}
                onRefreshTagsCategory={handleRefreshTagsCategory}
                onUnFollow={unFollowKnowledgePageHandler}
                onUpdateVote={updateVoteHandler}
              />
            </Col>
          ))}
        </Row>
        {isLoadingMore ? <Loader /> : null}
        <div
          className="w-full"
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
          style={{ height: '2px' }}
        />
        {addQuickLinkModalElement}
      </>
    );
  }
);

export default KnowledgePageListComponent;
