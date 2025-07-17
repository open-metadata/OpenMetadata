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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Operation as PermissionOperation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../../generated/system/ui/uiCustomization';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreDashboard } from '../../../rest/dashboardAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import dashboardDetailsClassBase from '../../../utils/DashboardDetailsClassBase';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
} from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import {
  updateCertificationTag,
  updateTierTag,
} from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { DashboardDetailsProps } from './DashboardDetails.interface';

const DashboardDetails = ({
  updateDashboardDetailsState,
  dashboardDetails,
  fetchDashboard,
  followDashboardHandler,
  unFollowDashboardHandler,
  versionHandler,
  onUpdateVote,
  onDashboardUpdate,
  handleToggleDelete,
}: DashboardDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();
  const { tab: activeTab = EntityTabs.DETAILS } =
    useRequiredParams<{ tab: EntityTabs }>();
  const { customizedPage, isLoading } = useCustomPages(PageType.Dashboard);
  const { fqn: decodedDashboardFQN } = useFqn();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const {
    owners,
    followers = [],
    deleted,
  } = useMemo(() => {
    return dashboardDetails;
  }, [
    dashboardDetails.owners,
    dashboardDetails.followers,
    dashboardDetails.deleted,
  ]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
    };
  }, [followers, currentUser]);

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.DASHBOARD,
        dashboardDetails.id
      );
      setDashboardPermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.dashboard'),
        })
      );
    }
  }, [dashboardDetails.id, getEntityPermission, setDashboardPermissions]);

  useEffect(() => {
    if (dashboardDetails.id) {
      fetchResourcePermission();
    }
  }, [dashboardDetails.id]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.DASHBOARD, decodedDashboardFQN, handleFeedCount);

  useEffect(() => {
    getEntityFeedCount();
  }, [decodedDashboardFQN]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(
          EntityType.DASHBOARD,
          decodedDashboardFQN,
          activeKey
        ),
        {
          replace: true,
        }
      );
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwners?: Dashboard['owners']) => {
      const updatedDashboard = {
        ...dashboardDetails,
        owners: newOwners,
      };
      await onDashboardUpdate(updatedDashboard);
    },
    [owners]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(dashboardDetails?.tags ?? [], newTier);
    const updatedDashboard = {
      ...dashboardDetails,
      tags: tierTag,
    };
    await onDashboardUpdate(updatedDashboard);
  };

  const onUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...dashboardDetails,
      displayName: data.displayName,
    };
    await onDashboardUpdate(updatedData);
  };
  const onExtensionUpdate = async (updatedData: Dashboard) => {
    await onDashboardUpdate({
      ...dashboardDetails,
      extension: updatedData.extension,
    });
  };

  const handleRestoreDashboard = async () => {
    try {
      const { version: newVersion } = await restoreDashboard(
        dashboardDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.dashboard'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.dashboard'),
        })
      );
    }
  };

  const followDashboard = async () => {
    isFollowing
      ? await unFollowDashboardHandler()
      : await followDashboardHandler();
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    [navigate]
  );

  const {
    editCustomAttributePermission,
    editAllPermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          dashboardPermissions,
          PermissionOperation.EditCustomFields
        ) && !deleted,
      editAllPermission: PermissionOperation.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          dashboardPermissions,
          PermissionOperation.EditLineage
        ) && !deleted,
      viewAllPermission: dashboardPermissions.ViewAll,
    }),
    [dashboardPermissions, deleted]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = dashboardDetailsClassBase.getDashboardDetailPageTabs({
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      dashboardDetails,
      deleted: deleted ?? false,
      handleFeedCount,
      feedCount,
      activeTab,
      getEntityFeedCount,
      fetchDashboard,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.DETAILS
    );
  }, [
    feedCount.totalCount,
    activeTab,
    dashboardDetails,
    deleted,
    handleFeedCount,
    editLineagePermission,
    editCustomAttributePermission,
    editAllPermission,
    viewAllPermission,
    onExtensionUpdate,
  ]);
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (dashboardDetails) {
        const certificationTag: Dashboard['certification'] =
          updateCertificationTag(newCertification);
        const updatedDashboardDetails = {
          ...dashboardDetails,
          certification: certificationTag,
        };

        await onDashboardUpdate(updatedDashboardDetails, 'certification');
      }
    },
    [dashboardDetails, onDashboardUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Dashboard),
    [tabs[0], activeTab]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.dashboard'),
      })}
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDashboardDetailsState}
            dataAsset={dashboardDetails}
            entityType={EntityType.DASHBOARD}
            openTaskCount={feedCount.openTaskCount}
            permissions={dashboardPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={onUpdateDisplayName}
            onFollowClick={followDashboard}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreDashboard}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Dashboard>
          customizedPage={customizedPage}
          data={dashboardDetails}
          isTabExpanded={isTabExpanded}
          permissions={dashboardPermissions}
          type={EntityType.DASHBOARD}
          onUpdate={onDashboardUpdate}>
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={activeTab}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
              tabBarExtraContent={
                isExpandViewSupported && (
                  <AlignRightIconButton
                    className={isTabExpanded ? 'rotate-180' : ''}
                    title={
                      isTabExpanded ? t('label.collapse') : t('label.expand')
                    }
                    onClick={toggleTabExpanded}
                  />
                )
              }
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>

      <LimitWrapper resource="dashboard">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<DashboardDetailsProps>(DashboardDetails);
