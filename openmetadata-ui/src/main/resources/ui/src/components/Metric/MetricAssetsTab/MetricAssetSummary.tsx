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
  Badge,
  Box,
  Button,
  Card,
  CloseButton,
  Divider,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUpRight } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  AssetRollup,
  MetricAssetDirection,
} from '../../../generated/api/data/metricObservability';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import MetricHealthPill from '../MetricObservability/MetricHealthPill.component';
import { MetricAssetDetails } from './MetricAssetsTab.types';
import { doesMetricAssetAffectHealth } from './MetricAssetsTab.utils';
import { useMetricAssetLineage } from './useMetricAssetLineage';

interface SummaryListProps {
  emptyText: string;
  label: string;
  values: string[];
}

const SUMMARY_LOADING_PLACEHOLDERS = [
  'description',
  'containment',
  'ownership',
  'classification',
  'lineage',
];

const SummaryList = ({ emptyText, label, values }: SummaryListProps) => (
  <Box direction="col" gap={2}>
    <Typography className="tw:text-tertiary" size="text-xs" weight="semibold">
      {label}
    </Typography>
    {values.length > 0 ? (
      <Box className="tw:flex-wrap" gap={1}>
        {values.map((value) => (
          <Badge color="gray" key={value} size="sm">
            {value}
          </Badge>
        ))}
      </Box>
    ) : (
      <Typography className="tw:text-tertiary" size="text-sm">
        {emptyText}
      </Typography>
    )}
  </Box>
);

export interface MetricAssetSummaryProps {
  details: MetricAssetDetails;
  health?: AssetRollup;
  isLoading?: boolean;
  metricFqn: string;
  relation: MetricAssetDirection;
  onClose: () => void;
}

const MetricAssetSummary = ({
  details,
  health,
  isLoading,
  metricFqn,
  relation,
  onClose,
}: MetricAssetSummaryProps) => {
  const { t } = useTranslation();
  const { asset } = details;
  const affectsHealth = doesMetricAssetAffectHealth(relation);
  const lineage = useMetricAssetLineage(metricFqn, asset.id);
  const assetPath = asset.fullyQualifiedName
    ? getEntityDetailsPath(asset.type as EntityType, asset.fullyQualifiedName)
    : undefined;
  const ownerNames = details.owners.map(getEntityName);
  const domainNames = details.domains.map(getEntityName);

  return (
    <Card
      className="tw:sticky tw:top-4"
      data-testid="metric-asset-summary"
      size="sm">
      <Card.Header
        extra={
          <CloseButton label={t('label.close')} size="sm" onPress={onClose} />
        }
        subtitle={asset.fullyQualifiedName}
        title={getEntityName(asset)}
      />
      <Card.Content className="tw:flex tw:flex-col tw:gap-4">
        {isLoading ? (
          <Box direction="col" gap={3}>
            {SUMMARY_LOADING_PLACEHOLDERS.map((placeholder) => (
              <Skeleton height={38} key={placeholder} variant="rounded" />
            ))}
          </Box>
        ) : (
          <>
            <Typography className="tw:text-tertiary" size="text-sm">
              {details.description || t('label.no-description')}
            </Typography>
            <Box className="tw:grid tw:grid-cols-2 tw:gap-3">
              <Box direction="col" gap={1}>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.direction')}
                </Typography>
                <Typography size="text-sm" weight="medium">
                  {t(`label.${relation.direction}`)}
                </Typography>
              </Box>
              <Box direction="col" gap={1}>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.usage')}
                </Typography>
                <Typography size="text-sm" weight="medium">
                  {details.usageCount ?? t('label.empty-dash')}
                </Typography>
              </Box>
              <Box direction="col" gap={1}>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.health')}
                </Typography>
                {affectsHealth ? (
                  <MetricHealthPill
                    data-testid="metric-asset-summary-health"
                    health={health?.health}
                    score={health?.score}
                  />
                ) : (
                  <Typography className="tw:text-tertiary" size="text-sm">
                    {t('message.metric-asset-not-health-relevant')}
                  </Typography>
                )}
              </Box>
              {affectsHealth && (
                <Box direction="col" gap={1}>
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {t('label.test-plural')}
                  </Typography>
                  <Typography size="text-sm" weight="medium">
                    {health?.total ?? 0} / {health?.failed ?? 0}{' '}
                    {t('label.failed-lowercase')}
                  </Typography>
                </Box>
              )}
            </Box>
            <Divider />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.hierarchy')}
              values={details.containment}
            />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.owner-plural')}
              values={ownerNames}
            />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.domain-plural')}
              values={domainNames}
            />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.tier')}
              values={details.tier ? [details.tier] : []}
            />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.tag-plural')}
              values={details.tags}
            />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.glossary-term-plural')}
              values={details.glossaryTerms}
            />
            <SummaryList
              emptyText={t('label.empty-dash')}
              label={t('label.column-plural')}
              values={details.columns}
            />
            <Box direction="col" gap={2}>
              <Typography
                className="tw:text-tertiary"
                size="text-xs"
                weight="semibold">
                {t('label.columns-feeding-metric')}
              </Typography>
              {lineage.isLoading ? (
                <Skeleton height={36} variant="rounded" />
              ) : lineage.error ? (
                <Alert
                  rightContent={
                    <Button
                      color="link-gray"
                      size="sm"
                      onPress={() => lineage.refetch()}>
                      {t('label.try-again')}
                    </Button>
                  }
                  title={t('server.entity-fetch-error', {
                    entity: t('label.column-plural'),
                  })}
                  variant="warning"
                />
              ) : lineage.columns.length === 0 ? (
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('message.no-data-available')}
                </Typography>
              ) : (
                <ul className="tw:flex tw:flex-col tw:gap-2">
                  {lineage.columns.map((column) => (
                    <li
                      className="tw:text-sm tw:text-secondary"
                      key={`${column.fromColumns.join('|')}::${
                        column.toColumn ?? 'unmapped'
                      }`}>
                      {column.fromColumns.join(', ')} →{' '}
                      {column.toColumn ?? t('label.empty-dash')}
                    </li>
                  ))}
                </ul>
              )}
            </Box>
            {assetPath && (
              <Button
                color="secondary"
                href={assetPath}
                iconTrailing={ArrowUpRight}
                size="sm">
                {t('label.view-entity', { entity: t('label.asset') })}
              </Button>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
};

export default MetricAssetSummary;
