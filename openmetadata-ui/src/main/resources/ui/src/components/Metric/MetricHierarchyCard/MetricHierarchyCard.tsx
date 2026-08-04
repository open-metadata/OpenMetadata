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
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Activity,
  CornerDownRight,
  LayersTwo01,
  Package,
  Plus,
} from '@untitledui/icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import type { MetricGroup } from '../../../generated/entity/data/metricGroup';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getMetricEnumLabel,
  getMetricTypeBadgeColor,
  METRIC_GRANULARITY_CLASS_NAME,
  METRIC_TYPE_BADGE_CLASS_NAME,
} from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import MetricListHealth from '../MetricListHealth/MetricListHealth.component';
import { useMetricHierarchyCard } from './useMetricHierarchyCard';

interface MetricHierarchyCardProps {
  metric?: Metric;
  canAddChild?: boolean;
}

interface MetricTreeRowProps {
  metric: Metric;
  testId: string;
  isCurrent?: boolean;
  isNested?: boolean;
}

const getOwnerInitials = (owner: NonNullable<Metric['owners']>[number]) => {
  const ownerName = getEntityName(owner).trim();
  const words = ownerName
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .split(/\s+/)
    .filter(Boolean);

  return (
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : ownerName.slice(0, 2)
  ).toUpperCase();
};

const MetricTreeRow = ({
  metric,
  testId,
  isCurrent = false,
  isNested = false,
}: MetricTreeRowProps) => {
  const { t } = useTranslation();
  const content = (
    <>
      <span
        aria-hidden="true"
        className="tw:grid tw:w-5 tw:shrink-0 tw:place-items-center tw:text-fg-quaternary"
        data-testid={isNested ? `${testId}-elbow` : undefined}>
        {isNested && <CornerDownRight className="tw:size-4" />}
      </span>
      <span className="tw:grid tw:size-7 tw:shrink-0 tw:place-items-center tw:rounded-md tw:bg-utility-blue-50 tw:text-utility-blue-700 tw:outline-1 tw:-outline-offset-1 tw:outline-utility-blue-200">
        <Activity aria-hidden="true" className="tw:size-4" />
      </span>
      <span className="tw:min-w-0 tw:flex-1">
        <Typography
          className={isCurrent ? 'tw:text-primary' : 'tw:text-brand-secondary'}
          size="text-sm"
          weight="semibold">
          {getEntityName(metric)}
        </Typography>
        <Box align="center" className="tw:mt-1 tw:flex-wrap" gap={2}>
          {metric.metricType && (
            <Badge
              className={METRIC_TYPE_BADGE_CLASS_NAME}
              color={getMetricTypeBadgeColor(metric.metricType)}
              data-testid={`${testId}-metric-type`}
              size="xs"
              type="color">
              {getMetricEnumLabel(t, metric.metricType)}
            </Badge>
          )}
          {metric.granularity && (
            <>
              {metric.metricType && (
                <span
                  aria-hidden="true"
                  className="tw:size-0.5 tw:rounded-full tw:bg-border-primary"
                  data-testid={`${testId}-separator`}
                />
              )}
              <Typography
                as="span"
                className={`${METRIC_GRANULARITY_CLASS_NAME} tw:font-semibold`}
                data-testid={`${testId}-granularity`}
                size="text-xs">
                {getMetricEnumLabel(t, metric.granularity)}
              </Typography>
            </>
          )}
          {metric.entityStatus && (
            <>
              {(metric.metricType || metric.granularity) && (
                <span
                  aria-hidden="true"
                  className="tw:size-0.5 tw:rounded-full tw:bg-border-primary"
                  data-testid={`${testId}-separator`}
                />
              )}
              <Typography
                as="span"
                className="tw:text-tertiary"
                data-testid={`${testId}-status`}
                size="text-xs">
                {getMetricEnumLabel(t, metric.entityStatus)}
              </Typography>
            </>
          )}
        </Box>
      </span>
      {isCurrent ? (
        <Badge
          className="tw:shrink-0"
          color="brand"
          size="sm"
          type="pill-color">
          {t('label.you-are-here')}
        </Badge>
      ) : (
        <Box align="center" className="tw:shrink-0" gap={2}>
          {metric.owners && metric.owners.length > 0 && (
            <Box align="center" gap={1}>
              {metric.owners.slice(0, 3).map((owner) => (
                <span
                  aria-label={getEntityName(owner)}
                  data-testid={`metric-tree-owner-${metric.id}-${owner.id}`}
                  key={owner.id}
                  role="img"
                  title={getEntityName(owner)}>
                  <Avatar initials={getOwnerInitials(owner)} size="xs" />
                </span>
              ))}
              {metric.owners.length > 3 && (
                <Typography
                  as="span"
                  className="tw:text-tertiary"
                  size="text-xs">
                  +{metric.owners.length - 3}
                </Typography>
              )}
            </Box>
          )}
          <MetricListHealth metricId={metric.id} />
        </Box>
      )}
    </>
  );
  const className = `tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:px-3 tw:py-2.5 ${
    isCurrent ? 'tw:bg-brand-primary_alt' : 'tw:hover:bg-secondary'
  } ${isNested ? 'tw:pl-8' : ''}`;

  return isCurrent ? (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  ) : (
    <Link
      className={`${className} tw:no-underline tw:hover:no-underline`}
      data-testid={testId}
      to={getEntityDetailsPath(
        EntityType.METRIC,
        metric.fullyQualifiedName ?? ''
      )}>
      {content}
    </Link>
  );
};

