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
import { Assets, Calendar } from '@openmetadata/ui-core-components/icons';
import { ROUTES } from '../../../../constants/constants';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ConnectorBreakdown from '../Common/TopicWidget/ConnectorBreakdown';
import FilterButton from '../Common/TopicWidget/FilterButton';
import CoverageStat from '../Common/TopicWidget/CoverageStat';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import {
  DATA_ESTATE_WINDOW_DAYS,
  DATA_ESTATE_WINDOW_OPTIONS,
  useDataEstate,
} from '../../../../hooks/useDataEstate';
import { useIsAiMode } from '../../../../hooks/useAppMode';

const TONE = {
  icon: Assets,
  tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
};

export type DataEstateWidgetProps = WidgetCommonProps;

/** How big the estate is, what it is made of, and how well it is described. */
const DataEstateWidget: React.FC<DataEstateWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Coverage is an AI-mode block: the design pairs the figure with an agent's
  // read on why it moved, and without that sentence it is a bare percentage
  // with no action attached. Classic mode gets the estate's size and shape.
  const isAiMode = useIsAiMode();
  const [windowDays, setWindowDays] = useState<number>(DATA_ESTATE_WINDOW_DAYS);
  const {
    totalAssets,
    totalDelta,
    connectors,
    descriptionCoverage,
    descriptionCoverageDelta,
    descriptionCoverageSeries,
    isLoading,
    isError,
  } = useDataEstate({ windowDays });

  // Intl rather than a hardcoded format so grouping separators follow the
  // user's locale, not en-US.
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language]
  );
  const compactFormat = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        maximumFractionDigits: 1,
        notation: 'compact',
      }),
    [i18n.language]
  );

  const assetsAcrossConnectors = t('message.count-assets-across-connectors', {
    connectors: connectors.length,
    count: compactFormat.format(totalAssets),
  });

  const summary = isError
    ? t('message.something-went-wrong')
    : assetsAcrossConnectors;

  // Derived in a callback rather than inline in the JSX: each is a small chain
  // of conditions, and together they put the component over the complexity
  // ceiling.
  const windowOptions = useMemo(
    () =>
      DATA_ESTATE_WINDOW_OPTIONS.map((days) => ({
        label: t('label.last-count-days', { count: days }),
        value: String(days),
      })),
    [t]
  );

  const status = useMemo(() => {
    if (totalDelta === null || totalDelta === 0) {
      return undefined;
    }

    const sign = totalDelta > 0 ? '+' : '';
    const label = t('label.this-week', { defaultValue: 'This week' });

    return {
      color: 'blue' as const,
      label: `${sign}${totalDelta} ${label.toLowerCase()}`,
    };
  }, [totalDelta, t]);

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.explore') }),
        onPress: () => navigate(ROUTES.EXPLORE),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isLoading={isLoading}
      meta={isError ? undefined : assetsAcrossConnectors}
      status={status}
      summary={summary}
      title={t('label.your-data-estate')}
      tone={TONE}
      topicKey={TopicKey.DATA_ESTATE}
      widgetKey={widgetKey}>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          {/* `!` on the colours: Typography renders `.prose`, whose unlayered
            `color` rule is emitted after the Tailwind utilities and would
            otherwise silently win. */}
          <Typography className="tw:text-text-tertiary!" size="text-sm">
            {t('label.total-assets')}
          </Typography>
          <Typography
            className="tw:text-text-primary!"
            data-testid="data-estate-total"
            size="text-xl"
            weight="semibold">
            {numberFormat.format(totalAssets)}
          </Typography>
        </div>

        <FilterButton
          iconLeading={Calendar}
          label={t('label.range')}
          options={windowOptions}
          testId="data-estate-window-filter"
          value={String(windowDays)}
          onChange={(next) => setWindowDays(Number(next))}
        />
      </div>

      <ConnectorBreakdown
        className="tw:mt-4"
        connectors={connectors}
        format={(value) => numberFormat.format(value)}
      />

      {isAiMode && descriptionCoverage !== null && (
        <CoverageStat
          className="tw:mt-5"
          dataTestId="description-coverage"
          delta={descriptionCoverageDelta}
          label={t('label.description-coverage')}
          series={descriptionCoverageSeries}
          value={descriptionCoverage}
        />
      )}
    </TopicCard>
  );
};

export default DataEstateWidget;
