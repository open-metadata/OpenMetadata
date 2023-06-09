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
import { Button, Divider, Row, Space, Typography } from 'antd';
import Col from 'antd/es/grid/col';
import Tooltip from 'antd/es/tooltip';
import ButtonGroup from 'antd/lib/button/button-group';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-link.svg';
import { ReactComponent as StarFilledIcon } from 'assets/svg/ic-star-filled.svg';
import { ReactComponent as StarIcon } from 'assets/svg/ic-star.svg';
import { ReactComponent as VersionIcon } from 'assets/svg/ic-version.svg';
import { AxiosError } from 'axios';
import AnnouncementCard from 'components/common/entityPageInfo/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from 'components/common/entityPageInfo/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import TierCard from 'components/common/TierCard/TierCard';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import EntityHeaderTitle from 'components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { EntityType } from 'enums/entity.enum';
import { Dashboard } from 'generated/entity/data/dashboard';
import { Table } from 'generated/entity/data/table';
import { Topic } from 'generated/entity/data/topic';
import { Thread } from 'generated/entity/feed/thread';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { getActiveAnnouncement } from 'rest/feedsAPI';
import { getCurrentUserId } from 'utils/CommonUtils';
import {
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForTable,
  getEntityFeedLink,
  getEntityName,
} from 'utils/EntityUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { bytesToSize } from 'utils/StringsUtils';
import { getTierTags, getUsagePercentile } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
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
      <span>{label}</span> <span className="font-medium">{value}</span>
    </Typography.Text>
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
  const icon = useMemo(
    () =>
      dataAsset?.serviceType ? (
        <img className="h-9" src={serviceTypeLogo(dataAsset.serviceType)} />
      ) : null,
    [dataAsset]
  );

  const { entityName, tier, isFollowing } = useMemo(
    () => ({
      isFollowing: dataAsset.followers?.some(({ id }) => id === USERId),
      tier: getTierTags(dataAsset.tags ?? []),
      entityName: getEntityName(dataAsset),
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

  useEffect(() => {
    fetchActiveAnnouncement();
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
                  true
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
            {topicDetails?.retentionSize && (
              <ExtraInfoLabel
                label={t('label.retention-size')}
                value={bytesToSize(topicDetails.retentionSize ?? 0)}
              />
            )}
            {topicDetails?.cleanupPolicies && (
              <ExtraInfoLabel
                label={t('label.clean-up-policy-plural-lowercase')}
                value={topicDetails.cleanupPolicies?.join(', ')}
              />
            )}
            {topicDetails?.maximumMessageSize && (
              <ExtraInfoLabel
                label={t('label.maximum-size-lowercase')}
                value={bytesToSize(topicDetails.maximumMessageSize ?? 0)}
              />
            )}
          </>
        );

        break;

      case EntityType.DASHBOARD:
        const dashboardDetails = dataAsset as Dashboard;

        returnData.extraInfo = (
          <>
            {dashboardDetails.dashboardUrl && (
              <>
                <Divider className="self-center m-x-sm" type="vertical" />
                <Typography.Link
                  className="d-flex items-center"
                  href={dashboardDetails.dashboardUrl}>
                  {entityName}{' '}
                  <IconExternalLink className="m-l-xss " width={14} />
                </Typography.Link>
              </>
            )}
          </>
        );

        returnData.breadcrumbs =
          getBreadcrumbForEntitiesWithServiceOnly(dashboardDetails);

        break;
      case EntityType.PIPELINE:
        break;
      case EntityType.MLMODEL:
        break;
      case EntityType.CONTAINER:
        break;
    }

    return returnData;
  }, [dataAsset, entityType]);

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
                <Divider className="self-center m-x-md" type="vertical" />
                <TierCard currentTier={tier?.tagFQN} updateTier={onTierUpdate}>
                  <Space>
                    {tier ? (
                      tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
                    ) : (
                      <span className="font-medium">
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
                        data-testid="edit-owner"
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
            <ButtonGroup size="small">
              <Button
                icon={<Icon component={VersionIcon} />}
                onClick={onVersionClick}
              />
              <Button
                icon={
                  <Icon component={isFollowing ? StarFilledIcon : StarIcon} />
                }
                onClick={onFollowClick}
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
                entityType={EntityType.TABLE}
                onAnnouncementClick={
                  permissions?.EditAll
                    ? () => setIsAnnouncementDrawer(true)
                    : undefined
                }
                onEditDisplayName={onDisplayNameUpdate}
                onRestoreEntity={onRestoreDataAsset}
              />
            </ButtonGroup>
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
