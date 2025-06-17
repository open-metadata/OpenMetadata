/*
 *  Copyright 2024 Collate.
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
import { ROUTES } from '../../../constants/constants';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Metric } from '../../../generated/entity/data/metric';
import { PageType } from '../../../generated/system/ui/page';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreMetric } from '../../../rest/metricsAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import metricDetailsClassBase from '../../../utils/MetricEntityUtils/MetricDetailsClassBase';
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
import './metric.less';
import { MetricDetailsProps } from './MetricDetails.interface';

const MetricDetails: React.FC<MetricDetailsProps> = ({
  metricDetails,
  metricPermissions,
  fetchMetricDetails,
  onFollowMetric,
  onMetricUpdate,
  onToggleDelete,
  onUnFollowMetric,
  onUpdateMetricDetails,
  onVersionChange,
  onUpdateVote,
}: MetricDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.OVERVIEW } =
    useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedMetricFqn } = useFqn();
  const navigate = useNavigate();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { customizedPage, isLoading } = useCustomPages(PageType.Metric);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const {
    owners,
    deleted,
    followers = [],
  } = useMemo(() => metricDetails, [metricDetails]);

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followMetric = async () =>
    isFollowing ? await onUnFollowMetric() : await onFollowMetric();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...metricDetails,
      displayName: data.displayName,
    };
    await onMetricUpdate(updatedData, 'displayName');
  };

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      const certificationTag = updateCertificationTag(newCertification);
      const updatedData = {
        ...metricDetails,
        certification: certificationTag,
      };

      await onMetricUpdate(updatedData, 'certification');
    },
    [metricDetails, onMetricUpdate]
  );

  const handleRestoreMetric = async () => {
    try {
      const { version: newVersion } = await restoreMetric(metricDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.metric'),
        })
      );
      onToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.metric'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(EntityType.METRIC, decodedMetricFqn, activeKey),
        { replace: true }
      );
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwners?: Metric['owners']) => {
      const updatedMetricDetails = {
        ...metricDetails,
        owners: newOwners,
      };
      await onMetricUpdate(updatedMetricDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(metricDetails?.tags ?? [], newTier);
    const updatedMetricDetails = {
      ...metricDetails,
      tags: tierTag,
    };

    return onMetricUpdate(updatedMetricDetails, 'tags');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.METRIC, decodedMetricFqn, handleFeedCount);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate(ROUTES.METRICS),
    []
  );

  const {
    editCustomAttributePermission,
    editAllPermission,
    editLineagePermission,
    viewSampleDataPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editCustomAttributePermission:
        (metricPermissions.EditAll || metricPermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: metricPermissions.EditAll && !deleted,
      editLineagePermission:
        (metricPermissions.EditAll || metricPermissions.EditLineage) &&
        !deleted,
      viewSampleDataPermission:
        metricPermissions.ViewAll || metricPermissions.ViewSampleData,
      viewAllPermission: metricPermissions.ViewAll,
    }),
    [metricPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [metricPermissions, decodedMetricFqn]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);
    const tabs = metricDetailsClassBase.getMetricDetailPageTabs({
      activeTab,
      feedCount,
      metricDetails,
      fetchMetricDetails,
      handleFeedCount,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      getEntityFeedCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.OVERVIEW
    );
  }, [
    activeTab,
    feedCount.totalCount,
    metricDetails,
    fetchMetricDetails,
    deleted,
    getEntityFeedCount,
    handleFeedCount,
    editCustomAttributePermission,
    editLineagePermission,
    editAllPermission,
    viewSampleDataPermission,
    viewAllPermission,
  ]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Metric),
    [tabs[0], activeTab]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.metric'),
      })}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={onUpdateMetricDetails}
            dataAsset={metricDetails}
            entityType={EntityType.METRIC}
            openTaskCount={feedCount.openTaskCount}
            permissions={metricPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followMetric}
            onMetricUpdate={onMetricUpdate}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreMetric}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={onVersionChange}
          />
        </Col>
        <GenericProvider<Metric>
          customizedPage={customizedPage}
          data={metricDetails}
          isTabExpanded={isTabExpanded}
          permissions={metricPermissions}
          type={EntityType.METRIC as CustomizeEntityType}
          onUpdate={onMetricUpdate}>
          <Col className="metric-page-tabs" span={24}>
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
      <LimitWrapper resource="metric">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<MetricDetailsProps>(MetricDetails);
