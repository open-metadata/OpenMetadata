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
  Button,
  ButtonUtility,
  ClassificationTag,
  FeaturedIcon,
  Owner,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import {
  Activity,
  Alerts,
  Edit01,
  File02,
  LinkExternal01,
  RefreshCcw01,
  ThumbsDown,
  ThumbsDownFilled,
  ThumbsUp,
  ThumbsUpFilled,
  Trigger,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { get, isEmpty, isUndefined, noop } from 'lodash';
import { ServiceTypes } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { DomainMismatchAlert } from '../../../components/common/DomainMismatchAlert/DomainMismatchAlert.component';
import DomainSelectableList from '../../../components/common/DomainSelectableList/DomainSelectableList.component';
import DomainTags from '../../../components/common/DomainTags/DomainTags';
import TierCard from '../../../components/common/TierCard/TierCard';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { AUTO_PILOT_APP_NAME } from '../../../constants/Applications.constant';
import {
  CustomizeEntityType,
  ENTITY_PAGE_TYPE_MAP,
} from '../../../constants/Customize.constants';
import { HeaderPropertyId } from '../../../constants/EntityHeaderProperties.constants';
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  SERVICE_TYPES,
} from '../../../constants/Services.constant';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ResourceEntity } from '../../../enums/permissions.enum';
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
import { LifeCycle } from '../../../generated/type/lifeCycle';
import { Style } from '../../../generated/type/schema';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { QueryVoteType } from '../../../interface/entity/vote.interface';
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
  getSourceUpdatedAtProperty,
} from '../../../utils/DataAssetsHeader.utils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityVoteStatus } from '../../../utils/EntityVoteUtils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getSafeHttpUrl } from '../../../utils/StringUtils';
import tableClassBase from '../../../utils/TableClassBase';
import { saveDomainViaApi } from '../../../utils/DomainSyncUtils';
import { getTierTags } from '../../../utils/TablePureUtils';
import { getTagName, getTagRedirectLink } from '../../../utils/TagsPureUtils';
import { getTagTooltip } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Certification from '../../Certification/Certification.component';
import AnnouncementsWidgetV3Body from '../../common/AnnouncementsWidget/AnnouncementsWidgetV3Body.component';
import CertificationTag from '../../common/CertificationTag/CertificationTag';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { getGlossaryHomeCrumb } from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import TitleBreadcrumbSkeleton from '../../common/Skeleton/BreadCrumb/TitleBreadcrumbSkeleton.component';
import { AssetsUnion } from '../AssetsSelectionModal/AssetSelectionModal.interface';
import RetentionPeriod, {
  formatRetentionPeriod,
} from '../../Database/RetentionPeriod/RetentionPeriod.component';
import ContractLatestResultBadge from '../../DataContract/ContractLatestResultBadge/ContractLatestResultBadge';
import { EntityPageTitle } from '../../Entity/EntityPageTitle/EntityPageTitle';
import { EntityStatusBadge } from '../../Entity/EntityStatusBadge/EntityStatusBadge.component';
import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import IconColorModal from '../../Modals/IconColorModal/IconColorModal';
import ChangeRequestsIndicator from '../../PendingChanges/ChangeRequestsIndicator.component';
import SuggestionsAlert from '../../Suggestions/SuggestionsAlert/SuggestionsAlert';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import { TagChipTooltip } from '../../Tag/TagChipTooltip/TagChipTooltip';
import EntityHeaderProperties from '../EntityHeaderProperties/EntityHeaderProperties';
import { HeaderProperty } from '../EntityHeaderProperties/EntityHeaderProperties.types';
import './data-asset-header.less';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
  DataAssetsWithFollowersField,
  EntitiesWithDomainField,
} from './DataAssetsHeader.interface';
import { FollowStarIcon } from './FollowStarIcon.component';
import { StatItem } from './StatItem.component';

// Extracted so the boolean short-circuits live in their own complexity scope
// instead of DataAssetsHeader's render body.
const computeHasEditableMetadata = (
  editDomainPermission: boolean,
  editOwnerPermission: boolean,
  editTierPermission: boolean,
  editCertificationPermission: boolean,
  editStylePermission: boolean
): boolean => {
  const hasEditableEntityMetadata =
    editDomainPermission || editOwnerPermission || editTierPermission;

  return (
    hasEditableEntityMetadata ||
    editCertificationPermission ||
    editStylePermission
  );
};

