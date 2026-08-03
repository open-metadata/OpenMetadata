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
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUpRight, Database01, RefreshCw01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import {
  AssetRollup,
  Direction,
  MetricAssetDirection,
} from '../../../generated/api/data/metricObservability';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../utils/EntityNameUtils';
import Fqn from '../../../utils/Fqn';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import MetricHealthPill from '../MetricObservability/MetricHealthPill.component';
import { MetricAssetDetails } from './MetricAssetsTab.types';
import { doesMetricAssetAffectHealth } from './MetricAssetsTab.utils';

const DIRECTION_LABEL_KEYS: Record<Direction, string> = {
  [Direction.Upstream]: 'label.upstream',
  [Direction.Downstream]: 'label.downstream',
  [Direction.Unrelated]: 'label.unrelated',
};

const DIRECTION_COLORS: Record<Direction, 'brand' | 'gray' | 'success'> = {
  [Direction.Upstream]: 'success',
  [Direction.Downstream]: 'brand',
  [Direction.Unrelated]: 'gray',
};

export interface MetricAssetCardProps {
  details: MetricAssetDetails;
  health?: AssetRollup;
  hasDetailsError?: boolean;
  isDetailsLoading?: boolean;
  isHealthLoading?: boolean;
  isSelected: boolean;
  isActive: boolean;
  relation: MetricAssetDirection;
  showSelection: boolean;
  onActivate: () => void;
  onRetryDetails?: () => void;
  onToggle: () => void;
}

const MetricAssetCard = ({
  details,
  health,
  hasDetailsError,
  isDetailsLoading,
  isHealthLoading,
  isSelected,
  isActive,
  relation,
  showSelection,
  onActivate,
  onRetryDetails,
  onToggle,
}: MetricAssetCardProps) => {
  const { t } = useTranslation();
  const { asset } = details;
  const affectsHealth = doesMetricAssetAffectHealth(relation);
  const assetPath = asset.fullyQualifiedName
    ? getEntityDetailsPath(asset.type as EntityType, asset.fullyQualifiedName)
    : undefined;
  const ownerNames = details.owners.map(getEntityName).join(', ');
  const domainNames = details.domains.map(getEntityName).join(', ');
  const tierName = details.tier ? Fqn.split(details.tier).at(-1) : undefined;

  return (
    <Card data-testid={`metric-asset-card-${asset.id}`} isSelected={isActive}>
      <Card.Content className="tw:flex tw:items-start tw:gap-3">
        {showSelection && (
          <Checkbox
            aria-label={t('label.select-entity', {
              entity: getEntityName(asset),
            })}
            isSelected={isSelected}
            onChange={onToggle}
          />
        )}
        <Box
          align="center"
          className="tw:size-9 tw:shrink-0 tw:justify-center tw:rounded-lg tw:bg-utility-brand-50 tw:text-fg-brand-primary">
          <Database01 aria-hidden="true" size={18} />
        </Box>
        <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
          <Box align="center" className="tw:min-w-0" gap={2}>
            <Button
              aria-label={getEntityName(asset)}
              aria-pressed={isActive}
              className="tw:min-w-0 tw:justify-start"
              color="link-gray"
              data-testid={`metric-asset-activate-${asset.id}`}
              onPress={onActivate}>
              <Typography ellipsis size="text-sm" weight="semibold">
                {getEntityName(asset)}
              </Typography>
            </Button>
            <Badge color="gray" size="xs">
              {getEntityNameLabel(asset.type)}
            </Badge>
            <Badge color={DIRECTION_COLORS[relation.direction]} size="xs">
              {t(DIRECTION_LABEL_KEYS[relation.direction])}
            </Badge>
          </Box>
          {isDetailsLoading ? (
            <Box
              aria-label={t('label.loading')}
              direction="col"
              gap={2}
              role="status">
              <Skeleton height={18} variant="rounded" width="75%" />
              <Skeleton height={18} variant="rounded" width="90%" />
            </Box>
          ) : (
            <>
              {hasDetailsError ? (
                <Box align="center" gap={2} role="alert">
                  <Typography className="tw:text-error-primary" size="text-xs">
                    {t('server.entity-fetch-error', {
                      entity: t('label.asset'),
                    })}
                  </Typography>
                  <Button
                    aria-label={t('label.try-again')}
                    color="link-gray"
                    data-testid={`metric-asset-details-retry-${asset.id}`}
                    iconLeading={RefreshCw01}
                    size="sm"
                    onPress={onRetryDetails}
                  />
                </Box>
              ) : (
                <Typography
                  className="tw:line-clamp-2 tw:text-tertiary"
                  size="text-xs">
                  {details.description || t('label.no-description')}
                </Typography>
              )}
              <Box className="tw:grid tw:grid-cols-1 tw:gap-1 tw:sm:grid-cols-3">
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.owner-plural')}:{' '}
                  {ownerNames || t('label.empty-dash')}
                </Typography>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.domain-plural')}:{' '}
                  {domainNames || t('label.empty-dash')}
                </Typography>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.tier')}: {tierName || t('label.empty-dash')}
                </Typography>
              </Box>
            </>
          )}
          <Box align="center" className="tw:flex-wrap" gap={3}>
            {affectsHealth ? (
              <MetricHealthPill
                data-testid={`metric-asset-health-${asset.id}`}
                health={health?.health}
                isLoading={isHealthLoading}
                score={health?.score}
              />
            ) : (
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('message.metric-asset-not-health-relevant')}
              </Typography>
            )}
            {affectsHealth && (
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('label.test-plural')}: {health?.total ?? 0}
              </Typography>
            )}
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.usage')}:{' '}
              {details.usageCount === undefined
                ? t('label.empty-dash')
                : details.usageCount}
            </Typography>
          </Box>
        </Box>
        {assetPath && (
          <Link
            aria-label={t('label.view-entity', {
              entity: getEntityName(asset),
            })}
            className="tw:rounded-md tw:p-1 tw:text-fg-quaternary tw:outline-focus-ring tw:hover:text-fg-brand-primary tw:focus-visible:outline-2"
            to={assetPath}
            onClick={(event) => event.stopPropagation()}>
            <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
        )}
      </Card.Content>
    </Card>
  );
};

export default MetricAssetCard;
