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

import { Typography } from '@openmetadata/ui-core-components';
import { RankingDetails } from '@openmetadata/ui-core-components/icons';
import { ROUTES } from '../../../../constants/constants';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import KpiProgressRow from '../Common/TopicWidget/KpiProgressRow';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import {
  KPI_WINDOW_DAYS,
  useKpiProgress,
} from '../../../../hooks/useKpiProgress';

const TONE = {
  icon: RankingDetails,
  tile: 'tw:bg-utility-warning-50 tw:text-utility-warning-600',
};

export type KpiProgressWidgetProps = WidgetCommonProps;

/** Governance targets, their pace, and whether that pace gets there in time. */
const KpiProgressWidget: React.FC<KpiProgressWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kpis, atRiskCount, isError } = useKpiProgress();

  const summary = isError
    ? t('message.something-went-wrong')
    : t('message.count-kpis-tracked', { count: kpis.length });

  return (
    <TopicCard
      action={{
        label: t('label.manage-entity', { entity: t('label.kpi-plural') }),
        onPress: () => navigate(ROUTES.KPI_LIST),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      meta={t('label.last-count-days', { count: KPI_WINDOW_DAYS })}
      status={
        atRiskCount > 0
          ? {
              color: 'warning',
              label: t('message.count-at-risk', { count: atRiskCount }),
            }
          : undefined
      }
      summary={summary}
      title={t('label.key-performance-indicator-plural')}
      tone={TONE}
      topicKey={TopicKey.KPIS}
      widgetKey={widgetKey}>
      {kpis.length === 0 ? (
        // `!` on the colour: Typography renders `.prose`, whose unlayered
        // `color` rule is emitted after the Tailwind utilities.
        <Typography className="tw:text-text-secondary!" size="text-sm">
          {t('message.no-kpis-yet')}
        </Typography>
      ) : (
        <ul
          className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="kpi-rows">
          {kpis.map((kpi) => (
            <KpiProgressRow key={kpi.id} kpi={kpi} />
          ))}
        </ul>
      )}
    </TopicCard>
  );
};

export default KpiProgressWidget;
