/*
 *  Copyright 2026 Collate.
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
  Avatar,
  Badge,
  BadgeWithIcon,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  Dropdown,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Activity,
  BookOpen01,
  Clock,
  Cube01,
  Database03,
  Flag01,
  GitBranch01,
  LayersTwo01,
  RefreshCcw01,
  Share07,
  Shield01,
  Speedometer04,
  Star01,
  Tag01,
  Trash01,
  User01,
} from '@untitledui/icons';
import type { AxiosError } from 'axios';
import startCase from 'lodash/startCase';
import type { FC, Key, ReactNode } from 'react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { useAsyncDeleteProvider } from '../../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { TagSource } from '../../../generated/type/tagLabel';
import type { FeedCounts } from '../../../interface/feed.interface';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getMetricEnumLabel,
  getMetricTierTag,
  isMetricTierTag,
} from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import { getPrioritizedEditPermission } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { DeleteType } from '../../common/DeleteWidget/DeleteWidget.interface';
import { getMetricFeedCounts } from '../MetricActivity/MetricFeedCountUtils';
import { useMetricAssetsCount } from '../MetricAssetsTab/useMetricAssetsTab';
import MetricCustomPropertyValue from '../MetricCustomPropertyValue/MetricCustomPropertyValue.component';
import MetricDefinitionCard from '../MetricDefinitionCard/MetricDefinitionCard';
import MetricDeleteDialog, {
  type MetricDeleteMode,
} from '../MetricDeleteDialog/MetricDeleteDialog';
import MetricHeaderInfo from '../MetricHeaderInfo/MetricHeaderInfo';
import MetricHierarchyCard from '../MetricHierarchyCard/MetricHierarchyCard';
import { useMetricHierarchyCard } from '../MetricHierarchyCard/useMetricHierarchyCard';
import MetricMetadataEditor from '../MetricMetadataEditor/MetricMetadataEditor';
import MetricStatusPill from '../MetricStatusPill/MetricStatusPill.component';
import type { MetricDetailsProps } from './MetricDetails.interface';

const MetricActivityTab = lazy(
  () => import('../MetricActivity/MetricActivityTab.component')
);

const EntityLineageTab = lazy(() =>
  import('../../Lineage/EntityLineageTab/EntityLineageTab').then((module) => ({
    default: module.EntityLineageTab,
  }))
);

const MetricApprovalTab = lazy(
  () => import('../MetricApproval/MetricApprovalTab.component')
);
const MetricAssetsTab = lazy(
  () => import('../MetricAssetsTab/MetricAssetsTab.component')
);
const MetricObservabilityTab = lazy(
  () => import('../MetricObservability/MetricObservabilityTab.component')
);

interface MetadataItemProps {
  action?: ReactNode;
  label: string;
  children: ReactNode;
}

type ReferenceAppearance =
  | 'avatar-list'
  | 'avatar-stack'
  | 'badge'
  | 'plain'
  | 'tier';

const getInitials = (value: string) =>
  startCase(value)
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

const MetadataItem = ({ action, label, children }: MetadataItemProps) => (
  <Box
    className="tw:border-b tw:border-secondary tw:pb-3 last:tw:border-b-0 last:tw:pb-0"
    direction="col"
    gap={1}>
    <Box align="center" gap={2} justify="between">
      <Typography
        className="tw:uppercase tw:tracking-wide tw:text-tertiary"
        size="text-xs"
        weight="semibold">
        {label}
      </Typography>
      {action}
    </Box>
    <Box className="tw:min-w-0 tw:flex-wrap tw:text-primary" gap={1}>
      {children}
    </Box>
  </Box>
);

const ReferenceValues = ({
  appearance = 'badge',
  references,
}: {
  appearance?: ReferenceAppearance;
  references?: Metric['owners'];
}) => {
  const { t } = useTranslation();

  if (!references?.length) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('label.empty-dash')}
      </Typography>
    );
  }

  if (appearance === 'avatar-list') {
    return (
      <Box className="tw:w-full" direction="col" gap={2}>
        {references.map((reference) => {
          const name = getEntityName(reference);

          return (
            <Box
              align="center"
              className="tw:min-w-0"
              data-testid={`metric-metadata-person-${reference.id}`}
              gap={2}
              key={reference.id}>
              <span aria-hidden="true">
                <Avatar initials={getInitials(name)} size="xs" />
              </span>
              <Typography
                className="tw:min-w-0 tw:truncate tw:text-primary"
                size="text-sm"
                title={name}
                weight="medium">
                {name}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  }

  if (appearance === 'avatar-stack') {
    return (
      <Box
        aria-label={t('label.reviewer-plural')}
        className="tw:isolate tw:pl-1"
        role="list">
        {references.map((reference) => {
          const name = getEntityName(reference);

          return (
            <span
              aria-label={name}
              className="tw:-ml-2 tw:rounded-full tw:outline-2 tw:outline-bg-primary first:tw:ml-0"
              key={reference.id}
              role="listitem">
              <Avatar initials={getInitials(name)} size="xs" />
            </span>
          );
        })}
      </Box>
    );
  }

  if (appearance === 'plain') {
    return (
      <Typography className="tw:break-words tw:text-primary" size="text-sm">
        {references.map(getEntityName).join(', ')}
      </Typography>
    );
  }

  return (
    <>
      {references.map((reference) => (
        <Badge
          color={appearance === 'tier' ? 'purple' : 'gray'}
          key={reference.id}
          size="sm"
          type="pill-color">
          {getEntityName(reference)}
        </Badge>
      ))}
    </>
  );
};

const EmptyMetadataValue = () => {
  const { t } = useTranslation();

  return (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('label.empty-dash')}
    </Typography>
  );
};

const HeaderMetadataItem = ({
  label,
  leading,
  testId,
  value,
}: {
  label: string;
  leading?: ReactNode;
  testId: string;
  value?: string;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" data-testid={testId} gap={1}>
      {leading}
      <Typography className="tw:text-tertiary" size="text-xs">
        {label}
      </Typography>
      <Typography className="tw:text-secondary" size="text-xs" weight="medium">
        {value || t('label.empty-dash')}
      </Typography>
    </Box>
  );
};

const MetricMetadataRail = ({
  metric,
  onUpdate,
  permissions,
}: {
  metric: Metric;
  onUpdate: MetricDetailsProps['onMetricUpdate'];
  permissions: MetricDetailsProps['metricPermissions'];
}) => {
  const { t } = useTranslation();
  const tier = getMetricTierTag(metric.tags ?? []);
  const glossaryTerms = (metric.tags ?? []).filter(
    ({ source }) => source === TagSource.Glossary
  );
  const tags = (metric.tags ?? []).filter(
    ({ source, tagFQN }) =>
      source !== TagSource.Glossary && !isMetricTierTag(tagFQN)
  );
  const unitLabel =
    metric.customUnitOfMeasurement ??
    (metric.unitOfMeasurement
      ? getMetricEnumLabel(t, metric.unitOfMeasurement)
      : undefined);
  const extensionEntries = Object.entries(metric.extension ?? {});
  const hasAdditionalMetadata =
    Boolean(metric.dataProducts?.length) || extensionEntries.length > 0;

  return (
    <Box
      className="tw:static tw:min-w-0 tw:xl:sticky tw:xl:top-4 tw:xl:self-start"
      data-testid="metric-metadata-rail"
      direction="col"
      gap={3}>
      <Card data-testid="metric-metadata-people-card" size="sm">
        <Card.Content>
          <Box direction="col" gap={3}>
            <MetadataItem
              action={
                <MetricMetadataEditor
                  metric={metric}
                  permissions={permissions}
                  onUpdate={onUpdate}
                />
              }
              label={t('label.owner-plural')}>
              <ReferenceValues
                appearance="avatar-list"
                references={metric.owners}
              />
            </MetadataItem>
            <MetadataItem label={t('label.expert-plural')}>
              <ReferenceValues
                appearance="avatar-list"
                references={metric.experts}
              />
            </MetadataItem>
            <MetadataItem label={t('label.reviewer-plural')}>
              <ReferenceValues
                appearance="avatar-stack"
                references={metric.reviewers}
              />
            </MetadataItem>
          </Box>
        </Card.Content>
      </Card>
      <Card data-testid="metric-metadata-governance-card" size="sm">
        <Card.Content>
          <Box direction="col" gap={3}>
            <MetadataItem label={t('label.domain-plural')}>
              <ReferenceValues appearance="plain" references={metric.domains} />
            </MetadataItem>
            <MetadataItem label={t('label.tier')}>
              <ReferenceValues
                appearance="tier"
                references={
                  tier
                    ? [
                        {
                          id: tier.tagFQN,
                          name: tier.displayName ?? tier.name ?? tier.tagFQN,
                          type: EntityType.TAG,
                        },
                      ]
                    : undefined
                }
              />
            </MetadataItem>
            <MetadataItem
              label={`${t('label.granularity')} & ${t('label.unit')}`}>
              {metric.granularity ? (
                <Badge
                  className="tw:font-mono tw:uppercase"
                  color="gray"
                  size="sm"
                  type="pill-color">
                  {getMetricEnumLabel(t, metric.granularity)}
                </Badge>
              ) : (
                <EmptyMetadataValue />
              )}
              {unitLabel ? (
                <Badge
                  className="tw:font-mono tw:uppercase"
                  color="gray"
                  size="sm"
                  type="pill-color">
                  {unitLabel}
                </Badge>
              ) : (
                <EmptyMetadataValue />
              )}
            </MetadataItem>
          </Box>
        </Card.Content>
      </Card>
      <Card data-testid="metric-metadata-taxonomy-card" size="sm">
        <Card.Content>
          <Box direction="col" gap={3}>
            <MetadataItem label={t('label.glossary-term-plural')}>
              {glossaryTerms.length ? (
                glossaryTerms.map((term) => (
                  <BadgeWithIcon
                    color="blue"
                    iconLeading={BookOpen01}
                    key={term.tagFQN}
                    size="sm"
                    type="pill-color">
                    {term.displayName ?? term.name ?? term.tagFQN}
                  </BadgeWithIcon>
                ))
              ) : (
                <EmptyMetadataValue />
              )}
            </MetadataItem>
            <MetadataItem label={t('label.tag-plural')}>
              {tags.length ? (
                tags.map((tag) => (
                  <BadgeWithIcon
                    color="purple"
                    iconLeading={Tag01}
                    key={tag.tagFQN}
                    size="sm"
                    type="pill-color">
                    {tag.displayName ?? tag.name ?? tag.tagFQN}
                  </BadgeWithIcon>
                ))
              ) : (
                <EmptyMetadataValue />
              )}
            </MetadataItem>
          </Box>
        </Card.Content>
      </Card>
      {hasAdditionalMetadata && (
        <Card data-testid="metric-metadata-additional-card" size="sm">
          <Card.Content>
            <Box direction="col" gap={3}>
              {Boolean(metric.dataProducts?.length) && (
                <MetadataItem label={t('label.data-product-plural')}>
                  <ReferenceValues references={metric.dataProducts} />
                </MetadataItem>
              )}
              {extensionEntries.map(([name, value]) => (
                <MetadataItem key={name} label={name}>
                  <Box
                    className="tw:w-full tw:min-w-0"
                    data-testid={`metric-custom-property-${name}`}
                    direction="col">
                    <MetricCustomPropertyValue value={value} />
                  </Box>
                </MetadataItem>
              ))}
            </Box>
          </Card.Content>
        </Card>
      )}
    </Box>
  );
};

const TabFallback = () => {
  const { t } = useTranslation();

  return (
    <Box
      aria-label={t('label.loading')}
      className="tw:p-4"
      direction="col"
      gap={3}
      role="status">
      <Skeleton height={160} variant="rounded" />
      <Skeleton height={240} variant="rounded" />
    </Box>
  );
};

interface MetricManagementMenuProps {
  canDelete: boolean;
  isDeleted: boolean;
  onDelete: () => void;
  onRestore: () => void;
  onVersion: () => void;
}

const MetricManagementMenu = ({
  canDelete,
  isDeleted,
  onDelete,
  onRestore,
  onVersion,
}: MetricManagementMenuProps) => {
  const { t } = useTranslation();

  if (isDeleted && !canDelete) {
    return null;
  }

  const handleAction = (key: Key) => {
    if (key === 'version') {
      onVersion();
    } else if (key === 'restore') {
      onRestore();
    } else if (key === 'delete') {
      onDelete();
    }
  };

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        aria-label={t('label.more')}
        data-testid="manage-button"
      />
      <Dropdown.Popover data-testid="manage-dropdown-list-container">
        <Dropdown.Menu onAction={handleAction}>
          {!isDeleted && (
            <Dropdown.Item
              data-testid="version-button"
              id="version"
              label={t('label.version')}
            />
          )}
          {isDeleted && canDelete && (
            <Dropdown.Item
              data-testid="restore-button"
              icon={RefreshCcw01}
              id="restore"
              label={t('label.restore')}
            />
          )}
          {canDelete && (
            <Dropdown.Item
              data-testid="delete-button"
              icon={Trash01}
              id="delete"
              label={t('label.delete')}
            />
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const MetricDetails: FC<MetricDetailsProps> = ({
  currentUser,
  metricDetails,
  metricPermissions,
  fetchMetricDetails,
  onDeleteMetric,
  onFollowMetric,
  onMetricUpdate,
  onRestoreMetric,
  onUnFollowMetric,
  onVersionChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { handleOnAsyncEntityDeleteConfirm } = useAsyncDeleteProvider();
  const decodedMetricFqn = metricDetails.fullyQualifiedName ?? '';
  const { tab: activeTab = EntityTabs.OVERVIEW } = useRequiredParams<{
    tab: EntityTabs;
  }>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { count: assetCount } = useMetricAssetsCount(metricDetails.id);
  const breadcrumbHierarchy = useMetricHierarchyCard(metricDetails);

  const isFollowing = metricDetails.followers?.some(
    ({ id }) => id === currentUser?.id
  );
  const canEdit = Boolean(metricPermissions.EditAll && !metricDetails.deleted);
  const canEditLineage =
    getPrioritizedEditPermission(metricPermissions, Operation.EditLineage) &&
    !metricDetails.deleted;
  const headerTier = getMetricTierTag(metricDetails.tags ?? []);
  const updatedTime = metricDetails.updatedAt
    ? getShortRelativeTime(metricDetails.updatedAt)
    : undefined;
  const updatedByInitials = metricDetails.updatedBy
    ? getInitials(metricDetails.updatedBy)
    : undefined;

  const fetchFeedCount = useCallback(async () => {
    if (!decodedMetricFqn) {
      return;
    }

    try {
      setFeedCount(
        await getMetricFeedCounts(decodedMetricFqn, currentUser?.id)
      );
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.entity-feed-fetch-error'));
    }
  }, [currentUser?.id, decodedMetricFqn, t]);

  useEffect(() => {
    if (!decodedMetricFqn) {
      return;
    }
    fetchFeedCount();
  }, [decodedMetricFqn, fetchFeedCount]);

  const handleTabChange = (key: Key | null) => {
    if (key === null) {
      return;
    }
    const tab = String(key);
    if (tab !== activeTab) {
      navigate(getEntityDetailsPath(EntityType.METRIC, decodedMetricFqn, tab), {
        replace: true,
      });
    }
  };

  const handleFollow = async () => {
    try {
      await (isFollowing ? onUnFollowMetric() : onFollowMetric());
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showSuccessToast(t('message.link-copy-to-clipboard'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestoreMetric();
      setIsRestoreOpen(false);
      showSuccessToast(
        t('message.entity-restored-success', {
          entity: getEntityName(metricDetails),
        })
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.entity-restored-error', {
          entity: getEntityName(metricDetails),
        })
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (mode: MetricDeleteMode) => {
    let deletionAccepted = false;
    setIsDeleting(true);
    try {
      await handleOnAsyncEntityDeleteConfirm({
        afterDeleteAction: (isSoftDelete) => {
          deletionAccepted = true;
          onDeleteMetric(Boolean(isSoftDelete));
        },
        deleteType: mode as DeleteType,
        entityId: metricDetails.id,
        entityName: getEntityName(metricDetails),
        entityType: EntityType.METRIC,
        isRecursiveDelete: true,
        onDeleteFailure: fetchMetricDetails,
        prepareType: true,
      });
      if (deletionAccepted) {
        setIsDeleteOpen(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = useMemo(
    () => [
      {
        icon: LayersTwo01,
        key: EntityTabs.OVERVIEW,
        label: t('label.overview'),
      },
      {
        icon: GitBranch01,
        key: EntityTabs.LINEAGE,
        label: t('label.lineage'),
      },
      {
        badge: assetCount,
        icon: Database03,
        key: EntityTabs.ASSETS,
        label: t('label.asset-plural'),
      },
      {
        icon: Speedometer04,
        key: EntityTabs.DATA_OBSERVABILITY,
        label: t('label.observability'),
      },
      {
        badge: feedCount.totalCount,
        icon: Activity,
        key: EntityTabs.ACTIVITY_FEED,
        label: t('label.activity-and-task-plural'),
      },
      {
        icon: Flag01,
        key: EntityTabs.APPROVAL,
        label: `${t('label.approval')} ${t('label.workflow')}`,
      },
    ],
    [assetCount, feedCount.totalCount, t]
  );

  const activeContent = (() => {
    switch (activeTab) {
      case EntityTabs.LINEAGE:
        return (
          <Suspense fallback={<TabFallback />}>
            <EntityLineageTab
              deleted={Boolean(metricDetails.deleted)}
              entity={metricDetails}
              entityType={EntityType.METRIC}
              hasEditAccess={canEditLineage}
            />
          </Suspense>
        );
      case EntityTabs.ASSETS:
        return (
          <Suspense fallback={<TabFallback />}>
            <MetricAssetsTab
              metric={metricDetails}
              permissions={metricPermissions}
              onAssetsChange={fetchMetricDetails}
            />
          </Suspense>
        );
      case EntityTabs.DATA_OBSERVABILITY:
        return (
          <Suspense fallback={<TabFallback />}>
            <MetricObservabilityTab metric={metricDetails} />
          </Suspense>
        );
      case EntityTabs.ACTIVITY_FEED:
        return (
          <Suspense fallback={<TabFallback />}>
            <MetricActivityTab
              canCreateTasks={Boolean(metricPermissions.EditAll)}
              canCreateThread={Boolean(metricPermissions.EditAll)}
              currentUser={currentUser}
              feedCount={feedCount}
              metric={metricDetails}
              metricPermissions={metricPermissions}
              onFeedUpdate={fetchFeedCount}
              onUpdateEntityDetails={fetchMetricDetails}
              onUpdateFeedCount={setFeedCount}
            />
          </Suspense>
        );
      case EntityTabs.APPROVAL:
        return (
          <Suspense fallback={<TabFallback />}>
            <MetricApprovalTab
              currentUser={currentUser}
              metric={metricDetails}
              onStatusChange={fetchMetricDetails}
            />
          </Suspense>
        );
      case EntityTabs.OVERVIEW:
      default:
        return (
          <Box
            className="tw:grid tw:grid-cols-1 tw:gap-6 tw:px-4 tw:py-6 tw:md:px-8 tw:xl:grid-cols-[minmax(0,1fr)_20rem]"
            data-testid="metric-overview">
            <Box
              className="tw:min-w-0"
              data-testid="metric-overview-main"
              direction="col"
              gap={5}>
              <MetricHierarchyCard
                canAddChild={Boolean(metricPermissions.Create)}
                metric={metricDetails}
              />
              <MetricDefinitionCard
                canEdit={canEdit}
                metric={metricDetails}
                onUpdate={onMetricUpdate}
              />
            </Box>
            <MetricMetadataRail
              metric={metricDetails}
              permissions={metricPermissions}
              onUpdate={onMetricUpdate}
            />
          </Box>
        );
    }
  })();

  const title = getEntityName(metricDetails);
  const breadcrumbGroup =
    breadcrumbHierarchy.group ?? metricDetails.metricGroup;
  const groupName = breadcrumbGroup
    ? getEntityName(breadcrumbGroup)
    : undefined;
  const primaryOwnerName = metricDetails.owners?.[0]
    ? getEntityName(metricDetails.owners[0])
    : undefined;
  const primaryOwnerInitials = primaryOwnerName
    ? getInitials(primaryOwnerName)
    : undefined;

  return (
    <main
      className="tw:min-h-full tw:min-w-0 tw:w-full tw:overflow-x-hidden tw:bg-secondary"
      data-testid="metric-details-page">
      <Box
        className="tw:min-w-0 tw:border-b tw:border-secondary tw:bg-primary tw:px-4 tw:pt-4 tw:md:px-8"
        data-testid="metric-header-shell"
        direction="col"
        gap={3}>
        <Breadcrumbs
          autoCollapse
          className="tw:[&>li:not(:first-child):not(:last-child)]:hidden tw:sm:[&>li:not(:first-child):not(:last-child)]:flex"
          data-testid="metric-breadcrumbs"
          items={[
            {
              id: 'governance',
              label: t('label.governance'),
              href: ROUTES.METRICS,
            },
            {
              id: 'metrics',
              label: t('label.metric-plural'),
              href: ROUTES.METRICS,
            },
            ...(groupName
              ? [
                  {
                    id: 'group',
                    label: groupName,
                    href: `${ROUTES.METRICS}?highlight=${encodeURIComponent(
                      breadcrumbGroup?.fullyQualifiedName ?? ''
                    )}`,
                  },
                ]
              : []),
            ...breadcrumbHierarchy.ancestors.map((ancestor) => ({
              id: ancestor.id,
              label: getEntityName(ancestor),
              href: getEntityDetailsPath(
                EntityType.METRIC,
                ancestor.fullyQualifiedName ?? ''
              ),
            })),
            { id: metricDetails.id, label: title },
          ]}
          size="sm"
        />
        <Box
          className="tw:min-w-0 tw:flex-col tw:sm:flex-row tw:sm:flex-wrap"
          data-testid="metric-detail-header"
          gap={4}
          justify="between">
          <Box
            className="tw:w-full tw:min-w-0 tw:items-start tw:sm:flex-1"
            data-testid="metric-header-primary"
            gap={3}>
            <FeaturedIcon
              outlined
              bgColor="white"
              className="tw:shrink-0"
              color="brand"
              data-testid="metric-type-icon"
              icon={Activity}
              radius="lg"
              shape="square"
              size="lg"
              theme="light"
            />
            <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
              <Box
                align="center"
                className="tw:min-w-0 tw:flex-nowrap"
                data-testid="metric-header-fqn"
                gap={1}>
                <Typography
                  as="span"
                  className="tw:min-w-0 tw:break-words tw:font-mono tw:text-tertiary"
                  size="text-xs">
                  {metricDetails.fullyQualifiedName}
                </Typography>
              </Box>
              <Box
                align="center"
                className="tw:min-w-0 tw:flex-wrap"
                data-testid="metric-title-row"
                gap={2}>
                <Typography
                  as="h1"
                  className="tw:min-w-0 tw:break-words tw:text-balance tw:text-primary"
                  size="display-xs"
                  weight="bold">
                  {title}
                </Typography>
                <MetricHeaderInfo
                  metricDetails={metricDetails}
                  status={
                    <MetricStatusPill status={metricDetails.entityStatus} />
                  }
                />
                {metricDetails.deleted && (
                  <Badge
                    color="error"
                    data-testid="deleted-badge"
                    size="sm"
                    type="pill-color">
                    {t('label.deleted')}
                  </Badge>
                )}
              </Box>
              <Typography
                as="p"
                className="tw:max-w-4xl tw:text-pretty tw:text-secondary"
                data-testid="metric-header-description"
                size="text-sm">
                {metricDetails.description ?? t('label.no-description')}
              </Typography>
            </Box>
          </Box>
          <Box
            align="center"
            className="tw:w-full tw:flex-nowrap tw:sm:w-auto tw:sm:flex-wrap"
            data-testid="metric-header-actions"
            gap={2}>
            {!metricDetails.deleted && (
              <Button
                aria-label={
                  isFollowing ? t('label.following') : t('label.follow')
                }
                color={isFollowing ? 'secondary-brand' : 'secondary'}
                iconLeading={Star01}
                size="sm"
                onPress={handleFollow}>
                <span className="tw:hidden tw:sm:inline">
                  {isFollowing ? t('label.following') : t('label.follow')}
                </span>
              </Button>
            )}
            <Button
              aria-label={t('label.share')}
              color="secondary"
              iconLeading={Share07}
              size="sm"
              onPress={handleShare}
            />
            <MetricManagementMenu
              canDelete={Boolean(metricPermissions.Delete)}
              isDeleted={Boolean(metricDetails.deleted)}
              onDelete={() => setIsDeleteOpen(true)}
              onRestore={() => setIsRestoreOpen(true)}
              onVersion={onVersionChange}
            />
          </Box>
        </Box>
        <Box
          align="center"
          className="tw:flex tw:min-w-0 tw:flex-wrap"
          data-testid="metric-header-secondary-metadata"
          gap={4}>
          <HeaderMetadataItem
            label={t('label.owner')}
            leading={
              primaryOwnerInitials ? (
                <span
                  aria-hidden="true"
                  data-testid="metric-header-owner-avatar">
                  <Avatar initials={primaryOwnerInitials} size="xxs" />
                </span>
              ) : (
                <User01
                  aria-hidden="true"
                  className="tw:size-4 tw:text-fg-quaternary"
                  data-testid="metric-header-owner-icon"
                />
              )
            }
            testId="metric-header-owner"
            value={metricDetails.owners?.map(getEntityName).join(', ')}
          />
          <HeaderMetadataItem
            label={t('label.domain')}
            leading={
              <Cube01
                aria-hidden="true"
                className="tw:size-4 tw:text-fg-quaternary"
                data-testid="metric-header-domain-icon"
              />
            }
            testId="metric-header-domain"
            value={metricDetails.domains?.map(getEntityName).join(', ')}
          />
          <HeaderMetadataItem
            label={t('label.tier')}
            leading={
              <Shield01
                aria-hidden="true"
                className="tw:size-4 tw:text-fg-quaternary"
                data-testid="metric-header-tier-icon"
              />
            }
            testId="metric-header-tier"
            value={
              headerTier?.displayName ?? headerTier?.name ?? headerTier?.tagFQN
            }
          />
          {(updatedTime || metricDetails.updatedBy) && (
            <Box align="center" data-testid="metric-header-updated" gap={1}>
              <Clock
                aria-hidden="true"
                className="tw:size-4 tw:text-fg-quaternary"
                data-testid="metric-header-updated-icon"
              />
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('label.updated')}
                {updatedTime ? ` ${updatedTime}` : ''}
                {metricDetails.updatedBy ? ` ${t('label.by-lowercase')}` : ''}
              </Typography>
              {updatedByInitials && (
                <span
                  aria-label={metricDetails.updatedBy}
                  data-testid="metric-header-updater-avatar">
                  <Avatar initials={updatedByInitials} size="xxs" />
                </span>
              )}
            </Box>
          )}
        </Box>
        <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
          <Tabs.List
            aria-label={t('label.metric')}
            className="tw:flex tw:w-full tw:min-w-0 tw:overflow-x-auto"
            data-testid="metric-detail-tabs"
            type="underline">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;

              return (
                <Tabs.Item
                  badge={tab.badge}
                  className="tw:w-auto tw:min-w-0 tw:shrink-0 tw:whitespace-nowrap tw:px-3 tw:text-center tw:font-semibold"
                  data-testid={tab.key}
                  id={tab.key}
                  key={tab.key}>
                  <TabIcon
                    aria-hidden="true"
                    className="tw:size-4 tw:shrink-0"
                    data-testid={`metric-tab-icon-${tab.key}`}
                  />
                  <span>{tab.label}</span>
                </Tabs.Item>
              );
            })}
          </Tabs.List>
        </Tabs>
      </Box>
      <Box
        className="tw:w-full tw:min-w-0"
        data-testid="metric-detail-content"
        direction="col">
        {activeContent}
      </Box>
      <MetricDeleteDialog
        isDeleting={isDeleting}
        isOpen={isDeleteOpen}
        metricName={getEntityName(metricDetails)}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
      />
      {isRestoreOpen && (
        <ModalOverlay
          isOpen
          isDismissable={!isRestoring}
          onOpenChange={(open) =>
            !open && !isRestoring && setIsRestoreOpen(false)
          }>
          <Modal>
            <Dialog
              data-testid="restore-asset-modal"
              showCloseButton={!isRestoring}
              title={t('label.restore-entity', { entity: t('label.metric') })}
              width={480}
              onClose={() => !isRestoring && setIsRestoreOpen(false)}>
              <Dialog.Content>
                <Typography
                  className="tw:text-secondary"
                  data-testid="restore-modal-body"
                  size="text-sm">
                  {t('message.are-you-want-to-restore', {
                    entity: getEntityName(metricDetails),
                  })}
                </Typography>
              </Dialog.Content>
              <Dialog.Footer>
                <Button
                  color="secondary"
                  isDisabled={isRestoring}
                  onPress={() => setIsRestoreOpen(false)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  isLoading={isRestoring}
                  onPress={handleRestore}>
                  {t('label.restore')}
                </Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </main>
  );
};

export default MetricDetails;
