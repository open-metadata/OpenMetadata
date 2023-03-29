/*
 *  Copyright 2023 Collate.
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
import { Card, Col, Row, Tabs } from 'antd';
import AppState from 'AppState';
import { AxiosError } from 'axios';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from 'components/common/description/Description';
import EntityPageInfo from 'components/common/entityPageInfo/EntityPageInfo';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ContainerChildren from 'components/ContainerDetail/ContainerChildren/ContainerChildren';
import ContainerDataModel from 'components/ContainerDetail/ContainerDataModel/ContainerDataModel';
import PageContainerV1 from 'components/containers/PageContainerV1';
import EntityLineageComponent from 'components/EntityLineage/EntityLineage.component';
import {
  Edge,
  EdgeData,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from 'components/EntityLineage/EntityLineage.interface';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { getServiceDetailsPath } from 'constants/constants';
import { NO_PERMISSION_TO_VIEW } from 'constants/HelperTextUtil';
import { EntityInfo, EntityType } from 'enums/entity.enum';
import { ServiceCategory } from 'enums/service.enum';
import { OwnerType } from 'enums/user.enum';
import { compare } from 'fast-json-patch';
import { Container } from 'generated/entity/data/container';
import { EntityLineage } from 'generated/type/entityLineage';
import { EntityReference } from 'generated/type/entityReference';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags, ExtraInfo } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getLineageByFQN } from 'rest/lineageAPI';
import { addLineage, deleteLineageEdge } from 'rest/miscAPI';
import {
  addContainerFollower,
  getContainerByName,
  patchContainerDetails,
  removeContainerFollower,
  restoreContainer,
} from 'rest/objectStoreAPI';
import {
  getCurrentUserId,
  getEntityMissingError,
  getEntityPlaceHolder,
  getOwnerValue,
  refreshPage,
  sortTagsCaseInsensitive,
} from 'utils/CommonUtils';
import { getContainerDetailPath } from 'utils/ContainerDetailUtils';
import { getEntityLineage, getEntityName } from 'utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getLineageViewPath } from 'utils/RouterUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { bytesToSize } from 'utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';

enum CONTAINER_DETAILS_TABS {
  SCHEME = 'schema',
  CHILDREN = 'children',
  Lineage = 'lineage',
  CUSTOM_PROPERTIES = 'custom-properties',
}

const ContainerPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { entityFQN: containerName, tab = CONTAINER_DETAILS_TABS.SCHEME } =
    useParams<{ entityFQN: string; tab: CONTAINER_DETAILS_TABS }>();

  // Local states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isChildrenLoading, setIsChildrenLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);

  const [parentContainers, setParentContainers] = useState<Container[]>([]);
  const [containerData, setContainerData] = useState<Container>();
  const [containerChildrenData, setContainerChildrenData] = useState<
    Container['children']
  >([]);
  const [containerPermissions, setContainerPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });

  // data fetching methods
  const fetchContainerParent = async (
    parentName: string,
    newContainer = false
  ) => {
    try {
      const response = await getContainerByName(parentName, 'parent');
      setParentContainers((prev) =>
        newContainer ? [response] : [response, ...prev]
      );
      if (response.parent && response.parent.fullyQualifiedName) {
        await fetchContainerParent(response.parent.fullyQualifiedName);
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  };

  const fetchContainerDetail = async (containerFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getContainerByName(
        containerFQN,
        'parent,dataModel,owner,tags,followers,extension'
      );
      setContainerData({
        ...response,
        tags: sortTagsCaseInsensitive(response.tags || []),
      });
      if (response.parent && response.parent.fullyQualifiedName) {
        await fetchContainerParent(response.parent.fullyQualifiedName, true);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContainerChildren = async (containerFQN: string) => {
    setIsChildrenLoading(true);
    try {
      const { children } = await getContainerByName(containerFQN, 'children');
      setContainerChildrenData(children);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsChildrenLoading(false);
    }
  };

  const fetchLineageData = async (containerFQN: string) => {
    setIsLineageLoading(true);
    try {
      const response = await getLineageByFQN(
        containerFQN,
        EntityType.CONTAINER
      );

      setEntityLineage(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLineageLoading(false);
    }
  };

  const fetchResourcePermission = async (containerFQN: string) => {
    setIsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CONTAINER,
        containerFQN
      );
      setContainerPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const {
    hasViewPermission,
    hasEditDescriptionPermission,
    hasEditOwnerPermission,
    hasEditTagsPermission,
    hasEditTierPermission,
    hasEditCustomFieldsPermission,
    hasEditLineagePermission,
  } = useMemo(() => {
    return {
      hasViewPermission:
        containerPermissions.ViewAll || containerPermissions.ViewBasic,
      hasEditDescriptionPermission:
        containerPermissions.EditAll || containerPermissions.EditDescription,
      hasEditOwnerPermission:
        containerPermissions.EditAll || containerPermissions.EditOwner,
      hasEditTagsPermission:
        containerPermissions.EditAll || containerPermissions.EditTags,
      hasEditTierPermission:
        containerPermissions.EditAll || containerPermissions.EditTier,
      hasEditCustomFieldsPermission:
        containerPermissions.EditAll || containerPermissions.EditCustomFields,
      hasEditLineagePermission:
        containerPermissions.EditAll || containerPermissions.EditLineage,
    };
  }, [containerPermissions]);

  const {
    tier,
    deleted,
    owner,
    description,
    version,
    tags,
    entityName,
    entityId,
    followers,
    isUserFollowing,
    size,
    numberOfObjects,
  } = useMemo(() => {
    return {
      deleted: containerData?.deleted,
      owner: containerData?.owner,
      description: containerData?.description,
      version: containerData?.version,
      tier: getTierTags(containerData?.tags ?? []),
      tags: getTagsWithoutTier(containerData?.tags ?? []),
      entityId: containerData?.id,
      entityName: getEntityName(containerData),
      isUserFollowing: containerData?.followers?.some(
        ({ id }: { id: string }) => id === getCurrentUserId()
      ),
      followers: containerData?.followers ?? [],
      size: containerData?.size || 0,
      numberOfObjects: containerData?.numberOfObjects || 0,
    };
  }, [containerData]);

  const extraInfo: Array<ExtraInfo> = [
    {
      key: EntityInfo.OWNER,
      value: owner && getOwnerValue(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      isLink: true,
      openInNewTab: false,
      profileName: owner?.type === OwnerType.USER ? owner?.name : undefined,
    },
    {
      key: EntityInfo.TIER,
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
    {
      key: EntityInfo.NUMBER_OF_OBJECTS,
      value: numberOfObjects,
      showLabel: true,
    },
    {
      key: EntityInfo.SIZE,
      value: bytesToSize(size),
      showLabel: true,
    },
  ];

  const breadcrumbTitles = useMemo(() => {
    const serviceType = containerData?.serviceType;
    const service = containerData?.service;
    const serviceName = service?.name;

    const parentContainerItems = parentContainers.map((container) => ({
      name: getEntityName(container),
      url: getContainerDetailPath(container.fullyQualifiedName ?? ''),
    }));

    return [
      {
        name: serviceName || '',
        url: serviceName
          ? getServiceDetailsPath(
              serviceName,
              ServiceCategory.OBJECT_STORE_SERVICES
            )
          : '',
        imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
      },
      ...parentContainerItems,
      {
        name: entityName,
        url: '',
        activeTitle: true,
      },
    ];
  }, [containerData, containerName, entityName, parentContainers]);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getContainerDetailPath(containerName, tabValue),
      });
    }
  };

  const handleUpdateContainerData = (updatedData: Container) => {
    const jsonPatch = compare(omitBy(containerData, isUndefined), updatedData);

    return patchContainerDetails(containerData?.id ?? '', jsonPatch);
  };

  const handleUpdateDescription = async (updatedDescription: string) => {
    try {
      const { description: newDescription, version } =
        await handleUpdateContainerData({
          ...(containerData as Container),
          description: updatedDescription,
        });

      setContainerData((prev) => ({
        ...(prev as Container),
        description: newDescription,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFollowContainer = async () => {
    const followerId = currentUser?.id ?? '';
    const containerId = containerData?.id ?? '';
    try {
      if (isUserFollowing) {
        const response = await removeContainerFollower(containerId, followerId);
        const { oldValue } = response.changeDescription.fieldsDeleted[0];

        setContainerData((prev) => ({
          ...(prev as Container),
          followers: (containerData?.followers || []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      } else {
        const response = await addContainerFollower(containerId, followerId);
        const { newValue } = response.changeDescription.fieldsAdded[0];

        setContainerData((prev) => ({
          ...(prev as Container),
          followers: [...(containerData?.followers ?? []), ...newValue],
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRemoveTier = async () => {
    try {
      const { tags: newTags, version } = await handleUpdateContainerData({
        ...(containerData as Container),
        tags: getTagsWithoutTier(containerData?.tags ?? []),
      });

      setContainerData((prev) => ({
        ...(prev as Container),
        tags: newTags,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: Container['owner']) => {
      try {
        const { owner: newOwner, version } = await handleUpdateContainerData({
          ...(containerData as Container),
          owner: updatedOwner ? updatedOwner : undefined,
        });

        setContainerData((prev) => ({
          ...(prev as Container),
          owner: newOwner,
          version,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, containerData?.owner]
  );

  const handleUpdateTier = async (updatedTier?: string) => {
    try {
      if (updatedTier) {
        const { tags: newTags, version } = await handleUpdateContainerData({
          ...(containerData as Container),
          tags: [
            ...getTagsWithoutTier(containerData?.tags ?? []),
            {
              tagFQN: updatedTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
              source: TagSource.Classification,
            },
          ],
        });

        setContainerData((prev) => ({
          ...(prev as Container),
          tags: newTags,
          version,
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateTags = async (selectedTags: Array<EntityTags> = []) => {
    try {
      const { tags: newTags, version } = await handleUpdateContainerData({
        ...(containerData as Container),
        tags: [...(tier ? [tier] : []), ...selectedTags],
      });

      setContainerData((prev) => ({
        ...(prev as Container),
        tags: sortTagsCaseInsensitive(newTags || []),
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRestoreContainer = async () => {
    try {
      await restoreContainer(containerData?.id ?? '');
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.container'),
        }),
        2000
      );
      refreshPage();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.container'),
        })
      );
    }
  };

  // Lineage handlers
  const handleAddLineage = async (edge: Edge) => {
    try {
      await addLineage(edge);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRemoveLineage = async (data: EdgeData) => {
    try {
      await deleteLineageEdge(
        data.fromEntity,
        data.fromId,
        data.toEntity,
        data.toId
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleSetLeafNode = (val: EntityLineage, pos: LineagePos) => {
    if (pos === 'to' && val.downstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        downStreamNode: [...(prev.downStreamNode ?? []), val.entity.id],
      }));
    }
    if (pos === 'from' && val.upstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        upStreamNode: [...(prev.upStreamNode ?? []), val.entity.id],
      }));
    }
  };

  const handleLoadLineageNode = async (
    node: EntityReference,
    pos: LineagePos
  ) => {
    setNodeLoading({ id: node.id, state: true });

    try {
      const response = await getLineageByFQN(
        node.fullyQualifiedName ?? '',
        node.type
      );
      handleSetLeafNode(response, pos);
      setEntityLineage(getEntityLineage(entityLineage, response, pos));
      setTimeout(() => {
        setNodeLoading((prev) => ({ ...prev, state: false }));
      }, 500);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFullScreenClick = () =>
    history.push(getLineageViewPath(EntityType.CONTAINER, containerName));

  const handleExtensionUpdate = async (updatedContainer: Container) => {
    try {
      const response = await handleUpdateContainerData(updatedContainer);
      setContainerData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateDataModel = async (
    updatedDataModel: Container['dataModel']
  ) => {
    try {
      const { dataModel: newDataModel, version } =
        await handleUpdateContainerData({
          ...(containerData as Container),
          dataModel: updatedDataModel,
        });

      setContainerData((prev) => ({
        ...(prev as Container),
        dataModel: newDataModel,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Effects
  useEffect(() => {
    if (hasViewPermission) {
      fetchContainerDetail(containerName);
    }
  }, [containerName, containerPermissions]);

  useEffect(() => {
    fetchResourcePermission(containerName);
    // reset parent containers list on containername change
    setParentContainers([]);
  }, [containerName]);

  useEffect(() => {
    if (tab === CONTAINER_DETAILS_TABS.Lineage) {
      fetchLineageData(containerName);
    }
    if (tab === CONTAINER_DETAILS_TABS.CHILDREN) {
      fetchContainerChildren(containerName);
    }
  }, [tab, containerName]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.container'), containerName)}
      </ErrorPlaceHolder>
    );
  }

  if (!hasViewPermission && !isLoading) {
    return <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>;
  }

  return (
    <PageContainerV1>
      <div className="entity-details-container">
        <EntityPageInfo
          canDelete={containerPermissions.Delete}
          currentOwner={owner}
          deleted={deleted}
          entityFqn={containerName}
          entityId={entityId}
          entityName={entityName || ''}
          entityType={EntityType.CONTAINER}
          extraInfo={extraInfo}
          followHandler={handleFollowContainer}
          followers={followers.length}
          followersList={followers}
          isFollowing={isUserFollowing}
          isTagEditable={hasEditTagsPermission}
          removeTier={hasEditTierPermission ? handleRemoveTier : undefined}
          tags={tags}
          tagsHandler={handleUpdateTags}
          tier={tier}
          titleLinks={breadcrumbTitles}
          updateOwner={hasEditOwnerPermission ? handleUpdateOwner : undefined}
          updateTier={hasEditTierPermission ? handleUpdateTier : undefined}
          version={version + ''}
          onRestoreEntity={handleRestoreContainer}
        />
        <Tabs activeKey={tab} className="h-full" onChange={handleTabChange}>
          <Tabs.TabPane
            key={CONTAINER_DETAILS_TABS.SCHEME}
            tab={
              <span data-testid={CONTAINER_DETAILS_TABS.SCHEME}>
                {t('label.schema')}
              </span>
            }>
            <Row
              className="tw-bg-white tw-flex-grow tw-p-4 tw-shadow tw-rounded-md"
              gutter={[0, 16]}>
              <Col span={24}>
                <Description
                  description={description}
                  entityFqn={containerName}
                  entityName={entityName}
                  entityType={EntityType.CONTAINER}
                  hasEditAccess={hasEditDescriptionPermission}
                  isEdit={isEditDescription}
                  isReadOnly={deleted}
                  owner={owner}
                  onCancel={() => setIsEditDescription(false)}
                  onDescriptionEdit={() => setIsEditDescription(true)}
                  onDescriptionUpdate={handleUpdateDescription}
                />
              </Col>
              <Col span={24}>
                <ContainerDataModel
                  dataModel={containerData?.dataModel}
                  hasDescriptionEditAccess={hasEditDescriptionPermission}
                  hasTagEditAccess={hasEditTagsPermission}
                  isReadOnly={Boolean(deleted)}
                  onUpdate={handleUpdateDataModel}
                />
              </Col>
            </Row>
          </Tabs.TabPane>
          <Tabs.TabPane
            key={CONTAINER_DETAILS_TABS.CHILDREN}
            tab={
              <span data-testid={CONTAINER_DETAILS_TABS.CHILDREN}>
                {t('label.children')}
              </span>
            }>
            <Row
              className="tw-bg-white tw-flex-grow tw-p-4 tw-shadow tw-rounded-md"
              gutter={[0, 16]}>
              <Col span={24}>
                {isChildrenLoading ? (
                  <Loader />
                ) : (
                  <ContainerChildren childrenList={containerChildrenData} />
                )}
              </Col>
            </Row>
          </Tabs.TabPane>
          <Tabs.TabPane
            key={CONTAINER_DETAILS_TABS.Lineage}
            tab={
              <span data-testid={CONTAINER_DETAILS_TABS.Lineage}>
                {t('label.lineage')}
              </span>
            }>
            <Card
              className="h-full card-body-full"
              data-testid="lineage-details">
              <EntityLineageComponent
                addLineageHandler={handleAddLineage}
                deleted={deleted}
                entityLineage={entityLineage}
                entityLineageHandler={(lineage: EntityLineage) =>
                  setEntityLineage(lineage)
                }
                entityType={EntityType.CONTAINER}
                hasEditAccess={hasEditLineagePermission}
                isLoading={isLineageLoading}
                isNodeLoading={isNodeLoading}
                lineageLeafNodes={leafNodes}
                loadNodeHandler={handleLoadLineageNode}
                removeLineageHandler={handleRemoveLineage}
                onFullScreenClick={handleFullScreenClick}
              />
            </Card>
          </Tabs.TabPane>
          <Tabs.TabPane
            key={CONTAINER_DETAILS_TABS.CUSTOM_PROPERTIES}
            tab={
              <span data-testid={CONTAINER_DETAILS_TABS.CUSTOM_PROPERTIES}>
                {t('label.custom-property-plural')}
              </span>
            }>
            <Card className="h-full">
              <CustomPropertyTable
                entityDetails={
                  containerData as CustomPropertyProps['entityDetails']
                }
                entityType={EntityType.CONTAINER}
                handleExtensionUpdate={handleExtensionUpdate}
                hasEditAccess={hasEditCustomFieldsPermission}
              />
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </PageContainerV1>
  );
};

export default observer(ContainerPage);
