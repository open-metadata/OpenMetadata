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
import { AxiosError } from 'axios';
import { capitalize, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as ShareIcon } from '../../../assets/svg/ic-share.svg';
import { ReactComponent as StarFilledIcon } from '../../../assets/svg/ic-star-filled.svg';
import { ReactComponent as StarIcon } from '../../../assets/svg/ic-star.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { DomainLabel } from '../../../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TierCard from '../../../components/common/TierCard/TierCard';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { SERVICE_TYPES } from '../../../constants/Services.constant';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { Table } from '../../../generated/entity/data/table';
import { Thread } from '../../../generated/entity/feed/thread';
import { useClipboard } from '../../../hooks/useClipBoard';
import { SearchSourceAlias } from '../../../interface/search.interface';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { getContainerByName } from '../../../rest/storageAPI';
import { getEntityDetailLink } from '../../../utils/CommonUtils';
import { getDataAssetsHeaderInfo } from '../../../utils/DataAssetsHeader.utils';
import {
  getEntityFeedLink,
  getEntityName,
  getEntityVoteStatus,
} from '../../../utils/EntityUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getTierTags } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import AnnouncementCard from '../../common/EntityPageInfos/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import RetentionPeriod from '../../Database/RetentionPeriod/RetentionPeriod.component';
import Voting from '../../Entity/Voting/Voting.component';
import { VotingDataProps } from '../../Entity/Voting/voting.interface';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
  DataAssetsType,
  DataAssetsWithFollowersField,
  DataAssetsWithServiceField,
  EntitiesWithDomainField,
} from './DataAssetsHeader.interface';

