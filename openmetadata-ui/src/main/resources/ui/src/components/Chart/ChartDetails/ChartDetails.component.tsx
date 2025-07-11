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
import { Chart } from '../../../generated/entity/data/chart';
import { PageType } from '../../../generated/system/ui/page';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreChart } from '../../../rest/chartsAPI';
import chartDetailsClassBase from '../../../utils/ChartDetailsClassBase';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
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
import { ChartDetailsProps } from './ChartDetails.interface';

const ChartDetails = ({
  updateChartDetailsState,
  chartDetails,
  fetchChart,
  followChartHandler,
  unFollowChartHandler,
  versionHandler,
  onUpdateVote,
  onChartUpdate,
  handleToggleDelete,
}: ChartDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();
  const { tab: activeTab = EntityTabs.DETAILS } = useRequiredParams<{
    tab: EntityTabs;
  }>();
  const { customizedPage, isLoading } = useCustomPages(PageType.Chart);
  const { fqn: decodedChartFQN } = useFqn();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const [chartPermissions, setChartPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { followers = [], deleted } = useMemo(() => {
    return chartDetails;
  }, [chartDetails.owners, chartDetails.followers, chartDetails.deleted]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
    };
  }, [followers, currentUser]);

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.CHART,
        chartDetails.id
      );
      setChartPermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.chart'),
        })
      );
    }
  }, [chartDetails.id, getEntityPermission, setChartPermissions]);

  useEffect(() => {
    if (chartDetails.id) {
      fetchResourcePermission();
    }
  }, [chartDetails.id]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.CHART, decodedChartFQN, handleFeedCount);

  useEffect(() => {
    getEntityFeedCount();
  }, [decodedChartFQN]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(EntityType.CHART, decodedChartFQN, activeKey),
        {
          replace: true,
        }
      );
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwners?: Chart['owners']) => {
      const updatedChart = {
        ...chartDetails,
        owners: newOwners,
      };
      await onChartUpdate(updatedChart, 'owners');
    },
    [chartDetails, onChartUpdate]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(chartDetails?.tags ?? [], newTier);
    const updatedChart = {
      ...chartDetails,
      tags: tierTag,
    };
    await onChartUpdate(updatedChart, 'tags');
  };

  const onUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...chartDetails,
      displayName: data.displayName,
    };
    await onChartUpdate(updatedData, 'displayName');
  };

  const handleRestoreChart = async () => {
    try {
      const { version: newVersion } = await restoreChart(chartDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.chart'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.chart'),
        })
      );
    }
  };

  const followChart = async () => {
    isFollowing ? await unFollowChartHandler() : await followChartHandler();
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    [navigate]
  );

  const { editAllPermission, editLineagePermission, viewAllPermission } =
    useMemo(
      () => ({
        editAllPermission: chartPermissions.EditAll && !deleted,
        editLineagePermission:
          (chartPermissions.EditAll || chartPermissions.EditLineage) &&
          !deleted,
        viewAllPermission: chartPermissions.ViewAll,
      }),
      [chartPermissions, deleted]
    );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = chartDetailsClassBase.getChartDetailPageTabs({
      editLineagePermission,
      viewAllPermission,
      chartDetails,
      deleted: deleted ?? false,
      handleFeedCount,
      feedCount,
      activeTab,
      getEntityFeedCount,
      fetchChart,
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
    chartDetails,
    deleted,
    handleFeedCount,
    editLineagePermission,
    editAllPermission,
    viewAllPermission,
  ]);
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (chartDetails) {
        const certificationTag: Chart['certification'] =
          updateCertificationTag(newCertification);
        const updatedChartDetails = {
          ...chartDetails,
          certification: certificationTag,
        };

        await onChartUpdate(updatedChartDetails, 'certification');
      }
    },
    [chartDetails, onChartUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Chart),
    [tabs[0], activeTab]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.chart'),
      })}
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateChartDetailsState}
            dataAsset={chartDetails}
            entityType={EntityType.CHART}
            openTaskCount={feedCount.openTaskCount}
            permissions={chartPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={onUpdateDisplayName}
            onFollowClick={followChart}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreChart}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Chart>
          customizedPage={customizedPage}
          data={chartDetails}
          isTabExpanded={isTabExpanded}
          permissions={chartPermissions}
          type={EntityType.CHART}
          onUpdate={onChartUpdate}>
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

      <LimitWrapper resource="chart">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<ChartDetailsProps>(ChartDetails);
