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

import { Button, Grid } from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  CodeSquare02,
  HeartRounded,
  Star04,
} from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER, ROUTES } from '../../../../constants/constants';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { User } from '../../../../generated/entity/teams/user';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import StatCard from './StatCard';
import { useUserAssetStats } from './useUserAssetStats';

const UserAssetStats: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useTranslation();
  const {
    assetStats,
    incidentStats,
    queryStats,
    requireAttention,
    dataHealthScore,
    isLoading,
    failed,
    refetch,
  } = useUserAssetStats(user);
  const { mostViewed, mostViewedFqn } = queryStats;

  // Link only the table name inside the "Most viewed: {entity}" subtitle when we
  // have its FQN; fall back to plain text otherwise.
  const mostViewedSubtitle = mostViewedFqn ? (
    <Trans
      components={[
        <Link
          className="not-prose tw:text-utility-gray-700 tw:no-underline tw:font-medium"
          key="most-viewed-link"
          to={getEntityDetailsPath(EntityType.TABLE, mostViewedFqn)}
        />,
      ]}
      i18nKey="label.most-viewed-entity-link"
      values={{ entity: mostViewed }}
    />
  ) : (
    t('label.most-viewed-entity', { entity: mostViewed })
  );

  // A tile whose request failed shows a placeholder and a reload instead of a
  // misleading zero; the others keep their values.
  const failedSubtitle = (
    <Button
      color="link-color"
      data-testid="stat-card-reload"
      size="sm"
      onPress={refetch}>
      {t('message.something-went-wrong')} · {t('label.reload')}
    </Button>
  );
  const valueOrPlaceholder = (isFailed: boolean, value: number) =>
    isFailed ? NO_DATA_PLACEHOLDER : value;

  return (
    <Grid className="tw:shrink-0" gap="4">
      <Grid.Item span={6}>
        <StatCard
          isSelected
          breakdown={
            failed.assets
              ? undefined
              : [
                  { label: t('label.table-plural'), value: assetStats.tables },
                  {
                    label: t('label.dashboard-plural'),
                    value: assetStats.dashboards,
                  },
                  {
                    label: t('label.pipeline-plural'),
                    value: assetStats.pipelines,
                  },
                ]
          }
          icon={<Star04 data-icon />}
          label={t('label.asset-owned-plural')}
          loading={isLoading}
          subtitle={failed.assets ? failedSubtitle : undefined}
          testId="stat-card-assets-owned"
          value={valueOrPlaceholder(failed.assets, assetStats.total)}
        />
      </Grid.Item>
      <Grid.Item span={6}>
        <StatCard
          icon={<HeartRounded data-icon />}
          label={t('label.data-health-score')}
          loading={isLoading}
          subtitle={
            failed.health
              ? failedSubtitle
              : t('label.asset-require-attention-count', {
                  count: requireAttention,
                })
          }
          testId="stat-card-data-health"
          to={ROUTES.DATA_QUALITY}
          value={valueOrPlaceholder(failed.health, dataHealthScore)}
        />
      </Grid.Item>
      <Grid.Item span={6}>
        <StatCard
          icon={<AlertTriangle data-icon />}
          label={t('label.open-incidents')}
          loading={isLoading}
          subtitle={
            failed.incidents
              ? failedSubtitle
              : t('label.severity-incidents-open', {
                  severeCount: incidentStats.severity1,
                })
          }
          testId="stat-card-open-incidents"
          to={ROUTES.INCIDENT_MANAGER}
          value={valueOrPlaceholder(failed.incidents, incidentStats.total)}
        />
      </Grid.Item>
      <Grid.Item span={6}>
        <StatCard
          icon={<CodeSquare02 data-icon />}
          label={t('label.queries')}
          loading={isLoading}
          subtitle={failed.queries ? failedSubtitle : mostViewedSubtitle}
          testId="stat-card-queries"
          // Queries have no global page; the most-viewed table's tab is the
          // closest place that lists them.
          to={
            mostViewedFqn
              ? getEntityDetailsPath(
                  EntityType.TABLE,
                  mostViewedFqn,
                  EntityTabs.TABLE_QUERIES
                )
              : undefined
          }
          value={
            queryStats.isPartial && !failed.queries
              ? `${queryStats.count}+`
              : valueOrPlaceholder(failed.queries, queryStats.count)
          }
        />
      </Grid.Item>
    </Grid>
  );
};

export default UserAssetStats;