export const ExtraInfoLabel = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <>
    <Divider className="self-center" type="vertical" />
    <Typography.Text className="self-center text-xs whitespace-nowrap">
      {!isEmpty(label) && (
        <span className="text-grey-muted">{`${label}: `}</span>
      )}
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
    <Divider className="self-center" type="vertical" />
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
  allowSoftDelete = true,
  showDomain = true,
  afterDeleteAction,
  dataAsset,
  onUpdateVote,
  onOwnerUpdate,
  onTierUpdate,
  permissions,
  onVersionClick,
  onFollowClick,
  entityType,
  openTaskCount,
  isRecursiveDelete,
  onRestoreDataAsset,
  onDisplayNameUpdate,
  afterDomainUpdateAction,
  onProfilerSettingUpdate,
  onUpdateRetentionPeriod,
}: DataAssetsHeaderProps) => {
  const { currentUser } = useAuthContext();
  const USER_ID = currentUser?.id ?? '';
  const { t } = useTranslation();
  const { isTourPage } = useTourProvider();
  const { onCopyToClipBoard } = useClipboard(window.location.href);
  const [parentContainers, setParentContainers] = useState<Container[]>([]);
  const [isBreadcrumbLoading, setIsBreadcrumbLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const history = useHistory();
  const icon = useMemo(
    () =>
      dataAsset?.serviceType ? (
        <img
          className="h-9"
          src={serviceUtilClassBase.getServiceTypeLogo(
            dataAsset as SearchSourceAlias
          )}
        />
      ) : null,
    [dataAsset]
  );
  const [copyTooltip, setCopyTooltip] = useState<string>();

  const excludeEntityService = useMemo(
    () =>
      [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        ...SERVICE_TYPES,
      ].includes(entityType),
    [entityType]
  );

  const hasFollowers = 'followers' in dataAsset;

  const { entityName, tier, isFollowing, version, followers, votes, deleted } =
    useMemo(
      () => ({
        isFollowing: hasFollowers
          ? (dataAsset as DataAssetsWithFollowersField).followers?.some(
              ({ id }) => id === USER_ID
            )
          : false,
        followers: hasFollowers
          ? (dataAsset as DataAssetsWithFollowersField).followers?.length
          : 0,

        tier: getTierTags(dataAsset.tags ?? []),
        entityName: getEntityName(dataAsset),
        version: dataAsset.version,
        deleted: dataAsset.deleted,
        votes: (dataAsset as DataAssetsWithFollowersField).votes,
      }),
      [dataAsset, USER_ID]
    );

  const voteStatus = useMemo(
    () => getEntityVoteStatus(USER_ID, votes),
    [votes, USER_ID]
  );

  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawerOpen] =
    useState<boolean>(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Thread>();

  const fetchActiveAnnouncement = async () => {
    try {
      const announcements = await getActiveAnnouncement(
        getEntityFeedLink(entityType, dataAsset.fullyQualifiedName ?? '')
      );

      if (!isEmpty(announcements.data)) {
        setActiveAnnouncement(announcements.data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchContainerParent = async (
    parentName: string,
    parents = [] as Container[]
  ) => {
    if (isEmpty(parentName)) {
      return;
    }
    setIsBreadcrumbLoading(true);
    try {
      const response = await getContainerByName(parentName, {
        fields: 'parent',
      });
      const updatedParent = [response, ...parents];
      if (response?.parent?.fullyQualifiedName) {
        await fetchContainerParent(
          response.parent.fullyQualifiedName,
          updatedParent
        );
      } else {
        setParentContainers(updatedParent);
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    } finally {
      setIsBreadcrumbLoading(false);
    }
  };

  useEffect(() => {
    if (dataAsset.fullyQualifiedName && !isTourPage) {
      fetchActiveAnnouncement();
    }
    if (entityType === EntityType.CONTAINER) {
      const asset = dataAsset as Container;
      fetchContainerParent(asset.parent?.fullyQualifiedName ?? '');
    }
  }, [dataAsset.fullyQualifiedName, isTourPage]);

  const { extraInfo, breadcrumbs }: DataAssetHeaderInfo = useMemo(
    () =>
      getDataAssetsHeaderInfo(
        entityType,
        dataAsset,
        entityName,
        parentContainers
      ),
    [entityType, dataAsset, entityName, parentContainers]
  );

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
    setCopyTooltip(t('message.link-copy-to-clipboard'));
    setTimeout(() => setCopyTooltip(''), 2000);
  };

  const isDataAssetsWithServiceField = useCallback(
    (asset: DataAssetsType): asset is DataAssetsWithServiceField => {
      return (asset as DataAssetsWithServiceField).service !== undefined;
    },
    []
  );

  const dataAssetServiceName = useMemo(() => {
    if (isDataAssetsWithServiceField(dataAsset)) {
      return dataAsset.service?.name ?? '';
    } else {
      return 'service';
    }
  }, [isDataAssetsWithServiceField, dataAsset]);

  const handleVoteChange = async (data: VotingDataProps) => {
    await onUpdateVote?.(data, dataAsset.id ?? '');
  };

  const handleOpenAnnouncementDrawer = useCallback(
    () => setIsAnnouncementDrawerOpen(true),
    []
  );

  const handleCloseAnnouncementDrawer = useCallback(
    () => setIsAnnouncementDrawerOpen(false),
    []
  );
  const handleFollowingClick = useCallback(async () => {
    setIsFollowingLoading(true);
    await onFollowClick?.();
    setIsFollowingLoading(false);
  }, [onFollowClick]);

  const { editDomainPermission, editOwnerPermission, editTierPermission } =
    useMemo(
      () => ({
        editDomainPermission: permissions.EditAll && !dataAsset.deleted,
        editOwnerPermission:
          (permissions.EditAll || permissions.EditOwner) && !dataAsset.deleted,
        editTierPermission:
          (permissions.EditAll || permissions.EditTags) && !dataAsset.deleted,
      }),
      [permissions, dataAsset]
    );

  return (
    <>
      <Row gutter={[8, 12]}>
        {/* Heading Left side */}
        <Col className="self-center" span={17}>
          <Row gutter={[16, 12]}>
            <Col span={24}>
              <TitleBreadcrumb
                loading={isBreadcrumbLoading}
                titleLinks={breadcrumbs}
              />
            </Col>
            <Col span={24}>
              <EntityHeaderTitle
                deleted={dataAsset?.deleted}
                displayName={dataAsset.displayName}
                icon={icon}
                name={dataAsset?.name}
                serviceName={dataAssetServiceName}
              />
            </Col>
            <Col span={24}>
              <div className="d-flex flex-wrap gap-2">
                {showDomain && (
                  <>
                    <DomainLabel
                      afterDomainUpdateAction={afterDomainUpdateAction}
                      domain={(dataAsset as EntitiesWithDomainField).domain}
                      entityFqn={dataAsset.fullyQualifiedName ?? ''}
                      entityId={dataAsset.id ?? ''}
                      entityType={entityType}
                      hasPermission={editDomainPermission}
                    />
                    <Divider className="self-center" type="vertical" />
                  </>
                )}
                <OwnerLabel
                  hasPermission={editOwnerPermission}
                  owner={dataAsset?.owner}
                  onUpdate={onOwnerUpdate}
                />
                <Divider className="self-center" type="vertical" />
                <TierCard currentTier={tier?.tagFQN} updateTier={onTierUpdate}>
                  <Space data-testid="header-tier-container">
                    {tier ? (
                      <span className="font-medium text-xs" data-testid="Tier">
                        {getEntityName(tier)}
                      </span>
                    ) : (
                      <span className="font-medium text-xs" data-testid="Tier">
                        {t('label.no-entity', {
                          entity: t('label.tier'),
                        })}
                      </span>
                    )}

                    {editTierPermission && (
                      <Tooltip
                        title={t('label.edit-entity', {
                          entity: t('label.tier'),
                        })}>
                        <Button
                          className="flex-center p-0"
                          data-testid="edit-tier"
                          icon={
                            <EditIcon color={DE_ACTIVE_COLOR} width="14px" />
                          }
                          size="small"
                          type="text"
                        />
                      </Tooltip>
                    )}
                  </Space>
                </TierCard>

                {entityType === EntityType.TABLE && onUpdateRetentionPeriod && (
                  <RetentionPeriod
                    permissions={permissions}
                    retentionPeriod={(dataAsset as Table).retentionPeriod}
                    onUpdate={onUpdateRetentionPeriod}
                  />
                )}

                {extraInfo}
              </div>
            </Col>
          </Row>
        </Col>
        {/* Heading Right side */}
        <Col span={7}>
          <Space className="items-end w-full" direction="vertical" size={16}>
            <Space>
              <ButtonGroup data-testid="asset-header-btn-group" size="small">
                {onUpdateVote && (
                  <Voting
                    disabled={deleted}
                    voteStatus={voteStatus}
                    votes={votes}
                    onUpdateVote={handleVoteChange}
                  />
                )}
                {!excludeEntityService && (
                  <Tooltip title={t('label.open-task-plural')}>
                    <Button
                      className="w-16 p-0"
                      icon={<Icon component={TaskOpenIcon} />}
                      onClick={handleOpenTaskClick}>
                      <Typography.Text>{openTaskCount}</Typography.Text>
                    </Button>
                  </Tooltip>
                )}

                <Tooltip title={t('label.version-plural-history')}>
                  <Button
                    className="w-16 p-0"
                    data-testid="version-button"
                    icon={<Icon component={VersionIcon} />}
                    onClick={onVersionClick}>
                    <Typography.Text>{version}</Typography.Text>
                  </Button>
                </Tooltip>

                {!excludeEntityService && (
                  <Tooltip
                    title={t('label.field-entity', {
                      field: t(`label.${isFollowing ? 'un-follow' : 'follow'}`),
                      entity: capitalize(entityType),
                    })}>
                    <Button
                      className="w-16 p-0"
                      data-testid="entity-follow-button"
                      disabled={deleted}
                      icon={
                        <Icon
                          component={isFollowing ? StarFilledIcon : StarIcon}
                        />
                      }
                      loading={isFollowingLoading}
                      onClick={handleFollowingClick}>
                      <Typography.Text>{followers}</Typography.Text>
                    </Button>
                  </Tooltip>
                )}

                <Tooltip
                  placement="topRight"
                  title={copyTooltip ?? t('message.copy-to-clipboard')}>
                  <Button
                    icon={<Icon component={ShareIcon} />}
                    onClick={handleShareButtonClick}
                  />
                </Tooltip>
                <ManageButton
                  afterDeleteAction={afterDeleteAction}
                  allowSoftDelete={!dataAsset.deleted && allowSoftDelete}
                  canDelete={permissions.Delete}
                  deleted={dataAsset.deleted}
                  displayName={getEntityName(dataAsset)}
                  editDisplayNamePermission={
                    permissions?.EditAll || permissions?.EditDisplayName
                  }
                  entityFQN={dataAsset.fullyQualifiedName}
                  entityId={dataAsset.id}
                  entityName={dataAsset.name}
                  entityType={entityType}
                  isRecursiveDelete={isRecursiveDelete}
                  onAnnouncementClick={
                    permissions?.EditAll
                      ? handleOpenAnnouncementDrawer
                      : undefined
                  }
                  onEditDisplayName={onDisplayNameUpdate}
                  onProfilerSettingUpdate={onProfilerSettingUpdate}
                  onRestoreEntity={onRestoreDataAsset}
                />
              </ButtonGroup>
            </Space>

            <div>
              {activeAnnouncement && (
                <AnnouncementCard
                  announcement={activeAnnouncement}
                  onClick={handleOpenAnnouncementDrawer}
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
          entityType={entityType}
          open={isAnnouncementDrawerOpen}
          onClose={handleCloseAnnouncementDrawer}
        />
      )}
    </>
  );
};
