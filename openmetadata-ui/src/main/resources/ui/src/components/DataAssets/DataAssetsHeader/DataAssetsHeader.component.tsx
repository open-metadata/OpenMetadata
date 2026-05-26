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
import { Alert } from '@openmetadata/ui-core-components';
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { get, isEmpty, isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as CopyIcon } from '../../../assets/svg/copy-right.svg';
import { ReactComponent as RedAlertIcon } from '../../../assets/svg/ic-alert-red.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as StarFilledIcon } from '../../../assets/svg/ic-star-filled.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as LinkIcon } from '../../../assets/svg/link-icon-with-bg.svg';
import { ReactComponent as ThumbsUpOutline } from '../../../assets/svg/thumbs-up-outline.svg';
import { ReactComponent as TriggerIcon } from '../../../assets/svg/trigger.svg';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { DomainLabel } from '../../../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TierCard from '../../../components/common/TierCard/TierCard';
import { AUTO_PILOT_APP_NAME } from '../../../constants/Applications.constant';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  SERVICE_TYPES,
} from '../../../constants/Services.constant';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { Table } from '../../../generated/entity/data/table';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useDataAccessRequest } from '../../../hooks/useDataAccessRequest';
import { useEntityRules } from '../../../hooks/useEntityRules';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
} from '../../../rest/announcementsAPI';
import { triggerOnDemandApp } from '../../../rest/applicationAPI';
import { getDataQualityLineage } from '../../../rest/lineageAPI';
import { getContainerAncestors } from '../../../rest/storageAPI';
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
import { getPrioritizedEditPermission } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServiceUtils';
import tableClassBase from '../../../utils/TableClassBase';
import { getTierTags } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Certification from '../../Certification/Certification.component';
import CertificationTag from '../../common/CertificationTag/CertificationTag';
import AnnouncementCard from '../../common/EntityPageInfos/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import RetentionPeriod from '../../Database/RetentionPeriod/RetentionPeriod.component';
import { QueryVoteType } from '../../Database/TableQueries/TableQueries.interface';
import { EntityStatusBadge } from '../../Entity/EntityStatusBadge/EntityStatusBadge.component';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
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
import MetadataChip from './MetadataChip/MetadataChip.component';
import QuietStat from './QuietStat/QuietStat.component';

