/*
 *  Copyright 2022 Collate.
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

import { Card, Col, Row, Table, Tabs, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { isEmpty, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags, ExtraInfo } from 'Models';
import React, {
  FC,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { restoreMlmodel } from 'rest/mlModelAPI';
import { getEntityBreadcrumbs, getEntityName } from 'utils/EntityUtils';
import AppState from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDashboardDetailsPath,
  getMlModelDetailsPath,
} from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityInfo, EntityTabs, EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { MlHyperParameter } from '../../generated/api/data/createMlModel';
import { Mlmodel, MlStore } from '../../generated/entity/data/mlmodel';
import { ThreadType } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { useElementInView } from '../../hooks/useElementInView';
import {
  getEmptyPlaceholder,
  getEntityPlaceHolder,
  getOwnerValue,
  refreshPage,
} from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import PageContainerV1 from '../containers/PageContainerV1';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import Loader from '../Loader/Loader';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { MlModelDetailProp } from './MlModelDetail.interface';
import MlModelFeaturesList from './MlModelFeaturesList';

const MlModelDetail: FC<MlModelDetailProp> = ({
  mlModelDetail,
  followMlModelHandler,
  unfollowMlModelHandler,
  descriptionUpdateHandler,
  tagUpdateHandler,
  settingsUpdateHandler,
  updateMlModelFeatures,
  onExtensionUpdate,
  entityThread,
  isEntityThreadLoading,
  fetchFeedHandler,
  deletePostHandler,
  postFeedHandler,
  updateThreadHandler,
  paging,
  feedCount,
  createThread,
  entityFieldTaskCount,
  entityFieldThreadCount,
  version,
  versionHandler,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { mlModelFqn, tab: activeTab = EntityTabs.FEATURES } =
    useParams<{ tab: EntityTabs; mlModelFqn: string }>();
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);

  const [isEdit, setIsEdit] = useState<boolean>(false);

  const [mlModelPermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [threadLink, setThreadLink] = useState<string>('');

  const { getEntityPermission } = usePermissionProvider();

  const loader = useMemo(
    () => (isEntityThreadLoading ? <Loader /> : null),
    [isEntityThreadLoading]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.ML_MODEL,
        mlModelDetail.id
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  }, [mlModelDetail.id, getEntityPermission, setPipelinePermissions]);

  const [elementRef, isInView] = useElementInView(observerOptions);

  useEffect(() => {
    if (mlModelDetail.id) {
      fetchResourcePermission();
    }
  }, [mlModelDetail.id]);

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.nonSecureUserDetails, AppState.userDetails]
  );
  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();

  const mlModelTier = useMemo(() => {
    return getTierTags(mlModelDetail.tags || []) as TagLabel;
  }, [mlModelDetail.tags]);

  const mlModelTags = useMemo(() => {
    return getTagsWithoutTier(mlModelDetail.tags || []);
  }, [mlModelDetail.tags]);

  const breadcrumb = useMemo(
    () => getEntityBreadcrumbs(mlModelDetail, EntityType.MLMODEL),
    [mlModelDetail]
  );

  const mlModelPageInfo: ExtraInfo[] = [
    {
      key: EntityInfo.OWNER,
      value: getOwnerValue(mlModelDetail.owner ?? ({} as EntityReference)),
      placeholderText: getEntityPlaceHolder(
        getEntityName(mlModelDetail.owner),
        mlModelDetail.owner?.deleted
      ),
      isLink: true,
      openInNewTab: false,
      profileName:
        mlModelDetail.owner?.type === OwnerType.USER
          ? mlModelDetail.owner?.name
          : undefined,
    },
    {
      key: EntityInfo.TIER,
      value: mlModelTier?.tagFQN
        ? mlModelTier.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
        : '',
    },
    {
      key: EntityInfo.ALGORITHM,
      value: mlModelDetail.algorithm,
      showLabel: true,
    },
    {
      key: EntityInfo.TARGET,
      value: mlModelDetail.target,
      showLabel: true,
    },
    {
      key: EntityInfo.SERVER,
      value: mlModelDetail.server,
      showLabel: true,
      isLink: true,
    },
    ...(!isUndefined(mlModelDetail.dashboard)
      ? [
          {
            key: EntityInfo.DASHBOARD,
            value: getDashboardDetailsPath(
              mlModelDetail.dashboard?.fullyQualifiedName as string
            ),
            placeholderText: getEntityName(mlModelDetail.dashboard),
            showLabel: true,
            isLink: true,
          },
        ]
      : []),
  ];

  const tabs = useMemo(() => {
    const allTabs = [
      {
        name: t('label.feature-plural'),
        label: (
          <TabsLabel
            id={EntityTabs.FEATURES}
            name={t('label.feature-plural')}
          />
        ),
        key: EntityTabs.FEATURES,
      },
      {
        label: (
          <TabsLabel
            count={feedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
      },
      {
        label: (
          <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
        ),
        key: EntityTabs.DETAILS,
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
      },
    ];

    return allTabs;
  }, [feedCount, activeTab]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getMlModelDetailsPath(mlModelFqn, activeKey));
    }
  };
  const setFollowersData = (followers: Array<EntityReference>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === currentUser?.id)
    );
    setFollowersCount(followers.length);
  };

  const followMlModel = () => {
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowMlModelHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followMlModelHandler();
    }
  };

  const onDescriptionEdit = () => setIsEdit(true);

  const onCancel = () => setIsEdit(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (mlModelDetail.description !== updatedHTML) {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        description: updatedHTML,
      };
      await descriptionUpdateHandler(updatedMlModelDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [
        ...(mlModelTier ? [mlModelTier] : []),
        ...selectedTags,
      ];
      const updatedMlModel = { ...mlModelDetail, tags: updatedTags };
      tagUpdateHandler(updatedMlModel);
    }
  };

  const onOwnerUpdate = useCallback(
    (newOwner?: Mlmodel['owner']) => {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        owner: newOwner
          ? {
              ...mlModelDetail.owner,
              ...newOwner,
            }
          : undefined,
      };
      settingsUpdateHandler(updatedMlModelDetails);
    },
    [mlModelDetail, mlModelDetail.owner]
  );

  const onTierRemove = () => {
    if (mlModelDetail) {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        tags: getTagsWithoutTier(mlModelDetail.tags ?? []),
      };
      settingsUpdateHandler(updatedMlModelDetails);
    }
  };

  const onTierUpdate = (newTier?: string) => {
    if (newTier) {
      const tierTag: Mlmodel['tags'] = newTier
        ? [
            ...mlModelTags,
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : mlModelDetail.tags;
      const updatedMlModelDetails = {
        ...mlModelDetail,
        tags: tierTag,
      };

      settingsUpdateHandler(updatedMlModelDetails);
    }
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedMlModelDetails = {
      ...mlModelDetail,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleRestoreMlmodel = async () => {
    try {
      await restoreMlmodel(mlModelDetail.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.ml-model'),
        }),
        // Autoclose timer
        2000
      );
      refreshPage();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  };

  const onFeaturesUpdate = async (features: Mlmodel['mlFeatures']) => {
    await updateMlModelFeatures({ ...mlModelDetail, mlFeatures: features });
  };

  const handleThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const handleThreadPanelClose = () => {
    setThreadLink('');
  };

  const getMlHyperParametersColumn: ColumnsType<MlHyperParameter> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
      },
    ],
    []
  );

  const mlModelStoreColumn = useMemo(() => {
    const column: ColumnsType<MlStore> = [
      {
        title: t('label.storage'),
        dataIndex: 'storage',
        key: 'storage',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
      {
        title: t('label.image-repository'),
        dataIndex: 'imageRepository',
        key: 'imageRepository',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
    ];

    return column;
  }, []);

  const getMlHyperParameters = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>
          {t('label.hyper-parameter-plural')}{' '}
        </Typography.Title>
        {isEmpty(mlModelDetail.mlHyperParameters) ? (
          getEmptyPlaceholder()
        ) : (
          <Table
            bordered
            columns={getMlHyperParametersColumn}
            data-testid="hyperparameters-table"
            dataSource={mlModelDetail.mlHyperParameters}
            pagination={false}
            rowKey="name"
            size="small"
          />
        )}
      </>
    );
  }, [mlModelDetail, getMlHyperParametersColumn]);

  const getMlModelStore = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>{t('label.model-store')}</Typography.Title>
        {mlModelDetail.mlStore ? (
          <Table
            bordered
            columns={mlModelStoreColumn}
            data-testid="model-store-table"
            dataSource={[mlModelDetail.mlStore]}
            id="model-store-table"
            pagination={false}
            rowKey="name"
            size="small"
          />
        ) : (
          getEmptyPlaceholder()
        )}
      </>
    );
  }, [mlModelDetail, mlModelStoreColumn]);

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (
      isElementInView &&
      pagingObj?.after &&
      !isLoading &&
      activeTab === EntityTabs.ACTIVITY_FEED
    ) {
      fetchFeedHandler(
        pagingObj.after,
        activityFilter?.feedFilter,
        activityFilter?.threadType
      );
    }
  };

  const handleFeedFilterChange = useCallback((feedType, threadType) => {
    setActivityFilter({
      feedFilter: feedType,
      threadType,
    });
    fetchFeedHandler(undefined, feedType, threadType);
  }, []);

  useEffect(() => {
    fetchMoreThread(isInView, paging, isEntityThreadLoading);
  }, [paging, isEntityThreadLoading, isInView]);

  useEffect(() => {
    setFollowersData(mlModelDetail.followers || []);
  }, [
    mlModelDetail.followers,
    AppState.userDetails,
    AppState.nonSecureUserDetails,
  ]);

  const tabDetails = useMemo(() => {
    switch (activeTab) {
      case EntityTabs.CUSTOM_PROPERTIES:
        return (
          <CustomPropertyTable
            className="mt-0-important"
            entityDetails={
              mlModelDetail as CustomPropertyProps['entityDetails']
            }
            entityType={EntityType.MLMODEL}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              mlModelPermissions.EditAll || mlModelPermissions.EditCustomFields
            }
          />
        );
      case EntityTabs.LINEAGE:
        return (
          <Card
            className={classNames(ENTITY_CARD_CLASS, 'card-body-full')}
            data-testid="lineage-details">
            <EntityLineageComponent
              entityType={EntityType.MLMODEL}
              hasEditAccess={
                mlModelPermissions.EditAll || mlModelPermissions.EditLineage
              }
            />
          </Card>
        );
      case EntityTabs.DETAILS:
        return (
          <Card className={ENTITY_CARD_CLASS}>
            <Row gutter={[16, 16]}>
              <Col span={12}>{getMlHyperParameters}</Col>
              <Col span={12}>{getMlModelStore}</Col>
            </Row>
          </Card>
        );
      case EntityTabs.ACTIVITY_FEED:
        return (
          <Card className={ENTITY_CARD_CLASS} id="activityfeed">
            <Row>
              <Col offset={3} span={18}>
                <ActivityFeedList
                  isEntityFeed
                  withSidePanel
                  deletePostHandler={deletePostHandler}
                  entityName={mlModelDetail.name}
                  feedList={entityThread}
                  isFeedLoading={isEntityThreadLoading}
                  postFeedHandler={postFeedHandler}
                  updateThreadHandler={updateThreadHandler}
                  onFeedFiltersUpdate={handleFeedFilterChange}
                />
              </Col>
            </Row>
            {loader}
          </Card>
        );
      case EntityTabs.FEATURES:
      default:
        return (
          <Card className={ENTITY_CARD_CLASS}>
            <Description
              description={mlModelDetail.description}
              entityFieldTasks={getEntityFieldThreadCounts(
                EntityField.DESCRIPTION,
                entityFieldTaskCount
              )}
              entityFieldThreads={getEntityFieldThreadCounts(
                EntityField.DESCRIPTION,
                entityFieldThreadCount
              )}
              entityFqn={mlModelDetail.fullyQualifiedName}
              entityName={mlModelDetail.name}
              entityType={EntityType.MLMODEL}
              hasEditAccess={
                mlModelPermissions.EditAll || mlModelPermissions.EditDescription
              }
              isEdit={isEdit}
              isReadOnly={mlModelDetail.deleted}
              owner={mlModelDetail.owner}
              onCancel={onCancel}
              onDescriptionEdit={onDescriptionEdit}
              onDescriptionUpdate={onDescriptionUpdate}
              onThreadLinkSelect={handleThreadLinkSelect}
            />
            <MlModelFeaturesList
              handleFeaturesUpdate={onFeaturesUpdate}
              isDeleted={mlModelDetail.deleted}
              mlFeatures={mlModelDetail.mlFeatures}
              permissions={mlModelPermissions}
            />
          </Card>
        );
    }
  }, [
    activeTab,
    mlModelDetail,
    mlModelPermissions,
    isEdit,
    entityFieldThreadCount,
    entityFieldTaskCount,
    entityThread,
    isEntityThreadLoading,
    getMlHyperParameters,
    getMlModelStore,
  ]);

  return (
    <PageContainerV1>
      <div className="entity-details-container" data-testid="mlmodel-details">
        <EntityPageInfo
          canDelete={mlModelPermissions.Delete}
          currentOwner={mlModelDetail.owner}
          deleted={mlModelDetail.deleted}
          displayName={mlModelDetail.displayName}
          entityFieldTasks={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldTaskCount
          )}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={mlModelDetail.fullyQualifiedName}
          entityId={mlModelDetail.id}
          entityName={mlModelDetail.name}
          entityType={EntityType.MLMODEL}
          extraInfo={mlModelPageInfo}
          followHandler={followMlModel}
          followers={followersCount}
          followersList={mlModelDetail.followers || []}
          isFollowing={isFollowing}
          permission={mlModelPermissions}
          removeTier={
            mlModelPermissions.EditAll || mlModelPermissions.EditTier
              ? onTierRemove
              : undefined
          }
          serviceType={mlModelDetail.serviceType ?? ''}
          tags={mlModelTags}
          tagsHandler={onTagUpdate}
          tier={mlModelTier}
          titleLinks={breadcrumb}
          updateOwner={
            mlModelPermissions.EditAll || mlModelPermissions.EditOwner
              ? onOwnerUpdate
              : undefined
          }
          updateTier={
            mlModelPermissions.EditAll || mlModelPermissions.EditTier
              ? onTierUpdate
              : undefined
          }
          version={Number(version)}
          versionHandler={versionHandler}
          onRestoreEntity={handleRestoreMlmodel}
          onThreadLinkSelect={handleThreadLinkSelect}
          onUpdateDisplayName={handleUpdateDisplayName}
        />

        <div className="m-t-sm d-flex flex-col flex-grow">
          <Tabs
            activeKey={activeTab ?? EntityTabs.FEATURES}
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
          {tabDetails}
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}
          />
        </div>
      </div>
      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deletePostHandler}
          open={Boolean(threadLink)}
          postFeedHandler={postFeedHandler}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateThreadHandler}
          onCancel={handleThreadPanelClose}
        />
      ) : null}
    </PageContainerV1>
  );
};

export default observer(MlModelDetail);
