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
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
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
import AppState from '../../AppState';
import { getMlModelDetailsPath } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { MlHyperParameter } from '../../generated/api/data/createMlModel';
import { Mlmodel, MlStore } from '../../generated/entity/data/mlmodel';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useElementInView } from '../../hooks/useElementInView';
import { getEmptyPlaceholder, refreshPage } from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
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

  versionHandler,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { mlModelFqn, tab: activeTab = EntityTabs.FEATURES } =
    useParams<{ tab: EntityTabs; mlModelFqn: string }>();

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

  const mlModelTags = useMemo(() => {
    return getTagsWithoutTier(mlModelDetail.tags || []);
  }, [mlModelDetail.tags]);

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

  const isFollowing = useMemo(
    () =>
      mlModelDetail.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    [mlModelDetail.followers]
  );

  const followMlModel = async () => {
    if (isFollowing) {
      await unfollowMlModelHandler();
    } else {
      await followMlModelHandler();
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

  const onOwnerUpdate = useCallback(
    async (newOwner?: Mlmodel['owner']) => {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        owner: newOwner
          ? {
              ...mlModelDetail.owner,
              ...newOwner,
            }
          : undefined,
      };
      await settingsUpdateHandler(updatedMlModelDetails);
    },
    [mlModelDetail, mlModelDetail.owner]
  );

  const onTierUpdate = async (newTier?: string) => {
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

      await settingsUpdateHandler(updatedMlModelDetails);
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
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            dataAsset={mlModelDetail}
            entityType={EntityType.MLMODEL}
            permissions={mlModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followMlModel}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreMlmodel}
            onTierUpdate={onTierUpdate}
            onVersionClick={versionHandler}
          />
        </Col>
        <Col>
          <Tabs
            activeKey={activeTab ?? EntityTabs.SCHEMA}
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
          {tabDetails}
        </Col>
      </Row>

      <div
        data-testid="observer-element"
        id="observer-element"
        ref={elementRef as RefObject<HTMLDivElement>}
      />
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
    </PageLayoutV1>
  );
};

export default observer(MlModelDetail);
