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
import classNames from 'classnames';
import { capitalize, get, isEmpty } from 'lodash';
import QueryString from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ReactComponent as RedAlertIcon } from '../../../assets/svg/ic-alert-red.svg';
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
import {
  DATA_ASSET_ICON_DIMENSION,
  DE_ACTIVE_COLOR,
  getEntityDetailsPath,
} from '../../../constants/constants';
import { SERVICE_TYPES } from '../../../constants/Services.constant';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../../enums/entity.enum';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import { Container } from '../../../generated/entity/data/container';
import { Metric } from '../../../generated/entity/data/metric';
import { Table } from '../../../generated/entity/data/table';
import { Thread } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useClipboard } from '../../../hooks/useClipBoard';
import { SearchSourceAlias } from '../../../interface/search.interface';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { getDataQualityLineage } from '../../../rest/lineageAPI';
import { getContainerByName } from '../../../rest/storageAPI';
import {
  getDataAssetsHeaderInfo,
  isDataAssetsWithServiceField,
} from '../../../utils/DataAssetsHeader.utils';
import EntityLink from '../../../utils/EntityLink';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  getEntityFeedLink,
  getEntityName,
  getEntityVoteStatus,
} from '../../../utils/EntityUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import tableClassBase from '../../../utils/TableClassBase';
import { getTierTags } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AnnouncementCard from '../../common/EntityPageInfos/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import RetentionPeriod from '../../Database/RetentionPeriod/RetentionPeriod.component';
import Voting from '../../Entity/Voting/Voting.component';
import { VotingDataProps } from '../../Entity/Voting/voting.interface';
import MetricHeaderInfo from '../../Metric/MetricHeaderInfo/MetricHeaderInfo';
import SuggestionsAlert from '../../Suggestions/SuggestionsAlert/SuggestionsAlert';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import './data-asset-header.less';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
  DataAssetsWithFollowersField,
  EntitiesWithDomainField,
} from './DataAssetsHeader.interface';

