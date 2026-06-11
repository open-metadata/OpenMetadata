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
import {
  Alert,
  Button,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Copy01,
  File02,
  RefreshCcw01,
  ThumbsDown,
  ThumbsUp,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { get, isEmpty, isUndefined, toLower } from 'lodash';
import { ServiceTypes } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ReactComponent as RedAlertIcon } from '../../../assets/svg/ic-alert-red.svg';
import { ReactComponent as TriggerIcon } from '../../../assets/svg/trigger.svg';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { DomainLabel } from '../../../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TierCard from '../../../components/common/TierCard/TierCard';
import { AUTO_PILOT_APP_NAME } from '../../../constants/Applications.constant';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  CustomizeEntityType,
  ENTITY_PAGE_TYPE_MAP,
} from '../../../constants/Customize.constants';
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  SERVICE_TYPES,
} from '../../../constants/Services.constant';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import {
  ContractExecutionStatus,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { Table } from '../../../generated/entity/data/table';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useDataAccessRequest } from '../../../hooks/useDataAccessRequest';
import { useEntityRules } from '../../../hooks/useEntityRules';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
} from '../../../rest/announcementsAPI';
import { triggerOnDemandApp } from '../../../rest/applicationAPI';
import { getContractByEntityId } from '../../../rest/contractAPI';
import { getDataQualityLineage } from '../../../rest/lineageAPI';
import { getContainerAncestors } from '../../../rest/storageAPI';
import {
  getDataAssetsHeaderInfo,
  HeaderDotSeparator,
} from '../../../utils/DataAssetsHeader.utils';
import { getDataContractStatusIcon } from '../../../utils/DataContract/DataContractUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityVoteStatus } from '../../../utils/EntityVoteUtils';
import { getPrioritizedEditPermission } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import tableClassBase from '../../../utils/TableClassBase';
import { getTierTags } from '../../../utils/TablePureUtils';
import { getDarButtonTooltip } from '../../../utils/TasksUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Certification from '../../Certification/Certification.component';
import CertificationTag from '../../common/CertificationTag/CertificationTag';
import AnnouncementCard from '../../common/EntityPageInfos/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import TitleBreadcrumbSkeleton from '../../common/Skeleton/BreadCrumb/TitleBreadcrumbSkeleton.component';
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
import { FollowStarIcon } from './FollowStarIcon.component';
import { StatItem } from './StatItem.component';

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
  canCreateTask = false,
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
  const { customizedPage } = useCustomPages(
    ENTITY_PAGE_TYPE_MAP[entityType as CustomizeEntityType]
  );
  const [parentContainers, setParentContainers] = useState<EntityReference[]>(
    []
  );
  const [isBreadcrumbLoading, setIsBreadcrumbLoading] = useState(false);
  const [dqFailureCount, setDqFailureCount] = useState(0);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [upVoteLoading, setUpVoteLoading] = useState(false);
  const [downVoteLoading, setDownVoteLoading] = useState(false);
  const { onCopyToClipBoard, hasCopied } = useClipboard('', 2000);
  const navigate = useNavigate();
  const [isAutoPilotTriggering, setIsAutoPilotTriggering] = useState(false);
  const { entityRules } = useEntityRules(entityType);
  const [dataContract, setDataContract] = useState<DataContract>();
  const [isRequestDataAccessOpen, setIsRequestDataAccessOpen] = useState(false);
  const {
    isDarDisabled,
    isDarAwaitingGrant,
    isDarGranted,
    refetch: refetchExistingDar,
  } = useDataAccessRequest({
    entityFqn: dataAsset.fullyQualifiedName,
    enabled: entityType === EntityType.TABLE,
  });

  const fetchDataContract = async (entityId: string) => {
    try {
      const contract = await getContractByEntityId(entityId, entityType);
      setDataContract(contract);
    } catch {
      // Do nothing
    }
  };

  const serviceLogoUrl = useMemo(() => {
    const serviceType = get(dataAsset, 'serviceType', '');

    return serviceType
      ? serviceUtilClassBase.getServiceTypeLogo({
          ...dataAsset,
          entityType,
        })
      : null;
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

  const statusBadge = useMemo(() => {
    const shouldShowStatus =
      entityUtilClassBase.shouldShowEntityStatus(entityType);
    const entityStatus =
      'entityStatus' in dataAsset
        ? dataAsset.entityStatus
        : EntityStatus.Unprocessed;

    return shouldShowStatus && entityStatus ? (
      <EntityStatusBadge showDivider={false} status={entityStatus} />
    ) : null;
  }, [entityType, dataAsset]);

  const dqFailureAlert = useMemo(() => {
    const shouldRender =
      isDqAlertSupported &&
      tableClassBase.getAlertEnableStatus() &&
      dqFailureCount > 0;

    if (!shouldRender) {
      return null;
    }

    return (
      <Tooltip placement="right" title={t('label.check-upstream-failure')}>
        <TooltipTrigger>
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
            <RedAlertIcon
              className="tw:text-fg-error-primary"
              height={24}
              width={24}
            />
          </Link>
        </TooltipTrigger>
      </Tooltip>
    );
  }, [dqFailureCount, isDqAlertSupported, dataAsset, entityType, t]);

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

  const handleUpVote = useCallback(async () => {
    if (!onUpdateVote) {
      return;
    }
    setUpVoteLoading(true);
    const updatedVoteType =
      voteStatus === QueryVoteType.votedUp
        ? QueryVoteType.unVoted
        : QueryVoteType.votedUp;
    try {
      await onUpdateVote({ updatedVoteType }, dataAsset.id ?? '');
    } finally {
      setUpVoteLoading(false);
    }
  }, [onUpdateVote, voteStatus, dataAsset.id]);

  const handleDownVote = useCallback(async () => {
    if (!onUpdateVote) {
      return;
    }
    setDownVoteLoading(true);
    const updatedVoteType =
      voteStatus === QueryVoteType.votedDown
        ? QueryVoteType.unVoted
        : QueryVoteType.votedDown;
    try {
      await onUpdateVote({ updatedVoteType }, dataAsset.id ?? '');
    } finally {
      setDownVoteLoading(false);
    }
  }, [onUpdateVote, voteStatus, dataAsset.id]);

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
    try {
      await onFollowClick?.();
    } finally {
      setIsFollowingLoading(false);
    }
  }, [onFollowClick]);

  const handleCopyEntityUrl = useCallback(async () => {
    await onCopyToClipBoard(globalThis.location.href);
  }, [onCopyToClipBoard]);

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

  const hasEditableMetadata =
    editDomainPermission ||
    editOwnerPermission ||
    editTierPermission ||
    editCertificationPermission;

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
          <div className="tw:w-auto" data-testid="tier-suggestion-container">
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

  const dataContractLatestResultButton = useMemo(() => {
    const entityContainContractTabVisible =
      isUndefined(customizedPage?.tabs) ||
      Boolean(
        customizedPage?.tabs?.find((item) => item.id === EntityTabs.CONTRACT)
      );

    if (
      entityContainContractTabVisible &&
      dataContract?.latestResult?.status &&
      [
        ContractExecutionStatus.Aborted,
        ContractExecutionStatus.Failed,
        ContractExecutionStatus.Running,
      ].includes(dataContract?.latestResult?.status)
    ) {
      const IconComponent = getDataContractStatusIcon(
        dataContract?.latestResult?.status
      );

      return (
        <Button
          className={classNames(
            'data-contract-latest-result-button',
            toLower(dataContract?.latestResult?.status)
          )}
          color="secondary"
          data-testid="data-contract-latest-result-btn"
          iconLeading={IconComponent}
          size="sm"
          onPress={() => {
            navigate(
              getEntityDetailsPath(
                entityType,
                dataAsset?.fullyQualifiedName ?? '',
                EntityTabs.CONTRACT
              )
            );
          }}>
          {t(`label.entity-${toLower(dataContract?.latestResult?.status)}`, {
            entity: t('label.contract'),
          })}
        </Button>
      );
    }

    return null;
  }, [dataContract, customizedPage?.tabs, entityType, dataAsset, navigate, t]);

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
        placement="top"
        title={
          disableRunAgentsButtonMessage ??
          t('message.trigger-auto-pilot-application')
        }>
        <TooltipTrigger>
          <Button
            color="primary"
            data-testid="trigger-auto-pilot-application-button"
            iconLeading={TriggerIcon}
            isDisabled={disableRunAgentsButton}
            isLoading={isLoading}
            size="sm"
            onPress={triggerTheAutoPilotApplication}>
            {t('label.trigger-entity', { entity: t('label.auto-pilot') })}
          </Button>
        </TooltipTrigger>
      </Tooltip>
    );
  }, [
    disableRunAgentsButton,
    isAutoPilotWorkflowStatusLoading,
    isAutoPilotTriggering,
    triggerTheAutoPilotApplication,
    disableRunAgentsButtonMessage,
    permissions.Trigger,
    entityType,
    t,
  ]);

  const requestDataAccessButton = useMemo(() => {
    if (
      !tableClassBase.getShowRequestDataAccess() ||
      entityType !== EntityType.TABLE ||
      deleted ||
      !canCreateTask
    ) {
      return null;
    }

    const tooltipTitle = getDarButtonTooltip(
      isDarDisabled,
      isDarGranted,
      isDarAwaitingGrant,
      t
    );

    return (
      <Tooltip placement="top" title={tooltipTitle}>
        <TooltipTrigger>
          <Button
            color="secondary"
            data-testid="request-data-access-button"
            isDisabled={isDarDisabled}
            size="sm"
            onPress={() => setIsRequestDataAccessOpen(true)}>
            {t('label.request-data-access')}
          </Button>
        </TooltipTrigger>
      </Tooltip>
    );
  }, [
    entityType,
    deleted,
    isDarDisabled,
    isDarAwaitingGrant,
    isDarGranted,
    canCreateTask,
    t,
  ]);

  const sourceUrlButton = useMemo(() => {
    const sourceUrl =
      get(dataAsset, 'sourceUrl') ?? get(dataAsset, 'endpointURL');
    if (!sourceUrl) {
      return null;
    }

    return (
      <Tooltip placement="bottom" title={t('label.source-url')}>
        <TooltipTrigger>
          <Button
            color="secondary"
            data-testid="source-url-button"
            href={sourceUrl}
            iconLeading={IconExternalLink}
            rel="noopener noreferrer"
            size="sm"
            target="_blank">
            {t('label.view-in-service-type', {
              serviceType: get(dataAsset, 'serviceType', ''),
            })}
          </Button>
        </TooltipTrigger>
      </Tooltip>
    );
  }, [dataAsset, t]);

  useEffect(() => {
    if (dataAsset.id) {
      fetchDataContract(dataAsset.id);
    }
  }, [dataAsset?.id]);

  const hasDisplayName = !isEmpty(dataAsset.displayName);

  return (
    <>
      <div
        className={classNames(
          'tw:relative tw:flex tw:flex-col tw:gap-5 tw:rounded-xl tw:border tw:border-border-secondary tw:bg-primary tw:p-5',
          'data-assets-header-container',
          { 'has-editable-metadata': hasEditableMetadata }
        )}
        data-testid="data-assets-header">
        {isDarAwaitingGrant && (
          <Alert
            data-testid="dar-awaiting-grant-banner"
            title={t('label.data-access-request-awaiting-grant')}
            variant="brand">
            {t('message.data-access-request-awaiting-grant-message')}
          </Alert>
        )}

        <div
          className={classNames(
            'tw:flex tw:items-center tw:justify-between tw:gap-4 tw:flex-wrap',
            { 'tw:pl-1': isCustomizedView }
          )}>
          <div className="tw:min-w-0 tw:flex-1">
            <TitleBreadcrumbSkeleton loading={isBreadcrumbLoading}>
              <HeaderBreadcrumb
                items={[
                  ...breadcrumbs.map((link) => ({
                    label: link.name,
                    href:
                      !isCustomizedView && link.url
                        ? String(link.url)
                        : undefined,
                  })),
                  { label: entityName },
                ]}
                size="sm"
              />
            </TitleBreadcrumbSkeleton>
          </div>
          <div className="tw:flex tw:items-center tw:gap-4">
            {!excludeEntityService &&
              !deleted &&
              !isCustomizedView &&
              onFollowClick && (
                <StatItem
                  iconNode={
                    <FollowStarIcon
                      className="tw:size-[29px]"
                      selected={isFollowing}
                    />
                  }
                  loading={isFollowingLoading}
                  srLabel={t(`label.${isFollowing ? 'un-follow' : 'follow'}`)}
                  testId="entity-follow-button"
                  tooltip={t(`label.${isFollowing ? 'un-follow' : 'follow'}`)}
                  onClick={handleFollowingClick}
                />
              )}
            {onUpdateVote && (
              <>
                <StatItem
                  count={votes?.upVotes ?? 0}
                  countTestId="up-vote-count"
                  disabled={deleted}
                  icon={ThumbsUp}
                  isActive={voteStatus === QueryVoteType.votedUp}
                  loading={upVoteLoading}
                  testId="up-vote-btn"
                  tooltip={t('label.up-vote')}
                  onClick={handleUpVote}
                />
                <StatItem
                  count={votes?.downVotes ?? 0}
                  countTestId="down-vote-count"
                  disabled={deleted}
                  icon={ThumbsDown}
                  isActive={voteStatus === QueryVoteType.votedDown}
                  loading={downVoteLoading}
                  testId="down-vote-btn"
                  tooltip={t('label.down-vote')}
                  onClick={handleDownVote}
                />
              </>
            )}
            {!excludeEntityService && (openTaskCount ?? 0) > 0 && (
              <StatItem
                count={openTaskCount ?? 0}
                icon={File02}
                testId="open-task-stat"
                tooltip={t('label.open-task-plural')}
                onClick={handleOpenTaskClick}
              />
            )}
            {version !== undefined && (
              <StatItem
                count={version}
                icon={RefreshCcw01}
                testId="version-button"
                tooltip={t('label.version-plural-history')}
                onClick={onVersionClick}
              />
            )}
          </div>
        </div>

        <div className="tw:flex tw:items-center tw:gap-4 tw:flex-wrap">
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3">
            {serviceLogoUrl && (
              <div
                className={classNames(
                  'tw:relative tw:flex tw:size-9 tw:shrink-0 tw:items-center',
                  'tw:justify-center tw:overflow-hidden tw:rounded-full',
                  'tw:bg-primary tw:border tw:border-border-secondary tw:shadow-xs-skeumorphic'
                )}>
                <img
                  alt={get(dataAsset, 'service.displayName', '')}
                  className="tw:size-5 tw:object-contain"
                  src={serviceLogoUrl}
                />
              </div>
            )}
            <div
              className="tw:flex tw:min-w-0 tw:items-center tw:gap-3"
              data-testid="entity-header-title">
              <div className="tw:flex tw:min-w-0 tw:flex-col">
                {hasDisplayName && (
                  <Typography
                    as="h2"
                    className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
                    data-testid="entity-header-display-name"
                    ellipsis={{ tooltip: entityName }}
                    size="text-lg"
                    weight="bold">
                    {entityName}
                  </Typography>
                )}
                <Typography
                  as={hasDisplayName ? 'span' : 'h2'}
                  className={classNames(
                    'tw:m-0 tw:block tw:min-w-0 tw:truncate tw:text-left',
                    {
                      'tw:text-primary': !hasDisplayName,
                      'tw:text-tertiary': hasDisplayName,
                    }
                  )}
                  data-testid="entity-header-name"
                  ellipsis={{ tooltip: dataAsset.name }}
                  size={hasDisplayName ? 'text-sm' : 'text-lg'}
                  weight={hasDisplayName ? 'medium' : 'bold'}>
                  {dataAsset.name}
                </Typography>
              </div>
              {deleted && (
                <span
                  className="deleted-badge-button"
                  data-testid="deleted-badge">
                  {t('label.deleted')}
                </span>
              )}
              <Tooltip
                placement="top"
                title={
                  hasCopied
                    ? t('message.link-copy-to-clipboard')
                    : t('label.copy-item', { item: t('label.url-uppercase') })
                }>
                <TooltipTrigger className="tw:flex tw:items-center">
                  <Button
                    aria-label={t('label.copy-item', {
                      item: t('label.url-uppercase'),
                    })}
                    color="tertiary"
                    data-testid="entity-header-copy-button"
                    iconLeading={Copy01}
                    size="xs"
                    type="button"
                    onClick={handleCopyEntityUrl}
                  />
                </TooltipTrigger>
              </Tooltip>
              <LearningIcon pageId={entityType} />
            </div>
            {badge}
            {statusBadge}
            {dqFailureAlert}
          </div>

          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
            {triggerAutoPilotApplicationButton}
            {dataContractLatestResultButton}
            {sourceUrlButton}
            {requestDataAccessButton}
            <ManageButton
              isAsyncDelete
              afterDeleteAction={afterDeleteAction}
              allowRename={allowRename}
              allowSoftDelete={!dataAsset.deleted && allowSoftDelete}
              buttonClassName="data-assets-header-manage-button"
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
                permissions?.EditAll ? handleOpenAnnouncementDrawer : undefined
              }
              onEditDisplayName={onDisplayNameUpdate}
              onProfilerSettingUpdate={onProfilerSettingUpdate}
              onRestoreEntity={onRestoreDataAsset}
            />
          </div>
        </div>

        {activeAnnouncement && (
          <AnnouncementCard
            announcement={activeAnnouncement}
            onClick={handleOpenAnnouncementDrawer}
          />
        )}

        <div
          className="tw:flex tw:flex-wrap tw:items-start tw:gap-[18px]"
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

          {showDomain && <HeaderDotSeparator />}

          <OwnerLabel
            showDashPlaceholder
            avatarSize={24}
            className="header-owner-heading"
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

          <HeaderDotSeparator />

          {tierSuggestionRender ?? (
            <div
              className="tw:flex tw:flex-col tw:gap-1.5"
              data-testid="header-tier-container">
              <div className="tw:flex tw:items-center tw:gap-1">
                <Typography
                  as="span"
                  className="tw:text-secondary"
                  size="text-sm"
                  weight="medium">
                  {t('label.tier')}
                </Typography>
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
              {(() => {
                const tierValue = tier ? (
                  <TagsV1
                    hideIcon
                    startWith={TAG_START_WITH.SOURCE_ICON}
                    tag={tier}
                    tagProps={{
                      'data-testid': 'Tier',
                    }}
                  />
                ) : (
                  <Typography
                    as="span"
                    className="tw:cursor-pointer tw:text-primary"
                    data-testid="Tier"
                    size="text-sm"
                    weight="medium">
                    {NO_DATA_PLACEHOLDER}
                  </Typography>
                );

                return editTierPermission ? (
                  <TierCard
                    currentTier={tier?.tagFQN}
                    footerActionButtonsClassName="p-x-md"
                    updateTier={onTierUpdate}>
                    <span className="tw:inline-flex tw:cursor-pointer">
                      {tierValue}
                    </span>
                  </TierCard>
                ) : (
                  tierValue
                );
              })()}
            </div>
          )}

          {isUndefined(serviceCategory) && (
            <>
              <HeaderDotSeparator />
              <div
                className="tw:flex tw:flex-col tw:gap-1.5"
                data-testid="certification-label">
                <div className="tw:flex tw:items-center tw:gap-1">
                  <Typography
                    as="span"
                    className="tw:text-secondary"
                    size="text-sm"
                    weight="medium">
                    {t('label.certification')}
                  </Typography>
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
                {(() => {
                  const certValue = (
                    <div
                      className="tw:text-sm tw:font-medium tw:text-primary"
                      data-testid="certification-value">
                      {(dataAsset as Table).certification ? (
                        <CertificationTag
                          showName
                          certification={(dataAsset as Table).certification!}
                        />
                      ) : (
                        NO_DATA_PLACEHOLDER
                      )}
                    </div>
                  );

                  return editCertificationPermission ? (
                    <Certification
                      currentCertificate={
                        'certification' in dataAsset
                          ? dataAsset.certification?.tagLabel?.tagFQN
                          : undefined
                      }
                      permission={editCertificationPermission}
                      onCertificationUpdate={onCertificationUpdate}>
                      <span className="tw:inline-flex tw:cursor-pointer">
                        {certValue}
                      </span>
                    </Certification>
                  ) : (
                    certValue
                  );
                })()}
              </div>
            </>
          )}

          {entityType === EntityType.TABLE && onUpdateRetentionPeriod && (
            <>
              <HeaderDotSeparator />
              <RetentionPeriod
                hasPermission={permissions.EditAll && !dataAsset.deleted}
                retentionPeriod={dataAsset.retentionPeriod}
                onUpdate={onUpdateRetentionPeriod}
              />
            </>
          )}

          {entityType === EntityType.METRIC && onMetricUpdate && (
            <MetricHeaderInfo
              metricDetails={dataAsset}
              metricPermissions={permissions}
              onUpdateMetricDetails={onMetricUpdate}
            />
          )}

          {extraInfo}
        </div>
      </div>

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