const computeCanShowFollowStat = (
  excludeEntityService: boolean,
  deleted: boolean | undefined,
  isCustomizedView: boolean
): boolean => !excludeEntityService && !deleted && !isCustomizedView;

export const DataAssetsHeader = ({
  allowSoftDelete = true,
  allowRename = false,
  showDomain = true,
  afterDeleteAction,
  onDeleteFailure,
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
  softDeleteMessagePostFix,
  hardDeleteMessagePostFix,
  onRestoreDataAsset,
  onDisplayNameUpdate,
  afterDomainUpdateAction,
  onProfilerSettingUpdate,
  onUpdateRetentionPeriod,
  extraDropdownContent,
  badge,
  headerActions,
  isDqAlertSupported = false,
  isCustomizedView = false,
  disableRunAgentsButton = true,
  afterTriggerAction,
  isAutoPilotWorkflowStatusLoading = false,
  onCertificationUpdate,
  onStyleUpdate,
  disableRunAgentsButtonMessage,
  breadcrumbData,
}: DataAssetsHeaderProps) => {
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { currentUser } = useApplicationStore();
  const { selectedUserSuggestions } = useSuggestionsContext();
  const USER_ID = currentUser?.id ?? '';
  const { t } = useTranslation();
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
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const navigate = useNavigate();
  const [isAutoPilotTriggering, setIsAutoPilotTriggering] = useState(false);
  const { entityRules } = useEntityRules(entityType);
  const [dataContract, setDataContract] = useState<DataContract>();
  const fetchDataContract = useCallback(
    async (entityId: string) => {
      try {
        const contract = await getContractByEntityId(entityId, entityType);
        setDataContract(contract);
      } catch {
        // Do nothing
      }
    },
    [entityType]
  );

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
    [dataAsset, USER_ID, hasFollowers]
  );

  const voteStatus = useMemo(
    () => getEntityVoteStatus(USER_ID, votes),
    [votes, USER_ID]
  );

  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawerOpen] =
    useState<boolean>(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<
    AnnouncementEntity[]
  >([]);

  const fetchDQFailureCount = useCallback(async () => {
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
          (node) => node?.fullyQualifiedName !== dataAsset.fullyQualifiedName
        ) ?? [];
      setDqFailureCount(updatedNodes.length);
    } catch {
      setDqFailureCount(0);
    }
  }, [isDqAlertSupported, dataAsset.fullyQualifiedName]);

  const statusBadge = useMemo(() => {
    const shouldShowStatus =
      entityUtilClassBase.shouldShowEntityStatus(entityType);
    const entityStatus =
      'entityStatus' in dataAsset
        ? dataAsset.entityStatus
        : EntityStatus.Unprocessed;

    return shouldShowStatus && entityStatus ? (
      <EntityStatusBadge
        entityId={dataAsset.id}
        entityType={entityType}
        fqn={dataAsset.fullyQualifiedName}
        showDivider={false}
        status={entityStatus}
      />
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
      <ButtonUtility
        color="tertiary-destructive"
        icon={Alerts}
        size="lg"
        tooltip={t('label.check-upstream-failure')}
        tooltipPlacement="right"
        onClick={() =>
          navigate({
            pathname: getEntityDetailsPath(
              entityType,
              dataAsset?.fullyQualifiedName ?? '',
              EntityTabs.LINEAGE
            ),
            search: QueryString.stringify({
              layers: [LineageLayer.DataObservability],
            }),
          })
        }
      />
    );
  }, [dqFailureCount, isDqAlertSupported, dataAsset, entityType, navigate, t]);

  const fetchActiveAnnouncement = useCallback(async () => {
    try {
      const announcements = await getActiveAnnouncements(
        getEntityFeedLink(entityType, dataAsset.fullyQualifiedName ?? '')
      );

      setActiveAnnouncements(announcements.data ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [entityType, dataAsset.fullyQualifiedName]);

  const fetchContainerAncestors = useCallback(
    async (fqn: string) => {
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
    },
    [t]
  );

  useEffect(() => {
    if (dataAsset.fullyQualifiedName && !isCustomizedView) {
      void fetchActiveAnnouncement();
      void fetchDQFailureCount();
    }
    if (entityType === EntityType.CONTAINER && !isCustomizedView) {
      void fetchContainerAncestors(dataAsset.fullyQualifiedName ?? '');
    }
  }, [
    dataAsset.fullyQualifiedName,
    entityType,
    isCustomizedView,
    fetchActiveAnnouncement,
    fetchDQFailureCount,
    fetchContainerAncestors,
  ]);

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

  const breadcrumbItems = useMemo(() => {
    if (breadcrumbData?.length) {
      return breadcrumbData.map((link, index) => ({
        label: link.name,
        href:
          index < breadcrumbData.length - 1 && link.url
            ? String(link.url)
            : undefined,
      }));
    }

    return [
      ...(entityType === EntityType.METRIC ? [getGlossaryHomeCrumb(t)] : []),
      ...breadcrumbs.map((link) => ({
        label: link.name,
        href: !isCustomizedView && link.url ? String(link.url) : undefined,
      })),
      { label: entityName },
    ];
  }, [
    breadcrumbData,
    breadcrumbs,
    entityName,
    entityType,
    isCustomizedView,
    t,
  ]);

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

  // Named-flag derivation (Task 8 sweep): `permissions` is the raw OperationPermission this
  // component receives as a prop; `deleted` (destructured above, from `dataAsset.deleted`)
  // gates every canEdit* flag below, matching each old per-usage `&& !dataAsset.deleted`
  // guard. `editOwnerPermission`/`editTierPermission` were already prioritized calls
  // (getPrioritizedEditPermission) — pure renames onto the named flags. No named flag exists
  // for EditCertification, so `can(Operation.EditCertification)` (same escape hatch the
  // derivation util itself uses, identical computation to the old prioritized call).
  //
  // Behavior-parity fix (base commit 9cf866cd23): all three ManageButton/AnnouncementDrawer
  // props below read raw `permissions?.EditAll` in base, none gated by `deleted` —
  // `onAnnouncementClick={permissions?.EditAll ? handleOpenAnnouncementDrawer : undefined}`,
  // `createPermission={permissions?.EditAll}`, and
  // `editDisplayNamePermission={permissions?.EditAll || permissions?.EditDisplayName}` were
  // all unconditional. An earlier pass on this branch deleted-gated `onAnnouncementClick`
  // and `createPermission` (claiming they were already gated pre-refactor); that claim does
  // not hold against base and is reverted here. All three now read `ungatedFlags` — renaming
  // and announcement affordances are manage-surface actions that must keep working on
  // soft-deleted entities (the only way back from soft-delete lives behind this same
  // ManageButton; TeamDetailsV1's `ungatedFlags` precedent). See `ungatedFlags` below.
  const flags = useMemo(
    () => getDerivedPermissionFlags(permissions, deleted),
    [permissions, deleted]
  );
  // Second derivation with no `deleted` arg, so nothing is gated — reproduces the old
  // unconditional `permissions?.EditAll` / `permissions?.EditAll || permissions?.EditDisplayName`
  // reads for onAnnouncementClick / createPermission / editDisplayNamePermission below. The
  // field-over-EditAll prioritization (getPrioritizedEditPermission, inside
  // getDerivedPermissionFlags) is a deliberate deny-wins upgrade over the old raw OR and is
  // fine to keep — only the deleted-gating was in error.
  const ungatedFlags = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );
  const {
    canEditDomains: editDomainPermission,
    canEditOwners: editOwnerPermission,
    canEditTier: editTierPermission,
    can,
  } = flags;
  const editCertificationPermission = can(Operation.EditCertification);
  const { can: canAutoPilot } = useEntityPermissions(
    ResourceEntity.APPLICATION,
    AUTO_PILOT_APP_NAME,
    { enabled: SERVICE_TYPES.includes(entityType) }
  );
  const hasTriggerPermission =
    can(Operation.Trigger) && canAutoPilot(Operation.Trigger);
  const editStylePermission = Boolean(onStyleUpdate) && flags.canEditAll;

  const hasEditableMetadata = computeHasEditableMetadata(
    editDomainPermission,
    editOwnerPermission,
    editTierPermission,
    editCertificationPermission,
    editStylePermission
  );

  const currentStyle = useMemo<Style | undefined>(
    () => ('style' in dataAsset ? dataAsset.style : undefined),
    [dataAsset]
  );

  const handleStyleUpdate = useCallback(
    async (style: Style) => {
      const updatedStyle: Style = {
        ...currentStyle,
        ...style,
        color: style.color?.trim() ?? '',
        iconURL: style.iconURL?.trim() ?? '',
      };
      const hasStyleValue = Boolean(
        updatedStyle.color || updatedStyle.iconURL || updatedStyle.coverImage
      );

      await onStyleUpdate?.(hasStyleValue ? updatedStyle : null);
      setIsStyleEditing(false);
    },
    [currentStyle, onStyleUpdate]
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
      return (
        <ContractLatestResultBadge
          href={getEntityDetailsPath(
            entityType,
            dataAsset?.fullyQualifiedName ?? '',
            EntityTabs.CONTRACT
          )}
          status={dataContract.latestResult.status}
        />
      );
    }

    return null;
  }, [dataContract, customizedPage?.tabs, entityType, dataAsset]);

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
  }, [serviceCategory, afterTriggerAction, dataAsset.fullyQualifiedName]);

  const triggerAutoPilotApplicationButton = useMemo(() => {
    if (
      !SERVICE_TYPES.includes(entityType) ||
      EXCLUDE_AUTO_PILOT_SERVICE_TYPES.includes(entityType) ||
      !hasTriggerPermission
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
            iconLeading={Trigger}
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
    hasTriggerPermission,
    entityType,
    t,
  ]);

  const sourceUrlButton = useMemo(() => {
    const sourceUrl = getSafeHttpUrl(
      get(dataAsset, 'sourceUrl') ?? get(dataAsset, 'endpointURL')
    );
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
            iconLeading={LinkExternal01}
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
      void fetchDataContract(dataAsset.id);
    }
  }, [dataAsset.id, fetchDataContract]);

  const canShowFollowStat = computeCanShowFollowStat(
    excludeEntityService,
    deleted,
    isCustomizedView
  );

  const renderVoteStats = () => {
    if (!onUpdateVote) {
      return null;
    }

    return (
      <>
        <StatItem
          count={votes?.upVotes ?? 0}
          countTestId="up-vote-count"
          disabled={deleted}
          icon={
            voteStatus === QueryVoteType.votedUp ? ThumbsUpFilled : ThumbsUp
          }
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
          iconNode={
            voteStatus === QueryVoteType.votedDown ? (
              <ThumbsDownFilled
                className="tw:text-fg-warning-primary"
                size={20}
              />
            ) : undefined
          }
          isActive={voteStatus === QueryVoteType.votedDown}
          loading={downVoteLoading}
          testId="down-vote-btn"
          tooltip={t('label.down-vote')}
          onClick={handleDownVote}
        />
      </>
    );
  };

  const renderFollowAndVoteStats = () => {
    const followLabel = t(`label.${isFollowing ? 'un-follow' : 'follow'}`);

    return (
      <div className="tw:flex tw:items-center tw:gap-4">
        {canShowFollowStat && onFollowClick && (
          <StatItem
            iconNode={<FollowStarIcon selected={isFollowing} />}
            loading={isFollowingLoading}
            srLabel={followLabel}
            testId="entity-follow-button"
            tooltip={followLabel}
            onClick={handleFollowingClick}
          />
        )}
        {renderVoteStats()}
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
    );
  };

  const renderServiceLogo = () => {
    // Metrics have no owning service, so fall back to the metric entity icon so
    // the header still shows a leading glyph next to the title.
    const isMetricWithoutService =
      !serviceLogoUrl && entityType === EntityType.METRIC;

    if (!serviceLogoUrl && !isMetricWithoutService) {
      return null;
    }

    return (
      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
        <FeaturedIcon
          color="gray"
          icon={
            serviceLogoUrl ? (
              <img
                alt={get(dataAsset, 'service.displayName', '')}
                className="tw:size-5 tw:object-contain"
                src={serviceLogoUrl}
              />
            ) : (
              Activity
            )
          }
          radius="lg"
          shape="square"
          size="md"
          theme="modern"
        />
        {editStylePermission && (
          <ButtonUtility
            data-testid="edit-service-style"
            icon={Edit01}
            tooltip={t('label.edit-entity', {
              entity: t('label.style'),
            })}
            onClick={() => setIsStyleEditing(true)}
          />
        )}
      </div>
    );
  };

  const renderManageButton = () => (
    <ManageButton
      isAsyncDelete
      afterDeleteAction={afterDeleteAction}
      allowRename={allowRename}
      allowSoftDelete={!dataAsset.deleted && allowSoftDelete}
      canDelete={flags.canDelete}
      canRestore={ungatedFlags.canEditAll}
      deleted={dataAsset.deleted}
      displayName={getEntityName(dataAsset)}
      editDisplayNamePermission={ungatedFlags.canEditDisplayName}
      entityFQN={dataAsset.fullyQualifiedName}
      entityId={dataAsset.id}
      entityName={dataAsset.name}
      entityType={entityType}
      extraDropdownContent={extraDropdownContent}
      hardDeleteMessagePostFix={hardDeleteMessagePostFix}
      isRecursiveDelete={isRecursiveDelete}
      softDeleteMessagePostFix={softDeleteMessagePostFix}
      onAnnouncementClick={
        flags.canEditAll ? handleOpenAnnouncementDrawer : undefined
      }
      onDeleteFailure={onDeleteFailure}
      onEditDisplayName={onDisplayNameUpdate}
      onProfilerSettingUpdate={onProfilerSettingUpdate}
      onRestoreEntity={onRestoreDataAsset}
    />
  );

  const certification = (dataAsset as Table).certification;
  const domains = (dataAsset as EntitiesWithDomainField).domains;

  const handleDomainSave = (
    selectedDomain: EntityReference | EntityReference[] | undefined
  ) =>
    saveDomainViaApi(
      selectedDomain ?? [],
      entityType as AssetsUnion,
      dataAsset.fullyQualifiedName ?? '',
      dataAsset.id ?? '',
      noop,
      afterDomainUpdateAction
    );

  const editableProperty = (
    property: Omit<HeaderProperty, 'isReadOnly' | 'isEmpty'>,
    value: unknown,
    canEdit: boolean
  ): HeaderProperty => ({
    ...property,
    isEmpty: isEmpty(value),
    isReadOnly: false,
    renderEditor: canEdit ? property.renderEditor : undefined,
  });

  const tierProperty = (): HeaderProperty =>
    editableProperty(
      {
        id: HeaderPropertyId.Tier,
        label: t('label.tier'),
        testId: 'header-tier-container',
        editorTestId: 'edit-tier',
        content:
          tierSuggestionRender ??
          (tier && (
            <TagChipTooltip
              title={getTagTooltip(tier.tagFQN, tier.description)}>
              <ClassificationTag
                color={tier.style?.color}
                data-testid="Tier"
                href={getTagRedirectLink(tier)}
                icon={tier.style?.iconURL}
                label={getTagName(tier)}
                size="sm"
              />
            </TagChipTooltip>
          )),
        renderEditor: (trigger) => (
          <TierCard currentTier={tier?.tagFQN} updateTier={onTierUpdate}>
            {trigger}
          </TierCard>
        ),
      },
      tierSuggestionRender ?? tier,
      editTierPermission && !tierSuggestionRender
    );

  const getStandardProperties = (): HeaderProperty[] => [
    ...(showDomain
      ? [
          editableProperty(
            {
              id: HeaderPropertyId.Domains,
              label: t('label.domain-plural'),
              testId: 'header-domain-container',
              editorTestId: 'add-domain',
              content: (
                <DomainTags
                  domains={domains}
                  maxVisible={entityRules.canAddMultipleDomains ? 1 : undefined}
                />
              ),
              renderEditor: (trigger) => (
                <DomainSelectableList
                  hasPermission
                  multiple={entityRules.canAddMultipleDomains}
                  selectedDomain={domains}
                  onUpdate={handleDomainSave}>
                  {trigger}
                </DomainSelectableList>
              ),
            },
            domains,
            editDomainPermission
          ),
        ]
      : []),
    editableProperty(
      {
        id: HeaderPropertyId.Owners,
        label: t('label.owner-plural'),
        editorTestId: 'edit-owner',
        content: (
          <Owner
            avatarSize={24}
            isCompactView={false}
            maxVisibleOwners={3}
            owners={dataAsset.owners}
            showLabel={false}
          />
        ),
        renderEditor: (trigger) => (
          <UserTeamSelectableList
            hasPermission
            multiple={{
              user: entityRules.canAddMultipleUserOwners,
              team: entityRules.canAddMultipleTeamOwner,
            }}
            owner={dataAsset.owners}
            onUpdate={onOwnerUpdate}>
            {trigger}
          </UserTeamSelectableList>
        ),
      },
      dataAsset.owners,
      editOwnerPermission
    ),
    tierProperty(),
    ...(isUndefined(serviceCategory)
      ? [
          editableProperty(
            {
              id: HeaderPropertyId.Certification,
              label: t('label.certification'),
              testId: 'certification-label',
              editorTestId: 'edit-certification',
              content: certification && (
                <div data-testid="certification-value">
                  <CertificationTag showName certification={certification} />
                </div>
              ),
              renderEditor: (trigger) => (
                <Certification
                  currentCertificate={certification?.tagLabel?.tagFQN}
                  permission={editCertificationPermission}
                  onCertificationUpdate={onCertificationUpdate}>
                  {trigger}
                </Certification>
              ),
            },
            certification,
            editCertificationPermission
          ),
        ]
      : []),
    ...(entityType === EntityType.TABLE && onUpdateRetentionPeriod
      ? [
          editableProperty(
            {
              id: HeaderPropertyId.RetentionPeriod,
              label: t('label.retention-period'),
              testId: 'retention-period-container',
              editorTestId: 'edit-retention-period-button',
              content: formatRetentionPeriod(dataAsset.retentionPeriod),
              renderEditor: (trigger) => (
                <RetentionPeriod
                  retentionPeriod={dataAsset.retentionPeriod}
                  onUpdate={onUpdateRetentionPeriod}>
                  {trigger}
                </RetentionPeriod>
              ),
            },
            dataAsset.retentionPeriod,
            flags.canEditAll
          ),
        ]
      : []),
  ];

  const headerProperties: HeaderProperty[] = [
    ...getStandardProperties(),
    ...extraInfo,
    getSourceUpdatedAtProperty(
      (dataAsset as { lifeCycle?: LifeCycle }).lifeCycle?.updated?.timestamp
    ),
  ];

  const renderFooterOverlays = () => (
    <>
      {activeAnnouncements.length > 0 && (
        <AnnouncementsWidgetV3Body
          announcements={activeAnnouncements}
          className="tw:mt-3"
          testId="entity-header-announcements"
          onItemClick={handleOpenAnnouncementDrawer}
        />
      )}

      {isAnnouncementDrawerOpen && (
        <AnnouncementDrawer
          createPermission={ungatedFlags.canEditAll}
          entityFQN={dataAsset.fullyQualifiedName ?? ''}
          entityType={entityType}
          open={isAnnouncementDrawerOpen}
          onClose={handleCloseAnnouncementDrawer}
        />
      )}

      {onStyleUpdate && (
        <IconColorModal
          open={isStyleEditing}
          style={currentStyle}
          onCancel={() => setIsStyleEditing(false)}
          onSubmit={handleStyleUpdate}
        />
      )}
    </>
  );

  return (
    <>
      <div
        className={classNames(
          'tw:relative tw:flex tw:flex-col tw:gap-5 tw:rounded-xl tw:border tw:border-border-secondary tw:bg-surface tw:p-5',
          'data-assets-header-container',
          { 'has-editable-metadata': hasEditableMetadata }
        )}
        data-testid="data-assets-header">
        {tableClassBase.getRequestDataAccessBanner()}
        <DomainMismatchAlert
          domains={(dataAsset as EntitiesWithDomainField).domains}
          entityId={dataAsset.id ?? ''}
        />

        <div
          className={classNames(
            'tw:flex tw:items-center tw:justify-between tw:gap-4 tw:flex-wrap',
            { 'tw:pl-1': isCustomizedView }
          )}>
          <div className="tw:min-w-0 tw:flex-1">
            <TitleBreadcrumbSkeleton loading={isBreadcrumbLoading}>
              <HeaderBreadcrumb
                autoCollapse
                className="tw:mb-0"
                items={breadcrumbItems}
                showHome={false}
                size="xs"
              />
            </TitleBreadcrumbSkeleton>
          </div>
          {renderFollowAndVoteStats()}
        </div>

        <div className="tw:flex tw:items-center tw:gap-4 tw:flex-wrap">
          {/* A deleted entity shows "Deleted" instead of its status. */}
          <EntityPageTitle
            actions={<LearningIcon pageId={entityType} />}
            badges={
              <>
                {badge}
                {!dataAsset.deleted && statusBadge}
                {dqFailureAlert}
              </>
            }
            deleted={deleted}
            displayName={dataAsset.displayName}
            icon={renderServiceLogo()}
            name={dataAsset.name}
          />

          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
            {triggerAutoPilotApplicationButton}
            {dataContractLatestResultButton}
            {sourceUrlButton}
            {tableClassBase.getRequestDataAccessButton()}
            <ChangeRequestsIndicator
              entityId={dataAsset.id ?? ''}
              entityType={entityType}
            />
            {headerActions}
            {renderManageButton()}
          </div>
        </div>

        <EntityHeaderProperties properties={headerProperties} />
      </div>

      {renderFooterOverlays()}
    </>
  );
};