const GroupRow = ({ group }: { group: MetricGroup }) => {
  const { t } = useTranslation();
  const metricCount = group.metricCount ?? 0;

  return (
    <Link
      className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:px-3 tw:py-2.5 tw:no-underline tw:hover:bg-secondary tw:hover:no-underline"
      data-testid="metric-tree-group"
      to={`${ROUTES.METRICS}?highlight=${encodeURIComponent(
        group.fullyQualifiedName ?? ''
      )}`}>
      <span aria-hidden="true" className="tw:w-5 tw:shrink-0" />
      <span className="tw:grid tw:size-7 tw:shrink-0 tw:place-items-center tw:rounded-md tw:bg-utility-purple-50 tw:text-utility-purple-700">
        <Package aria-hidden="true" className="tw:size-4" />
      </span>
      <span className="tw:min-w-0 tw:flex-1">
        <Typography
          className="tw:text-brand-secondary"
          size="text-sm"
          weight="semibold">
          {getEntityName(group)}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.metric-group')}
        </Typography>
      </span>
      <span
        aria-label={`${metricCount} ${
          metricCount === 1 ? t('label.metric') : t('label.metric-plural')
        }`}>
        <Badge className="tw:gap-1" color="gray" size="sm" type="pill-color">
          <span className="tw:tabular-nums">{metricCount}</span>
          {metricCount === 1 ? t('label.metric') : t('label.metric-plural')}
        </Badge>
      </span>
    </Link>
  );
};

const MetricHierarchyCard: FC<MetricHierarchyCardProps> = ({
  metric: metricProp,
  canAddChild,
}) => {
  const { t } = useTranslation();
  const {
    data: contextMetric,
    permissions,
    isVersionView,
  } = useGenericContext<Metric>();
  const metric = metricProp ?? contextMetric;
  const allowAddChild =
    canAddChild ?? Boolean(permissions.Create && !isVersionView);
  const hierarchy = useMetricHierarchyCard(metric);
  const isStandalone =
    !hierarchy.group &&
    hierarchy.ancestors.length === 0 &&
    hierarchy.siblings.length === 0 &&
    hierarchy.children.length === 0;

  return (
    <Card className="tw:shadow-xs" data-testid="metric-hierarchy-card">
      <Card.Header
        className="tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:gap-4"
        data-testid="metric-hierarchy-header"
        extra={
          allowAddChild ? (
            <Button
              className="tw:border tw:border-dashed tw:border-primary tw:shadow-none tw:after:outline-0"
              color="secondary"
              href={`${ROUTES.ADD_METRIC}?parent=${encodeURIComponent(
                metric.fullyQualifiedName ?? ''
              )}`}
              iconLeading={Plus}
              size="xs">
              {t('label.add-child-metric')}
            </Button>
          ) : undefined
        }
        title={
          <Box align="center" gap={2}>
            <LayersTwo01
              aria-hidden="true"
              className="tw:size-5 tw:text-fg-quaternary"
              data-testid="metric-hierarchy-header-icon"
            />
            {t('label.metric-hierarchy')}
          </Box>
        }
      />
      <Card.Content className="tw:p-2">
        {hierarchy.isPending && (
          <Box
            aria-label={t('label.loading')}
            className="tw:p-2"
            direction="col"
            gap={2}
            role="status">
            <Skeleton height={52} variant="rounded" />
            <Skeleton height={52} variant="rounded" />
          </Box>
        )}
        {!hierarchy.isPending && hierarchy.error && (
          <Alert
            title={t('server.entity-fetch-error', {
              entity: t('label.metric-hierarchy'),
            })}
            variant="error">
            <Button
              color="secondary"
              size="sm"
              onPress={() => hierarchy.refetch()}>
              {t('label.try-again')}
            </Button>
          </Alert>
        )}
        {!hierarchy.isPending && !hierarchy.error && (
          <Box direction="col">
            {isStandalone && (
              <Typography
                className="tw:px-3 tw:py-2 tw:text-tertiary"
                data-testid="metric-tree-empty"
                size="text-sm">
                {t('message.metric-not-in-hierarchy')}
              </Typography>
            )}
            {hierarchy.group && <GroupRow group={hierarchy.group} />}
            {hierarchy.ancestors.map((ancestor) => (
              <MetricTreeRow
                isNested
                key={ancestor.id}
                metric={ancestor}
                testId={`metric-tree-ancestor-${ancestor.id}`}
              />
            ))}
            {hierarchy.siblings.map((sibling) => (
              <MetricTreeRow
                isNested={Boolean(hierarchy.group)}
                key={sibling.id}
                metric={sibling}
                testId={`metric-tree-peer-${sibling.id}`}
              />
            ))}
            {hierarchy.hasMoreSiblings && (
              <Button
                className="tw:self-start tw:ml-8"
                color="link-color"
                data-testid="metric-tree-more-peers"
                isDisabled={hierarchy.isLoadingSiblings}
                size="sm"
                onPress={hierarchy.loadMoreSiblings}>
                {t('label.show-more-entity', {
                  entity: t('label.metric-plural'),
                })}
              </Button>
            )}
            <MetricTreeRow
              isCurrent
              isNested={Boolean(hierarchy.group)}
              metric={metric}
              testId="metric-tree-current"
            />
            {hierarchy.children.map((child) => (
              <MetricTreeRow
                isNested
                key={child.id}
                metric={child}
                testId={`metric-tree-child-${child.id}`}
              />
            ))}
            {hierarchy.hasMoreChildren && (
              <Button
                className="tw:self-start tw:ml-8"
                color="link-color"
                data-testid="metric-tree-more-children"
                isDisabled={hierarchy.isLoadingChildren}
                size="sm"
                onPress={hierarchy.loadMoreChildren}>
                {t('label.show-more-entity', {
                  entity: t('label.variant-plural'),
                })}
              </Button>
            )}
          </Box>
        )}
      </Card.Content>
    </Card>
  );
};

export default MetricHierarchyCard;
