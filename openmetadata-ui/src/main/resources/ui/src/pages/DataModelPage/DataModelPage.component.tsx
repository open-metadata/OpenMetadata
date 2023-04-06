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

import { Card, Space, Tabs } from 'antd';
import AppState from 'AppState';
import { AxiosError } from 'axios';
import Description from 'components/common/description/Description';
import EntityPageInfo from 'components/common/entityPageInfo/EntityPageInfo';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from 'components/containers/PageContainerV1';
import ModelTab from 'components/DataModels/ModelTab/ModelTab.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { getServiceDetailsPath } from 'constants/constants';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { NO_PERMISSION_TO_VIEW } from 'constants/HelperTextUtil';
import { EntityInfo, EntityType } from 'enums/entity.enum';
import { ServiceCategory } from 'enums/service.enum';
import { OwnerType } from 'enums/user.enum';
import { compare } from 'fast-json-patch';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { isUndefined, omitBy } from 'lodash';
import { EntityTags, ExtraInfo } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  addDataModelFollower,
  getDataModelsByName,
  patchDataModelDetails,
  removeDataModelFollower,
} from 'rest/dataModelsAPI';
import {
  getCurrentUserId,
  getEntityMissingError,
  getEntityPlaceHolder,
  getOwnerValue,
} from 'utils/CommonUtils';
import { getDataModelsDetailPath } from 'utils/DataModelsUtils';
import { getEntityName } from 'utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { DATA_MODELS_DETAILS_TABS } from './DataModelsInterface';

const DataModelsPage = () => {
  const history = useHistory();
  const { t } = useTranslation();

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardDataModelFQN, tab } = useParams() as Record<string, string>;

  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [dataModelPermissions, setDataModelPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [dataModelData, setDataModelData] = useState<DashboardDataModel>();

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const {
    hasViewPermission,
    hasEditDescriptionPermission,
    hasEditOwnerPermission,
    hasEditTagsPermission,
    hasEditTierPermission,
  } = useMemo(() => {
    return {
      hasViewPermission:
        dataModelPermissions.ViewAll || dataModelPermissions.ViewBasic,
      hasEditDescriptionPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditDescription,
      hasEditOwnerPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditOwner,
      hasEditTagsPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditTags,
      hasEditTierPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditTier,
      hasEditLineagePermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditLineage,
    };
  }, [dataModelPermissions]);

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
      deleted: dataModelData?.deleted,
      owner: dataModelData?.owner,
      description: dataModelData?.description,
      version: dataModelData?.version,
      tier: getTierTags(dataModelData?.tags ?? []),
      tags: getTagsWithoutTier(dataModelData?.tags ?? []),
      entityId: dataModelData?.id,
      entityName: getEntityName(dataModelData),
      isUserFollowing: dataModelData?.followers?.some(
        ({ id }: { id: string }) => id === getCurrentUserId()
      ),
      followers: dataModelData?.followers ?? [],
    };
  }, [dataModelData]);

  const breadcrumbTitles = useMemo(() => {
    const serviceType = dataModelData?.serviceType;
    const service = dataModelData?.service;
    const serviceName = service?.name;

    return [
      {
        name: serviceName || '',
        url: serviceName
          ? getServiceDetailsPath(
              serviceName,
              ServiceCategory.DASHBOARD_SERVICES
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
  }, [dataModelData, dashboardDataModelFQN, entityName]);

  const fetchResourcePermission = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CONTAINER,
        dashboardDataModelFQN
      );
      setDataModelPermissions(entityPermission);
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

  const handleUpdateDataModelData = (updatedData: DashboardDataModel) => {
    const jsonPatch = compare(omitBy(dataModelData, isUndefined), updatedData);

    return patchDataModelDetails(dataModelData?.id ?? '', jsonPatch);
  };

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getDataModelsDetailPath(dashboardDataModelFQN, tabValue),
      });
    }
  };

  const handleUpdateDescription = async (updatedDescription: string) => {
    try {
      const { description: newDescription, version } =
        await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          description: updatedDescription,
        });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        description: newDescription,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchDataModelDetails = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getDataModelsByName(
        dashboardDataModelFQN,
        'owner,tags,followers'
      );
      setDataModelData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowDataModel = async () => {
    const followerId = currentUser?.id ?? '';
    const dataModelId = dataModelData?.id ?? '';
    try {
      if (isUserFollowing) {
        const response = await removeDataModelFollower(dataModelId, followerId);
        const { oldValue } = response.changeDescription.fieldsDeleted[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: (dataModelData?.followers || []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      } else {
        const response = await addDataModelFollower(dataModelId, followerId);
        const { newValue } = response.changeDescription.fieldsAdded[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: [...(dataModelData?.followers ?? []), ...newValue],
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

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

  const handleRemoveTier = async () => {
    try {
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags: getTagsWithoutTier(dataModelData?.tags ?? []),
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: newTags,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateTags = async (selectedTags: Array<EntityTags> = []) => {
    try {
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags: [...(tier ? [tier] : []), ...selectedTags],
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: newTags,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: DashboardDataModel['owner']) => {
      try {
        const { owner: newOwner, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          owner: updatedOwner ? updatedOwner : undefined,
        });

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          owner: newOwner,
          version,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [dataModelData, dataModelData?.owner]
  );

  const handleUpdateTier = async (updatedTier?: string) => {
    try {
      if (updatedTier) {
        const { tags: newTags, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          tags: [
            ...getTagsWithoutTier(dataModelData?.tags ?? []),
            {
              tagFQN: updatedTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
              source: TagSource.Classification,
            },
          ],
        });

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          tags: newTags,
          version,
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateDataModel = async (
    updatedDataModel: DashboardDataModel['columns']
  ) => {
    try {
      const { columns: newColumns, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        columns: updatedDataModel,
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        columns: newColumns,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (hasViewPermission) {
      fetchDataModelDetails(dashboardDataModelFQN);
    }
  }, [dashboardDataModelFQN, dataModelPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardDataModelFQN);
  }, [dashboardDataModelFQN]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.data-model'), dashboardDataModelFQN)}
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
          canDelete={dataModelPermissions.Delete}
          currentOwner={owner}
          deleted={deleted}
          entityFqn={dashboardDataModelFQN}
          entityId={entityId}
          entityName={entityName || ''}
          entityType={EntityType.DASHBOARD_DATA_MODEL}
          extraInfo={extraInfo}
          followHandler={handleFollowDataModel}
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
        />
        <Tabs activeKey={tab} className="h-full" onChange={handleTabChange}>
          <Tabs.TabPane
            key={DATA_MODELS_DETAILS_TABS.MODEL}
            tab={
              <span data-testid={DATA_MODELS_DETAILS_TABS.MODEL}>
                {t('label.model')}
              </span>
            }>
            <Card className={ENTITY_CARD_CLASS}>
              <Space className="w-full" direction="vertical" size={8}>
                <Description
                  description={description}
                  entityFqn={dashboardDataModelFQN}
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

                <ModelTab
                  data={dataModelData?.columns || []}
                  hasEditDescriptionPermission={hasEditDescriptionPermission}
                  hasEditTagsPermission={hasEditTagsPermission}
                  isReadOnly={Boolean(deleted)}
                  onUpdate={handleUpdateDataModel}
                />
              </Space>
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </PageContainerV1>
  );
};

export default DataModelsPage;
