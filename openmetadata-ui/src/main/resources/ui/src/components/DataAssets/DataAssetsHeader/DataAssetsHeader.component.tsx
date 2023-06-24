/* eslint-disable no-case-declarations */
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
import Icon from '@ant-design/icons';
import { Button, Col, Divider, Row, Space, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-links.svg';
import { ReactComponent as TaskOpenIcon } from 'assets/svg/ic-open-task.svg';
import { ReactComponent as ShareIcon } from 'assets/svg/ic-share.svg';
import { ReactComponent as StarFilledIcon } from 'assets/svg/ic-star-filled.svg';
import { ReactComponent as StarIcon } from 'assets/svg/ic-star.svg';
import { ReactComponent as VersionIcon } from 'assets/svg/ic-version.svg';
import { AxiosError } from 'axios';
import { ActivityFeedTabs } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import AnnouncementCard from 'components/common/entityPageInfo/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from 'components/common/entityPageInfo/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import TierCard from 'components/common/TierCard/TierCard';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import EntityHeaderTitle from 'components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { getDashboardDetailsPath } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import { Container } from 'generated/entity/data/container';
import { Dashboard } from 'generated/entity/data/dashboard';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Mlmodel } from 'generated/entity/data/mlmodel';
import { Pipeline } from 'generated/entity/data/pipeline';
import { Table } from 'generated/entity/data/table';
import { Topic } from 'generated/entity/data/topic';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from 'generated/entity/feed/thread';
import { useClipboard } from 'hooks/useClipBoard';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getActiveAnnouncement, getFeedCount } from 'rest/feedsAPI';
import { getCurrentUserId, getEntityDetailLink } from 'utils/CommonUtils';
import {
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForTable,
  getEntityFeedLink,
  getEntityName,
} from 'utils/EntityUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { bytesToSize } from 'utils/StringsUtils';
import { getTierTags, getUsagePercentile } from 'utils/TableUtils';
import { showErrorToast, showInfoToast } from 'utils/ToastUtils';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
} from './DataAssetsHeader.interface';

export const ExtraInfoLabel = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <>
    <Divider className="self-center m-x-sm" type="vertical" />
    <Typography.Text className="self-center text-xs whitespace-nowrap">
      <span className="text-grey-muted">{`${label}: `}</span>
      <span className="font-medium">{value}</span>
    </Typography.Text>
  </>
);

export const ExtraInfoLink = ({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href: string;
}) => (
  <>
    <Divider className="self-center m-x-sm" type="vertical" />
    <div className="d-flex items-center text-xs">
      {!isEmpty(label) && (
        <span className="text-grey-muted m-r-xss">{`${label}: `}</span>
      )}
      <Typography.Link href={href} style={{ fontSize: '12px' }}>
        {value}{' '}
      </Typography.Link>
      <IconExternalLink className="m-l-xss " width={14} />{' '}
    </div>
  </>
);