export const DataAssetsHeader = ({
  allowSoftDelete = true,
  allowRename = false,
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
  isDqAlertSupported = false,
  isCustomizedView = false,
  disableRunAgentsButton = true,
  afterTriggerAction,
  isAutoPilotWorkflowStatusLoading = false,
  onCertificationUpdate,
  disableRunAgentsButtonMessage,
}: DataAssetsHeaderProps) => {
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { currentUser } = useApplicationStore();
  const { selectedUserSuggestions } = useSuggestionsContext();
  const USER_ID = currentUser?.id ?? '';
  const { t } = useTranslation();
  const { isTourPage } = useTourProvider();
  const [parentContainers, setParentContainers] = useState<EntityReference[]>(
    []
  );
  const [isBreadcrumbLoading, setIsBreadcrumbLoading] = useState(false);
  const [dqFailureCount, setDqFailureCount] = useState(0);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const navigate = useNavigate();
  const [isAutoPilotTriggering, setIsAutoPilotTriggering] = useState(false);
  const { entityRules } = useEntityRules(entityType);
  const [isRequestDataAccessOpen, setIsRequestDataAccessOpen] = useState(false);
  const [voteLoading, setVoteLoading] = useState<QueryVoteType | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<string>('');
  const { onCopyToClipBoard } = useClipboard(
    dataAsset.fullyQualifiedName ?? globalThis.location.href
  );
  const { isDarAwaitingGrant, refetch: refetchExistingDar } =
    useDataAccessRequest({
      entityFqn: dataAsset.fullyQualifiedName,
      enabled: entityType === EntityType.TABLE,
    });

  const handleCopyFqn = useCallback(async () => {
    await onCopyToClipBoard();
    setCopyTooltip(t('message.link-copy-to-clipboard'));
    setTimeout(() => setCopyTooltip(''), 2000);
  }, [onCopyToClipBoard, t]);

  const icon = useMemo(() => {
    const serviceType = get(dataAsset, 'serviceType', '');

    return serviceType ? (
      <img
        alt={get(dataAsset, 'service.displayName', '')}
        className="header-icon"
        src={serviceUtilClassBase.getServiceTypeLogo({
          ...dataAsset,
          entityType,
        })}
      />
    ) : null;
  }, [dataAsset, entityType]);

  const excludeEntityService = useMemo(() => {
    const filteredServiceTypes = SERVICE_TYPES.filter(
      (type) => type !== EntityType.DATABASE_SERVICE
    );

    return [EntityType.API_COLLECTION, ...filteredServiceTypes].includes(
      entityType
    );
  }, [entityType]);

  const hasFollowers = 'followers' in dataAsset;

  const { entityName, tier, isFollowing, version, votes, deleted } = useMemo(
    () => ({
      isFollowing: hasFollowers
        ? (dataAsset as DataAssetsWithFollowersField).followers?.some(
            ({ id }) => id === USER_ID
          )
        : false,

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
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementEntity>();

  const fetchDQFailureCount = async () => {
    if (!tableClassBase.getAlertEnableStatus() || !isDqAlertSupported) {
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
    } catch {
      setDqFailureCount(0);
    }
  };

  const alertBadge = useMemo(() => {
    const shouldShowStatus =
      entityUtilClassBase.shouldShowEntityStatus(entityType);
    const entityStatus =
      'entityStatus' in dataAsset
        ? dataAsset.entityStatus
        : EntityStatus.Unprocessed;

    const statusBadge =
      shouldShowStatus && entityStatus ? (
        <EntityStatusBadge showDivider={false} status={entityStatus} />
      ) : null;

    const renderAlertBadgeWithDq = () => (
      <Space size={8}>
        {badge}
        {statusBadge}
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
    );

    const renderDefaultBadge = () => {
      if (!badge && !statusBadge) {
        return null;
      }

      return (
        <Space size={8}>
          {badge}
          {statusBadge}
        </Space>
      );
    };

    if (
      isDqAlertSupported &&
      tableClassBase.getAlertEnableStatus() &&
      dqFailureCount > 0
    ) {
      return renderAlertBadgeWithDq();
    }

    return renderDefaultBadge();
  }, [
    dqFailureCount,
    dataAsset?.fullyQualifiedName,
    entityType,
    badge,
    dataAsset,
  ]);

  const fetchActiveAnnouncement = async () => {
    try {
      const announcements = await getActiveAnnouncements(
        getEntityFeedLink(entityType, dataAsset.fullyQualifiedName ?? '')
      );

      if (!isEmpty(announcements.data)) {
        setActiveAnnouncement(announcements.data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchContainerAncestors = async (fqn: string) => {
    if (isEmpty(fqn)) {
      return;
    }
    setIsBreadcrumbLoading(true);
    try {
      const ancestors = await getContainerAncestors(fqn);
      setParentContainers(ancestors);
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
    if (entityType === EntityType.CONTAINER && !isCustomizedView) {
      fetchContainerAncestors(dataAsset.fullyQualifiedName ?? '');
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

    navigate(
      entityUtilClassBase.getEntityLink(
        entityType,
        dataAsset.fullyQualifiedName,
        EntityTabs.ACTIVITY_FEED,
        ActivityFeedTabs.TASKS
      )
    );
  };

  const dataAssetServiceName = useMemo(() => {
    if (isDataAssetsWithServiceField(dataAsset)) {
      return dataAsset.service?.name ?? '';
    } else {
      return 'service';
    }
  }, [isDataAssetsWithServiceField, dataAsset]);

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

  const {
    editDomainPermission,
    editOwnerPermission,
    editTierPermission,
    editCertificationPermission,
  } = useMemo(
    () => ({
      editDomainPermission: permissions.EditAll && !dataAsset.deleted,
      editOwnerPermission:
        getPrioritizedEditPermission(permissions, Operation.EditOwners) &&
        !dataAsset.deleted,
      editTierPermission:
        getPrioritizedEditPermission(permissions, Operation.EditTier) &&
        !dataAsset.deleted,
      editCertificationPermission:
        getPrioritizedEditPermission(
          permissions,
          Operation.EditCertification
        ) && !dataAsset.deleted,
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

  const triggerTheAutoPilotApplication = useCallback(async () => {
    try {
      setIsAutoPilotTriggering(true);
      const entityType = getEntityTypeFromServiceCategory(
        serviceCategory as ServiceTypes
      );
      const entityLink = getEntityFeedLink(
        entityType,
        dataAsset.fullyQualifiedName ?? ''
      );

      await triggerOnDemandApp(AUTO_PILOT_APP_NAME, {
        entityLink,
      });

      afterTriggerAction?.();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsAutoPilotTriggering(false);
    }
  }, [serviceCategory, afterTriggerAction]);

  const triggerAutoPilotApplicationButton = useMemo(() => {
    if (
      !SERVICE_TYPES.includes(entityType) ||
      EXCLUDE_AUTO_PILOT_SERVICE_TYPES.includes(entityType) ||
      !permissions.Trigger
    ) {
      return null;
    }

    const isLoading = isAutoPilotWorkflowStatusLoading || isAutoPilotTriggering;

    return (
      <Tooltip
        title={
          disableRunAgentsButtonMessage ??
          t('message.trigger-auto-pilot-application')
        }>
        <Button
          className="font-semibold"
          data-testid="trigger-auto-pilot-application-button"
          disabled={disableRunAgentsButton}
          icon={<Icon className="flex-center" component={TriggerIcon} />}
          loading={isLoading}
          type="primary"
          onClick={triggerTheAutoPilotApplication}>
          {t('label.trigger-entity', { entity: t('label.auto-pilot') })}
        </Button>
      </Tooltip>
    );
  }, [
    disableRunAgentsButton,
    isAutoPilotWorkflowStatusLoading,
    isAutoPilotTriggering,
    triggerTheAutoPilotApplication,
    disableRunAgentsButtonMessage,
    permissions.Trigger,
  ]);

  const handleVoteFromStat = async (type: QueryVoteType) => {
    const updatedVoteType = voteStatus === type ? QueryVoteType.unVoted : type;
    setVoteLoading(type);
    try {
      await onUpdateVote?.({ updatedVoteType }, dataAsset.id ?? '');
    } finally {
      setVoteLoading(null);
    }
  };

  return (
    <>
      <Row
        className="data-assets-header-container"
        data-testid="data-assets-header"
        gutter={[0, 20]}>
        {isDarAwaitingGrant && (
          <Col span={24}>
            <Alert
              data-testid="dar-awaiting-grant-banner"
              title={t('label.data-access-request-awaiting-grant')}
              variant="brand">
              {t('message.data-access-request-awaiting-grant-message')}
            </Alert>
          </Col>
        )}
        <Col
          className={classNames('d-flex flex-col ', {
            'p-l-xs': isCustomizedView,
          })}
          span={24}
          style={{ gap: 2 }}>
          <TitleBreadcrumb
            loading={isBreadcrumbLoading}
            maxVisible={3}
            titleLinks={breadcrumbs.map((link) =>
              isCustomizedView ? { ...link, url: '', noLink: true } : link
            )}
          />
          <div className="data-asset-header-identity-row">
            {icon && (
              <span className="data-asset-header-source-chip">{icon}</span>
            )}
            <div
              className="data-asset-header-title-block"
              data-testid={`${dataAssetServiceName}-${dataAsset?.name}`}>
              <Typography.Text
                className="data-asset-header-name"
                data-testid="entity-header-display-name"
                ellipsis={{
                  tooltip: getEntityName(dataAsset),
                }}>
                {getEntityName(dataAsset)}
              </Typography.Text>
              <Tooltip
                placement="topRight"
                title={
                  copyTooltip ||
                  t('label.copy-item', { item: t('label.url-uppercase') })
                }>
                <Button
                  className="data-asset-header-copy-btn"
                  data-testid="copy-fqn-button"
                  icon={<Icon component={CopyIcon} />}
                  onClick={handleCopyFqn}
                />
              </Tooltip>
              {alertBadge}
              <LearningIcon pageId={entityType} />
            </div>
            <div className="data-asset-header-actions-wrapper">
              <Space
                className="data-asset-header-actions"
                direction="vertical"
                size={10}>
                <div
                  className="data-asset-header-action-row"
                  data-testid="asset-header-btn-group">
                  {triggerAutoPilotApplicationButton}
                  {!excludeEntityService &&
                    !deleted &&
                    !isCustomizedView &&
                    onFollowClick && (
                      <Tooltip
                        title={t('label.field-entity', {
                          field: t(
                            `label.${isFollowing ? 'un-follow' : 'follow'}`
                          ),
                          entity: t('label.entity'),
                        })}>
                        <Button
                          className={classNames('header-action-btn', {
                            'header-action-btn--active': isFollowing,
                          })}
                          data-testid="entity-follow-button"
                          icon={<Icon component={StarFilledIcon} />}
                          loading={isFollowingLoading}
                          onClick={handleFollowingClick}>
                          {t(`label.${isFollowing ? 'following' : 'follow'}`)}
                        </Button>
                      </Tooltip>
                    )}

                  {(dataAsset as Table).sourceUrl && (
                    <Tooltip placement="bottom" title={t('label.source-url')}>
                      <Typography.Link
                        className="cursor-pointer source-url-link"
                        href={(dataAsset as Table).sourceUrl}
                        target="_blank">
                        <Button
                          className="header-action-btn header-action-btn--external"
                          data-testid="source-url-button"
                          icon={
                            <Icon
                              className="flex-center"
                              component={LinkIcon}
                            />
                          }>
                          {t('label.view-in-service-type', {
                            serviceType: (dataAsset as Table).serviceType,
                          })}
                        </Button>
                      </Typography.Link>
                    </Tooltip>
                  )}
                  <ManageButton
                    isAsyncDelete
                    afterDeleteAction={afterDeleteAction}
                    allowRename={allowRename}
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
                </div>

                <div
                  className="data-asset-header-quiet-stats"
                  data-testid="asset-header-quiet-stats">
                  {onUpdateVote && (
                    <>
                      <QuietStat
                        active={voteStatus === QueryVoteType.votedUp}
                        count={votes?.upVotes ?? 0}
                        icon={<ThumbsUpOutline height={14} width={14} />}
                        label={t('label.up-vote')}
                        testId="up-vote-btn"
                        onClick={
                          deleted || voteLoading
                            ? undefined
                            : () => handleVoteFromStat(QueryVoteType.votedUp)
                        }
                      />
                      <QuietStat
                        active={voteStatus === QueryVoteType.votedDown}
                        count={votes?.downVotes ?? 0}
                        icon={
                          <ThumbsUpOutline
                            className="rotate-inverse"
                            height={14}
                            width={14}
                          />
                        }
                        label={t('label.down-vote')}
                        testId="down-vote-btn"
                        onClick={
                          deleted || voteLoading
                            ? undefined
                            : () => handleVoteFromStat(QueryVoteType.votedDown)
                        }
                      />
                    </>
                  )}
                  {!excludeEntityService && (
                    <QuietStat
                      count={openTaskCount ?? 0}
                      icon={<TaskOpenIcon height={14} width={14} />}
                      label={t('label.open-task-plural')}
                      testId="open-task-stat"
                      onClick={handleOpenTaskClick}
                    />
                  )}
                  <QuietStat
                    count={version}
                    icon={<VersionIcon height={14} width={14} />}
                    label={t('label.version-plural-history')}
                    testId="version-button"
                    onClick={onVersionClick}
                  />
                </div>

                {activeAnnouncement && (
                  <AnnouncementCard
                    announcement={activeAnnouncement}
                    onClick={handleOpenAnnouncementDrawer}
                  />
                )}
              </Space>
            </div>
          </div>
        </Col>

        <Col span={24}>
          <div
            className="data-asset-header-metadata"
            data-testid="data-asset-header-metadata">
            {showDomain && (
              <DomainLabel
                headerLayout
                showDashPlaceholder
                afterDomainUpdateAction={afterDomainUpdateAction}
                domains={(dataAsset as EntitiesWithDomainField).domains}
                entityFqn={dataAsset.fullyQualifiedName ?? ''}
                entityId={dataAsset.id ?? ''}
                entityType={entityType}
                hasPermission={editDomainPermission}
                multiple={entityRules.canAddMultipleDomains}
                textClassName="render-domain-lebel-style"
              />
            )}
            <OwnerLabel
              showDashPlaceholder
              avatarSize={24}
              hasPermission={editOwnerPermission}
              isCompactView={false}
              maxVisibleOwners={4}
              multiple={{
                user: entityRules.canAddMultipleUserOwners,
                team: entityRules.canAddMultipleTeamOwner,
              }}
              owners={dataAsset?.owners}
              onUpdate={onOwnerUpdate}
            />
            {tierSuggestionRender ?? (
              <MetadataChip
                label={t('label.tier')}
                testId="header-tier-container">
                <div className="d-flex items-center gap-1">
                  {tier ? (
                    <TagsV1
                      hideIcon
                      startWith={TAG_START_WITH.SOURCE_ICON}
                      tag={tier}
                      tagProps={{
                        'data-testid': 'Tier',
                      }}
                    />
                  ) : (
                    <span
                      className="font-medium no-tier-text text-sm"
                      data-testid="Tier">
                      {NO_DATA_PLACEHOLDER}
                    </span>
                  )}
                  {editTierPermission && (
                    <TierCard
                      currentTier={tier?.tagFQN}
                      footerActionButtonsClassName="p-x-md"
                      updateTier={onTierUpdate}>
                      <EditIconButton
                        newLook
                        data-testid="edit-tier"
                        size="small"
                        title={t('label.edit-entity', {
                          entity: t('label.tier'),
                        })}
                      />
                    </TierCard>
                  )}
                </div>
              </MetadataChip>
            )}

            {entityType === EntityType.TABLE && onUpdateRetentionPeriod && (
              <RetentionPeriod
                hasPermission={permissions.EditAll && !dataAsset.deleted}
                retentionPeriod={dataAsset.retentionPeriod}
                onUpdate={onUpdateRetentionPeriod}
              />
            )}

            {entityType === EntityType.METRIC && onMetricUpdate && (
              <MetricHeaderInfo
                metricDetails={dataAsset}
                metricPermissions={permissions}
                onUpdateMetricDetails={onMetricUpdate}
              />
            )}

            {isUndefined(serviceCategory) && (
              <MetadataChip
                label={t('label.certification')}
                testId="certification-label">
                <div className="d-flex items-center gap-1">
                  {(dataAsset as Table).certification ? (
                    <CertificationTag
                      showName
                      certification={(dataAsset as Table).certification!}
                    />
                  ) : (
                    <span
                      className="font-medium no-tier-text text-sm"
                      data-testid="certification-value">
                      {NO_DATA_PLACEHOLDER}
                    </span>
                  )}
                  {editCertificationPermission && (
                    <Certification
                      currentCertificate={
                        'certification' in dataAsset
                          ? dataAsset.certification?.tagLabel?.tagFQN
                          : undefined
                      }
                      permission={editCertificationPermission}
                      onCertificationUpdate={onCertificationUpdate}>
                      <EditIconButton
                        newLook
                        data-testid="edit-certification"
                        size="small"
                        title={t('label.edit-entity', {
                          entity: t('label.certification'),
                        })}
                      />
                    </Certification>
                  )}
                </div>
              </MetadataChip>
            )}

            {extraInfo}
          </div>
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

      {tableClassBase.getRequestDataAccessDrawer(
        isRequestDataAccessOpen,
        () => setIsRequestDataAccessOpen(false),
        dataAsset.fullyQualifiedName ?? '',
        getEntityName(dataAsset),
        entityType,
        refetchExistingDar
      )}
    </>
  );
};