export const ExtraInfoLabel = ({
  label,
  value,
  dataTestId,
}: {
  label: string;
  value: string | number;
  dataTestId?: string;
}) => (
  <>
    <Divider className="self-center" type="vertical" />
    <Typography.Text
      className="self-center text-xs whitespace-nowrap"
      data-testid={dataTestId}>
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
  newTab = false,
  ellipsis = false,
}: {
  label: string;
  value: string | number;
  href: string;
  newTab?: boolean;
  ellipsis?: boolean;
}) => (
  <>
    <Divider className="self-center" type="vertical" />
    <div
      className={classNames('d-flex items-center text-xs', {
        'w-48': ellipsis,
      })}>
      {!isEmpty(label) && (
        <span className="text-grey-muted m-r-xss">{`${label}: `}</span>
      )}
      <Typography.Link
        ellipsis
        href={href}
        rel={newTab ? 'noopener noreferrer' : undefined}
        style={{ fontSize: '12px' }}
        target={newTab ? '_blank' : undefined}>
        {value}{' '}
      </Typography.Link>
      <Icon
        className="m-l-xs"
        component={IconExternalLink}
        style={DATA_ASSET_ICON_DIMENSION}
      />
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
  extraDropdownContent,
  onMetricUpdate,
  badge,
  isDqAlertSupported,
  isCustomizedView = false,
}: DataAssetsHeaderProps) => {
  const { currentUser } = useApplicationStore();
  const { selectedUserSuggestions } = useSuggestionsContext();
  const USER_ID = currentUser?.id ?? '';
  const { t } = useTranslation();
  const { isTourPage } = useTourProvider();
  const { onCopyToClipBoard } = useClipboard(window.location.href);
  const [parentContainers, setParentContainers] = useState<Container[]>([]);
  const [isBreadcrumbLoading, setIsBreadcrumbLoading] = useState(false);
  const [dqFailureCount, setDqFailureCount] = useState(0);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const history = useHistory();
  const icon = useMemo(() => {
    const serviceType = get(dataAsset, 'serviceType', '');

    return serviceType ? (
      <img
        className="h-9"
        src={serviceUtilClassBase.getServiceTypeLogo(
          dataAsset as SearchSourceAlias
        )}
      />
    ) : null;
  }, [dataAsset]);
  const [copyTooltip, setCopyTooltip] = useState<string>();

  const excludeEntityService = useMemo(
    () =>
      [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.API_COLLECTION,
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

  const fetchDQFailureCount = async () => {
    if (!tableClassBase.getAlertEnableStatus() && !isDqAlertSupported) {
      setDqFailureCount(0);

      return;
    }

    // Todo: Remove this once we have support for count in API
    try {
      const data = await getDataQualityLineage(
        dataAsset.fullyQualifiedName ?? '',
        {
          upstreamDepth: 1,
        }
      );

      const updatedNodes =
        data.nodes?.filter(
          (node) => node?.fullyQualifiedName !== dataAsset?.fullyQualifiedName
        ) ?? [];
      setDqFailureCount(updatedNodes.length);
    } catch (error) {
      setDqFailureCount(0);
    }
  };

  const alertBadge = useMemo(() => {
    return tableClassBase.getAlertEnableStatus() &&
      dqFailureCount > 0 &&
      isDqAlertSupported ? (
      <Space size={8}>
        {badge}
        <Tooltip placement="right" title={t('label.check-upstream-failure')}>
          <Link
            to={{
              pathname: getEntityDetailsPath(
                entityType,
                dataAsset?.fullyQualifiedName ?? '',
                EntityTabs.LINEAGE
              ),

              search: QueryString.stringify({
                layers: [LineageLayer.DataObservability],
              }),
            }}>
            <RedAlertIcon className="text-red-3" height={24} width={24} />
          </Link>
        </Tooltip>
      </Space>
    ) : (
      badge
    );
  }, [dqFailureCount, dataAsset?.fullyQualifiedName, entityType, badge]);

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
        fields: TabSpecificField.PARENT,
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
    if (dataAsset.fullyQualifiedName && !isTourPage && !isCustomizedView) {
      fetchActiveAnnouncement();
      fetchDQFailureCount();
    }
    if (entityType === EntityType.CONTAINER) {
      const asset = dataAsset as Container;
      fetchContainerParent(asset.parent?.fullyQualifiedName ?? '');
    }
  }, [dataAsset.fullyQualifiedName, isTourPage, isCustomizedView]);

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
      entityUtilClassBase.getEntityLink(
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
          (permissions.EditAll || permissions.EditOwners) && !dataAsset.deleted,
        editTierPermission:
          (permissions.EditAll || permissions.EditTier) && !dataAsset.deleted,
      }),
      [permissions, dataAsset]
    );

  const tierSuggestionRender = useMemo(() => {
    if (entityType === EntityType.TABLE) {
      const entityLink = EntityLink.getTableEntityLink(
        dataAsset.fullyQualifiedName ?? ''
      );

      const activeSuggestion = selectedUserSuggestions?.tags.find(
        (suggestion) =>
          suggestion.entityLink === entityLink &&
          getTierTags(suggestion.tagLabels ?? [])
      );

      if (activeSuggestion) {
        return (
          <div className="w-auto" data-testid="tier-suggestion-container">
            <SuggestionsAlert
              showInlineCard
              hasEditAccess={editTierPermission}
              showSuggestedBy={false}
              suggestion={activeSuggestion}
            />
          </div>
        );
      }
    }

    return null;
  }, [
    entityType,
    dataAsset.fullyQualifiedName,
    editTierPermission,
    selectedUserSuggestions,
  ]);

  return (
    <>
      <Row data-testid="data-assets-header" gutter={[8, 12]}>
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
                badge={alertBadge}
                certification={(dataAsset as Table)?.certification}
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
                  owners={dataAsset?.owners}
                  onUpdate={onOwnerUpdate}
                />
                <Divider className="self-center" type="vertical" />
                {tierSuggestionRender ?? (
                  <TierCard
                    currentTier={tier?.tagFQN}
                    updateTier={onTierUpdate}>
                    <Space data-testid="header-tier-container">
                      {tier ? (
                        <TagsV1
                          startWith={TAG_START_WITH.SOURCE_ICON}
                          tag={tier}
                          tagProps={{
                            'data-testid': 'Tier',
                          }}
                        />
                      ) : (
                        <span
                          className="font-medium text-xs"
                          data-testid="Tier">
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
                )}

                {entityType === EntityType.TABLE && onUpdateRetentionPeriod && (
                  <RetentionPeriod
                    hasPermission={permissions.EditAll && !dataAsset.deleted}
                    retentionPeriod={(dataAsset as Table).retentionPeriod}
                    onUpdate={onUpdateRetentionPeriod}
                  />
                )}

                {entityType === EntityType.METRIC && onMetricUpdate && (
                  <MetricHeaderInfo
                    metricDetails={dataAsset as Metric}
                    metricPermissions={permissions}
                    onUpdateMetricDetails={onMetricUpdate}
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
              <ButtonGroup
                className="data-asset-button-group"
                data-testid="asset-header-btn-group"
                size="small">
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
                  isAsyncDelete
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
                  extraDropdownContent={extraDropdownContent}
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