export const DataAssetsHeader = ({
  dataAsset,
  onOwnerUpdate,
  onTierUpdate,
  permissions,
  onVersionClick,
  onFollowClick,
  entityType,
  onRestoreDataAsset,
  onDisplayNameUpdate,
}: DataAssetsHeaderProps) => {
  const USERId = getCurrentUserId();
  const { onCopyToClipBoard } = useClipboard(window.location.href);
  const [taskCount, setTaskCount] = useState(0);
  const history = useHistory();
  const icon = useMemo(
    () =>
      dataAsset?.serviceType ? (
        <img className="h-9" src={serviceTypeLogo(dataAsset.serviceType)} />
      ) : null,
    [dataAsset]
  );

  const { entityName, tier, isFollowing, version, followers } = useMemo(
    () => ({
      isFollowing: dataAsset.followers?.some(({ id }) => id === USERId),
      tier: getTierTags(dataAsset.tags ?? []),
      entityName: getEntityName(dataAsset),
      version: dataAsset.version,
      followers: dataAsset.followers?.length,
    }),
    [dataAsset, USERId]
  );

  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawer] =
    useState<boolean>(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Thread>();

  const fetchActiveAnnouncement = async () => {
    try {
      const announcements = await getActiveAnnouncement(
        getEntityFeedLink(entityType, dataAsset.fullyQualifiedName)
      );

      if (!isEmpty(announcements.data)) {
        setActiveAnnouncement(announcements.data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTaskCount = () => {
    // To get open tasks count
    getFeedCount(
      getEntityFeedLink(entityType, dataAsset.fullyQualifiedName),
      ThreadType.Task,
      ThreadTaskStatus.Open
    )
      .then((res) => {
        if (res) {
          setTaskCount(res.totalCount);
        } else {
          throw t('server.entity-feed-fetch-error');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('server.entity-feed-fetch-error'));
      });
  };

  useEffect(() => {
    fetchActiveAnnouncement();
    fetchTaskCount();
  }, [dataAsset.fullyQualifiedName]);

  const { extraInfo, breadcrumbs }: DataAssetHeaderInfo = useMemo(() => {
    const returnData: DataAssetHeaderInfo = {
      extraInfo: <></>,
      breadcrumbs: [],
    };
    switch (entityType) {
      default:
      case EntityType.TABLE:
        const tableDetails = dataAsset as Table;

        returnData.extraInfo = (
          <>
            {tableDetails.tableType && (
              <ExtraInfoLabel
                label={t('label.type')}
                value={tableDetails.tableType}
              />
            )}
            {tableDetails?.usageSummary && (
              <ExtraInfoLabel
                label={t('label.usage')}
                value={getUsagePercentile(
                  tableDetails.usageSummary?.weeklyStats?.percentileRank || 0,
                  false
                )}
              />
            )}
            {tableDetails?.profile?.columnCount && (
              <ExtraInfoLabel
                label={t('label.column-plural')}
                value={tableDetails.profile?.columnCount}
              />
            )}
            {tableDetails?.profile?.rowCount && (
              <ExtraInfoLabel
                label={t('label.row-plural')}
                value={tableDetails.profile?.rowCount}
              />
            )}
          </>
        );

        returnData.breadcrumbs = getBreadcrumbForTable(tableDetails);

        break;

      case EntityType.TOPIC:
        const topicDetails = dataAsset as Topic;
        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(topicDetails);
        returnData.extraInfo = (
          <>
            {topicDetails?.partitions && (
              <ExtraInfoLabel
                label={t('label.partition-plural')}
                value={topicDetails.partitions}
              />
            )}
            {topicDetails?.replicationFactor && (
              <ExtraInfoLabel
                label={t('label.replication-factor')}
                value={topicDetails.replicationFactor}
              />
            )}
          </>
        );

        break;

      case EntityType.DASHBOARD:
        const dashboardDetails = dataAsset as Dashboard;

        returnData.extraInfo = (
          <>
            {dashboardDetails.sourceUrl && (
              <ExtraInfoLink
                href={dashboardDetails.sourceUrl}
                label={entityName}
                value={dashboardDetails.sourceUrl}
              />
            )}
            {dashboardDetails.dashboardType && (
              <ExtraInfoLabel
                label={t('label.entity-type-plural', {
                  entity: t('label.dashboard'),
                })}
                value={dashboardDetails.dashboardType}
              />
            )}
            {dashboardDetails.project && (
              <ExtraInfoLabel
                label={t('label.project')}
                value={dashboardDetails.project}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dashboardDetails);

        break;
      case EntityType.PIPELINE:
        const pipelineDetails = dataAsset as Pipeline;

        returnData.extraInfo = (
          <>
            {pipelineDetails.sourceUrl && (
              <ExtraInfoLink
                href={pipelineDetails.sourceUrl}
                label=""
                value={pipelineDetails.sourceUrl}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(pipelineDetails);

        break;
      case EntityType.MLMODEL:
        const mlModelDetail = dataAsset as Mlmodel;

        returnData.extraInfo = (
          <>
            {mlModelDetail.algorithm && (
              <ExtraInfoLabel
                label={t('label.algorithm')}
                value={mlModelDetail.algorithm}
              />
            )}
            {mlModelDetail.target && (
              <ExtraInfoLabel
                label={t('label.target')}
                value={mlModelDetail.target}
              />
            )}
            {mlModelDetail.server && (
              <ExtraInfoLink
                href={mlModelDetail.server}
                label={t('label.server')}
                value={mlModelDetail.server}
              />
            )}
            {mlModelDetail.dashboard && (
              <ExtraInfoLink
                href={getDashboardDetailsPath(
                  mlModelDetail.dashboard?.fullyQualifiedName as string
                )}
                label={t('label.dashboard')}
                value={entityName}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(mlModelDetail);

        break;
      case EntityType.CONTAINER:
        const containerDetails = dataAsset as Container;

        returnData.extraInfo = (
          <>
            {!isUndefined(containerDetails?.dataModel?.isPartitioned) && (
              <ExtraInfoLabel
                label=""
                value={
                  containerDetails?.dataModel?.isPartitioned
                    ? (t('label.partitioned') as string)
                    : (t('label.non-partitioned') as string)
                }
              />
            )}
            {containerDetails.numberOfObjects && (
              <ExtraInfoLabel
                label={t('label.number-of-object-plural')}
                value={containerDetails.numberOfObjects}
              />
            )}
            {containerDetails.size && (
              <ExtraInfoLabel
                label={t('label.size')}
                value={bytesToSize(containerDetails.size)}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(containerDetails);

        break;

      case EntityType.DASHBOARD_DATA_MODEL:
        const dataModelDetails = dataAsset as DashboardDataModel;

        returnData.extraInfo = (
          <>
            {dataModelDetails.dataModelType && (
              <ExtraInfoLabel
                label={t('label.data-model-type')}
                value={dataModelDetails.dataModelType}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataModelDetails);

        break;
    }

    return returnData;
  }, [dataAsset, entityType]);

  const handleOpenTaskClick = () => {
    if (!dataAsset.fullyQualifiedName) {
      return;
    }

    history.push(
      getEntityDetailLink(
        entityType,
        dataAsset.fullyQualifiedName,
        EntityTabs.ACTIVITY_FEED,
        ActivityFeedTabs.TASKS
      )
    );
  };

  const handleShareButtonClick = async () => {
    await onCopyToClipBoard();
    showInfoToast(`Link copied to clipboard`, 2000);
  };

  return (
    <>
      <Row gutter={[8, 12]}>
        {/* Heading Left side */}
        <Col className="self-center" span={18}>
          <Row gutter={[16, 12]}>
            <Col span={24}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Col>
            <Col span={24}>
              <EntityHeaderTitle
                deleted={dataAsset?.deleted}
                displayName={dataAsset.displayName}
                icon={icon}
                name={dataAsset?.name}
                serviceName={dataAsset.service?.name ?? ''}
              />
            </Col>
            <Col span={24}>
              <div className="d-flex no-wrap">
                <OwnerLabel
                  hasPermission={permissions.EditAll || permissions.EditOwner}
                  owner={dataAsset?.owner}
                  onUpdate={onOwnerUpdate}
                />
                <Divider className="self-center m-x-sm" type="vertical" />
                <TierCard currentTier={tier?.tagFQN} updateTier={onTierUpdate}>
                  <Space>
                    {tier ? (
                      <span className="font-medium text-xs" data-testid="Tier">
                        {tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1]}
                      </span>
                    ) : (
                      <span className="font-medium text-xs" data-testid="Tier">
                        {t('label.no-entity', {
                          entity: t('label.tier'),
                        })}
                      </span>
                    )}
                    <Tooltip
                      placement="topRight"
                      title={
                        permissions.EditAll || permissions.EditTags
                          ? ''
                          : NO_PERMISSION_FOR_ACTION
                      }>
                      <Button
                        className="flex-center p-0"
                        data-testid="edit-tier"
                        disabled={
                          !(permissions.EditAll || permissions.EditTags)
                        }
                        icon={<EditIcon width="14px" />}
                        size="small"
                        type="text"
                      />
                    </Tooltip>
                  </Space>
                </TierCard>
                {extraInfo}
              </div>
            </Col>
          </Row>
        </Col>
        {/* Heading Right side */}
        <Col span={6}>
          <Space className="items-end w-full" direction="vertical" size={16}>
            <Space>
              <ButtonGroup size="small">
                <Button
                  className="w-16 p-0"
                  icon={<Icon component={TaskOpenIcon} />}
                  onClick={handleOpenTaskClick}>
                  <Typography.Text>{taskCount}</Typography.Text>
                </Button>
                <Button
                  className="w-16 p-0"
                  icon={<Icon component={VersionIcon} />}
                  onClick={onVersionClick}>
                  <Typography.Text>{version}</Typography.Text>
                </Button>
                <Button
                  className="w-16 p-0"
                  data-testid="entity-follow-button"
                  icon={
                    <Icon component={isFollowing ? StarFilledIcon : StarIcon} />
                  }
                  onClick={onFollowClick}>
                  <Typography.Text>{followers}</Typography.Text>
                </Button>
                <Button
                  icon={<Icon component={ShareIcon} />}
                  onClick={handleShareButtonClick}
                />
                <ManageButton
                  allowSoftDelete={!dataAsset.deleted}
                  canDelete={permissions.Delete}
                  deleted={dataAsset.deleted}
                  displayName={dataAsset.displayName}
                  editDisplayNamePermission={
                    permissions?.EditAll || permissions?.EditDisplayName
                  }
                  entityFQN={dataAsset.fullyQualifiedName}
                  entityId={dataAsset.id}
                  entityName={entityName}
                  entityType={entityType}
                  onAnnouncementClick={
                    permissions?.EditAll
                      ? () => setIsAnnouncementDrawer(true)
                      : undefined
                  }
                  onEditDisplayName={onDisplayNameUpdate}
                  onRestoreEntity={onRestoreDataAsset}
                />
              </ButtonGroup>
            </Space>

            <div>
              {activeAnnouncement && (
                <AnnouncementCard
                  announcement={activeAnnouncement}
                  onClick={() => setIsAnnouncementDrawer(true)}
                />
              )}
            </div>
          </Space>
        </Col>
      </Row>

      {isAnnouncementDrawerOpen && (
        <AnnouncementDrawer
          createPermission={permissions?.EditAll}
          entityFQN={dataAsset.fullyQualifiedName || ''}
          entityName={entityName || ''}
          entityType={entityType}
          open={isAnnouncementDrawerOpen}
          onClose={() => setIsAnnouncementDrawer(false)}
        />
      )}
    </>
  );
};
