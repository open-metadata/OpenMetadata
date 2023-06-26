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
import { Button, Col, Divider, Row, Space, Typography } from 'antd';
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
import { DE_ACTIVE_COLOR, getDashboardDetailsPath } from 'constants/constants';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from 'generated/entity/feed/thread';
import { useClipboard } from 'hooks/useClipBoard';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    if (dataAsset.fullyQualifiedName) {
      fetchActiveAnnouncement();
      fetchTaskCount();
    }
  }, [dataAsset.fullyQualifiedName]);

  const { extraInfo, breadcrumbs }: DataAssetHeaderInfo = useMemo(() => {
    const returnData: DataAssetHeaderInfo = {
      extraInfo: <></>,
      breadcrumbs: [],
    };
    switch (entityType) {
      case EntityType.TOPIC:
        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataAsset);
        returnData.extraInfo = (
          <>
            {Boolean(dataAsset?.partitions) && (
              <ExtraInfoLabel
                label={t('label.partition-plural')}
                value={dataAsset.partitions}
              />
            )}
            {dataAsset?.replicationFactor && (
              <ExtraInfoLabel
                label={t('label.replication-factor')}
                value={dataAsset.replicationFactor}
              />
            )}
          </>
        );

        break;

      case EntityType.DASHBOARD:
        returnData.extraInfo = (
          <>
            {dataAsset.sourceUrl && (
              <ExtraInfoLink
                href={dataAsset.sourceUrl}
                label={entityName}
                value={dataAsset.sourceUrl}
              />
            )}
            {dataAsset.dashboardType && (
              <ExtraInfoLabel
                label={t('label.entity-type-plural', {
                  entity: t('label.dashboard'),
                })}
                value={dataAsset.dashboardType}
              />
            )}
            {dataAsset.project && (
              <ExtraInfoLabel
                label={t('label.project')}
                value={dataAsset.project}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataAsset);

        break;

      case EntityType.PIPELINE:
        returnData.extraInfo = (
          <>
            {dataAsset.sourceUrl && (
              <ExtraInfoLink
                href={dataAsset.sourceUrl}
                label=""
                value={dataAsset.sourceUrl}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataAsset);

        break;
      case EntityType.MLMODEL:
        returnData.extraInfo = (
          <>
            {dataAsset.algorithm && (
              <ExtraInfoLabel
                label={t('label.algorithm')}
                value={dataAsset.algorithm}
              />
            )}
            {dataAsset.target && (
              <ExtraInfoLabel
                label={t('label.target')}
                value={dataAsset.target}
              />
            )}
            {dataAsset.server && (
              <ExtraInfoLink
                href={dataAsset.server}
                label={t('label.server')}
                value={dataAsset.server}
              />
            )}
            {dataAsset.dashboard && (
              <ExtraInfoLink
                href={getDashboardDetailsPath(
                  dataAsset.dashboard?.fullyQualifiedName as string
                )}
                label={t('label.dashboard')}
                value={entityName}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataAsset);

        break;

      case EntityType.CONTAINER:
        returnData.extraInfo = (
          <>
            {!isUndefined(dataAsset?.dataModel?.isPartitioned) && (
              <ExtraInfoLabel
                label=""
                value={
                  dataAsset?.dataModel?.isPartitioned
                    ? t('label.partitioned')
                    : t('label.non-partitioned')
                }
              />
            )}
            {dataAsset.numberOfObjects && (
              <ExtraInfoLabel
                label={t('label.number-of-object-plural')}
                value={dataAsset.numberOfObjects}
              />
            )}
            {dataAsset.size && (
              <ExtraInfoLabel
                label={t('label.size')}
                value={bytesToSize(dataAsset.size)}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataAsset);

        break;

      case EntityType.DASHBOARD_DATA_MODEL:
        returnData.extraInfo = (
          <>
            {dataAsset.dataModelType && (
              <ExtraInfoLabel
                label={t('label.data-model-type')}
                value={dataAsset.dataModelType}
              />
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dataAsset);

        break;

      case EntityType.TABLE:
      default:
        returnData.extraInfo = (
          <>
            {dataAsset.tableType && (
              <ExtraInfoLabel
                label={t('label.type')}
                value={dataAsset.tableType}
              />
            )}
            {dataAsset?.usageSummary && (
              <ExtraInfoLabel
                label={t('label.usage')}
                value={getUsagePercentile(
                  dataAsset.usageSummary?.weeklyStats?.percentileRank ?? 0,
                  false
                )}
              />
            )}
            {dataAsset?.profile?.columnCount && (
              <ExtraInfoLabel
                label={t('label.column-plural')}
                value={dataAsset.profile?.columnCount}
              />
            )}
            {dataAsset?.profile?.rowCount && (
              <ExtraInfoLabel
                label={t('label.row-plural')}
                value={dataAsset.profile?.rowCount}
              />
            )}
          </>
        );

        returnData.breadcrumbs = getBreadcrumbForTable(dataAsset);

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

                    {(permissions.EditAll || permissions.EditTags) && (
                      <Button
                        className="flex-center p-0"
                        data-testid="edit-tier"
                        disabled={
                          !(permissions.EditAll || permissions.EditTags)
                        }
                        icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                        size="small"
                        type="text"
                      />
                    )}
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
          entityFQN={dataAsset.fullyQualifiedName ?? ''}
          entityName={entityName ?? ''}
          entityType={entityType}
          open={isAnnouncementDrawerOpen}
          onClose={() => setIsAnnouncementDrawer(false)}
        />
      )}
    </>
  );
};
