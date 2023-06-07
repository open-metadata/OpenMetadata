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
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { EntityType } from 'enums/entity.enum';
import { Table, TableProfile, UsageDetails } from 'generated/entity/data/table';
import { Thread } from 'generated/entity/feed/thread';
import { EntityReference } from 'generated/entity/type';
import { TagLabel } from 'generated/type/tagLabel';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { getActiveAnnouncement } from 'rest/feedsAPI';
import { getCurrentUserId } from 'utils/CommonUtils';
import {
  getBreadcrumbForTable,
  getEntityFeedLink,
  getEntityName,
} from 'utils/EntityUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { getTierTags, getUsagePercentile } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';

export const DataAssetsHeader = ({
  dataAsset,
  onOwnerUpdate,
  onTierUpdate,
  permissions,
  onVersionClick,
  onFollowClick,
  onRestoreDataAsset,
  onDisplayNameUpdate,
}: {
  dataAsset: {
    id: string;
    fullyQualifiedName?: string;
    name: string;
    displayName?: string;
    deleted?: boolean;
    service?: EntityReference;
    serviceType?: string;
    owner?: EntityReference;
    tags?: TagLabel[];
    profile?: TableProfile;
    followers?: EntityReference[];
    tableType?: string;
    usageSummary?: UsageDetails;
  };
  permissions: OperationPermission;
  onTierUpdate: (tier?: string) => Promise<void>;
  onOwnerUpdate: (owner?: EntityReference) => Promise<void>;
  onVersionClick: () => void;
  onFollowClick: () => Promise<void>;
  onRestoreDataAsset: () => Promise<void>;
  onDisplayNameUpdate: (data: EntityName) => Promise<void>;
}) => {
  const USERId = getCurrentUserId();
  const icon = useMemo(
    () =>
      dataAsset?.serviceType ? (
        <img className="h-9" src={serviceTypeLogo(dataAsset.serviceType)} />
      ) : null,
    [dataAsset]
  );

  const { usageSummary, entityName, tier, isFollowing } = useMemo(
    () => ({
      usageSummary: getUsagePercentile(
        dataAsset.usageSummary?.weeklyStats?.percentileRank || 0,
        true
      ),
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
        getEntityFeedLink(EntityType.TABLE, dataAsset.fullyQualifiedName)
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

  return (
    <>
      <Row gutter={[8, 12]}>
        {/* Heading Left side */}
        <Col className="self-center" span={18}>
          <Row gutter={[16, 12]}>
            <Col span={24}>
              <TitleBreadcrumb
                titleLinks={getBreadcrumbForTable(
                  dataAsset as unknown as Table
                )}
              />
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

                {dataAsset.tableType && (
                  <>
                    <Divider className="self-center m-x-md" type="vertical" />
                    <Typography.Text className="self-center">
                      {t('label.type')}{' '}
                      <span className="font-medium">{dataAsset.tableType}</span>
                    </Typography.Text>{' '}
                  </>
                )}
                {dataAsset?.profile?.profileSample && (
                  <>
                    <Divider className="self-center m-x-md" type="vertical" />
                    <Typography.Text className="self-center">
                      {t('label.usage')}{' '}
                      <span className="font-medium">
                        {usageSummary}
                        {t('label.pctile-lowercase')}
                      </span>
                    </Typography.Text>
                  </>
                )}
                {dataAsset?.profile?.columnCount && (
                  <>
                    <Divider className="self-center m-x-md" type="vertical" />
                    <Typography.Text className="self-center">
                      {t('label.column-plural')}{' '}
                      <span className="font-medium">
                        {dataAsset?.profile?.columnCount}
                      </span>
                    </Typography.Text>
                  </>
                )}
                {dataAsset?.profile?.rowCount && (
                  <>
                    <Divider className="self-center m-x-md" type="vertical" />
                    <Typography.Text className="self-center">
                      {t('label.row-plural')}{' '}
                      <span className="font-medium">
                        {dataAsset?.profile?.rowCount}
                      </span>
                    </Typography.Text>
                  </>
                )}
              </div>
            </Col>
          </Row>
        </Col>
        {/* Heading Right side */}
        <Col className="text-right" span={6}>
          <div className="text-right">
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
          </div>
        </Col>
      </Row>

      {isAnnouncementDrawerOpen && (
        <AnnouncementDrawer
          createPermission={permissions?.EditAll}
          entityFQN={dataAsset.fullyQualifiedName || ''}
          entityName={entityName || ''}
          entityType={EntityType.TABLE || ''}
          open={isAnnouncementDrawerOpen}
          onClose={() => setIsAnnouncementDrawer(false)}
        />
      )}
    </>
  );
};
