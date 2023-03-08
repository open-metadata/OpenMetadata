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
import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import Description from 'components/common/description/Description';
import EntityPageInfo from 'components/common/entityPageInfo/EntityPageInfo';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ContainerChildren from 'components/ContainerDetail/ContainerChildren/ContainerChildren';
import ContainerDataModel from 'components/ContainerDetail/ContainerDataModel/ContainerDataModel';
import PageContainerV1 from 'components/containers/PageContainerV1';
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
import { isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import { ExtraInfo } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getContainerByName, patchContainerDetails } from 'rest/objectStoreAPI';
import {
  getCurrentUserId,
  getEntityMissingError,
  getEntityName,
  getEntityPlaceHolder,
  getOwnerValue,
} from 'utils/CommonUtils';
import { getContainerDetailPath } from 'utils/ContainerDetailUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';

export enum CONTAINER_DETAILS_TABS {
  SCHEME = 'schema',
  CHILDREN = 'children',
  Lineage = 'lineage',
  CUSTOM_PROPERTIES = 'custom-properties',
}

const ContainerPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { containerName, tab = CONTAINER_DETAILS_TABS.SCHEME } =
    useParams<{ containerName: string; tab: CONTAINER_DETAILS_TABS }>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [containerData, setContainerData] = useState<Container>();

  const [containerPermissions, setContainerPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);

  const fetchContainerDetail = async (containerFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getContainerByName(
        containerFQN,
        'parent,children,dataModel,owner,tags,followers,extension'
      );
      setContainerData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
    } finally {
      setIsLoading(false);
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

  const hasViewPermission = useMemo(() => {
    return containerPermissions?.ViewAll || containerPermissions?.ViewBasic;
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
  ];

  const breadcrumbTitles = useMemo(() => {
    const serviceType = containerData?.serviceType;
    const service = containerData?.service;
    const serviceName = service?.name;

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
      {
        name: entityName,
        url: '',
        activeTitle: true,
      },
    ];
  }, [containerData, containerName, entityName]);

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
      const { description: newDescription } = await handleUpdateContainerData({
        ...(containerData as Container),
        description: updatedDescription,
      });

      setContainerData((prev) => ({
        ...(prev as Container),
        description: newDescription,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (hasViewPermission) {
      fetchContainerDetail(containerName);
    }
  }, [containerName, containerPermissions]);

  useEffect(() => {
    fetchResourcePermission(containerName);
  }, [containerName]);

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

  const tempFunction = () => {
    // temp function
  };

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
          followHandler={tempFunction}
          followers={followers.length}
          followersList={followers}
          isFollowing={isUserFollowing}
          isTagEditable={
            containerPermissions.EditAll || containerPermissions.EditTags
          }
          removeOwner={
            containerPermissions.EditAll || containerPermissions.EditOwner
              ? tempFunction
              : undefined
          }
          removeTier={
            containerPermissions.EditAll || containerPermissions.EditTier
              ? tempFunction
              : undefined
          }
          tags={tags}
          tagsHandler={tempFunction}
          tier={tier}
          titleLinks={breadcrumbTitles}
          updateOwner={
            containerPermissions.EditAll || containerPermissions.EditOwner
              ? tempFunction
              : undefined
          }
          updateTier={
            containerPermissions.EditAll || containerPermissions.EditTier
              ? tempFunction
              : undefined
          }
          version={version + ''}
          versionHandler={tempFunction}
          onRestoreEntity={tempFunction}
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
                  hasEditAccess={
                    containerPermissions.EditAll ||
                    containerPermissions.EditDescription
                  }
                  isEdit={isEditDescription}
                  isReadOnly={deleted}
                  owner={owner}
                  onCancel={() => setIsEditDescription(false)}
                  onDescriptionEdit={() => setIsEditDescription(true)}
                  onDescriptionUpdate={handleUpdateDescription}
                />
              </Col>
              <Col span={24}>
                <ContainerDataModel dataModel={containerData?.dataModel} />
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
                <ContainerChildren childrenList={containerData?.children} />
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
            <Row
              className="tw-bg-white tw-flex-grow tw-p-4 tw-shadow tw-rounded-md"
              gutter={[0, 16]}>
              {t('label.lineage')}
            </Row>
          </Tabs.TabPane>
          <Tabs.TabPane
            key={CONTAINER_DETAILS_TABS.CUSTOM_PROPERTIES}
            tab={
              <span data-testid={CONTAINER_DETAILS_TABS.CUSTOM_PROPERTIES}>
                {t('label.custom-property-plural')}
              </span>
            }>
            <Row
              className="tw-bg-white tw-flex-grow tw-p-4 tw-shadow tw-rounded-md"
              gutter={[0, 16]}>
              {t('label.custom-property-plural')}
            </Row>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </PageContainerV1>
  );
};

export default observer(ContainerPage);
