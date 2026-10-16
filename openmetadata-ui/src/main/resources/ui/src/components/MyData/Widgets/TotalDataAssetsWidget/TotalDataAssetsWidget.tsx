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
import { getSeriesColor } from '@openmetadata/ui-core-components/charts';
import { Calendar } from '@openmetadata/ui-core-components/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { ServiceCategory } from '../../../../enums/service.enum';
import {
  TOTAL_DATA_ASSETS_WINDOW_DAYS,
  TOTAL_DATA_ASSETS_WINDOW_OPTIONS,
  useTotalDataAssets,
} from '../../../../hooks/useTotalDataAssets';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { getEntityNameLabel } from '../../../../utils/EntityNameUtils';
import { useAddServiceAction } from '../../../integration/ConnectionsPage/useAddServiceAction';
import FilterButton from '../Common/TopicWidget/FilterButton';
import ShareBar, { ShareSegment } from '../Common/TopicWidget/ShareBar';
import TopicCard from '../Common/TopicWidget/TopicCard';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import AssetTypeRows from './AssetTypeRows';
import { TOTAL_DATA_ASSETS_TONE } from './TotalDataAssetsWidget.constants';

export type TotalDataAssetsWidgetProps = WidgetCommonProps;

/** How many assets the estate holds, split by asset type, and how that moved. */
const TotalDataAssetsWidget: React.FC<TotalDataAssetsWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [windowDays, setWindowDays] = useState<number>(
    TOTAL_DATA_ASSETS_WINDOW_DAYS
  );
  const {
    totalAssets,
    totalDelta,
    assetTypes,
    fastestGrowing,
    isLoading,
    isFetching,
    isError,
    refetch,
    windowDays: measuredWindowDays,
  } = useTotalDataAssets({ windowDays });
  const { addService, canAddService } = useAddServiceAction(
    ServiceCategory.DATABASE_SERVICES
  );

  // Intl rather than a hardcoded format so separators and the percent sign
  // follow the reader's locale.
  const formats = useMemo(
    () => ({
      count: new Intl.NumberFormat(i18n.language),
      share: new Intl.NumberFormat(i18n.language, {
        maximumFractionDigits: 1,
        style: 'percent',
      }),
      signed: new Intl.NumberFormat(i18n.language, {
        signDisplay: 'exceptZero',
      }),
    }),
    [i18n.language]
  );

  const windowOptions = useMemo(
    () =>
      TOTAL_DATA_ASSETS_WINDOW_OPTIONS.map((days) => ({
        label: t('label.last-n-days', { count: days }),
        value: String(days),
      })),
    [t]
  );

  // Categorical colours come from the charts palette, so a row's swatch and
  // its bar segment can never drift apart.
  const colors = useMemo(
    () => assetTypes.map((_, index) => getSeriesColor(index)),
    [assetTypes]
  );
  const segments = useMemo<ShareSegment[]>(
    () =>
      assetTypes.map((type, index) => ({
        color: colors[index],
        key: type.key,
        name: getEntityNameLabel(type.key),
        value: type.count,
      })),
    // `t` changes with the language. getEntityNameLabel translates through the
    // global instance, so without it the names would not re-translate.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [assetTypes, colors, t]
  );

  // Worded for the selected window — "+4 in the last 30 days" — rather than
  // "this week" whatever the range said.
  const deltaLabel =
    totalDelta === null || totalDelta === 0
      ? undefined
      : t('message.value-in-last-count-days', {
          count: measuredWindowDays,
          value: formats.signed.format(totalDelta),
        });

  const summary = [
    t('message.count-assets-across-asset-types', {
      assets: formats.count.format(totalAssets),
      count: assetTypes.length,
    }),
    fastestGrowing &&
      t('message.entity-grew-fastest', {
        entity: getEntityNameLabel(fastestGrowing.key),
      }),
  ]
    .filter(Boolean)
    .join(' ');

  // Assets arrive only through ingestion; until Data Insights has counted
  // some, there is no split to show.
  const emptyState: TopicEmptyStateConfig | undefined =
    totalAssets === 0
      ? {
          description: t('message.total-data-assets-empty-description'),
          footer: {
            action: canAddService
              ? {
                  label: t('label.add-entity', {
                    entity: t('label.database-service'),
                  }),
                  onPress: addService,
                }
              : undefined,
            meta: t('label.count-asset', { count: 0 }),
          },
          icon: TOTAL_DATA_ASSETS_TONE.icon,
          summary: t('message.no-assets-ingested-yet'),
          title: t('message.no-data-assets-yet'),
        }
      : undefined;

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.explore') }),
        onPress: () => navigate(ROUTES.EXPLORE),
      }}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      status={deltaLabel ? { color: 'blue', label: deltaLabel } : undefined}
      summary={summary}
      title={t('label.total-entity', { entity: t('label.data-asset-plural') })}
      tone={TOTAL_DATA_ASSETS_TONE}
      topicKey={TopicKey.TOTAL_DATA_ASSETS}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!emptyState && (
        <>
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
                data-testid="total-data-assets-total"
                size="text-xl"
                weight="semibold">
                {formats.count.format(totalAssets)}
              </Typography>
            </div>

            <FilterButton
              iconLeading={Calendar}
              label={t('label.range')}
              options={windowOptions}
              testId="total-data-assets-window-filter"
              value={String(windowDays)}
              onChange={(next) => setWindowDays(Number(next))}
            />
          </div>

          <ShareBar
            ariaLabel={t('label.by-entity', { entity: t('label.asset-type') })}
            className="tw:mt-4 tw:h-3"
            dataTestId="total-data-assets-share-bar"
            segments={segments}
            valueFormatter={(value) => formats.count.format(value)}
          />

          {/* Cased in CSS, not in the string: a locale whose script has no case
            must not be handed a pre-uppercased translation. */}
          <Typography
            className="tw:mt-5 tw:block tw:uppercase tw:tracking-wide tw:text-text-tertiary!"
            size="text-xs"
            weight="semibold">
            {t('label.by-entity', { entity: t('label.asset-type') })}
          </Typography>

          <AssetTypeRows
            assetTypes={assetTypes}
            colors={colors}
            formatCount={(value) => formats.count.format(value)}
            formatDelta={(value) => formats.signed.format(value)}
            formatShare={(value) => formats.share.format(value / 100)}
          />
        </>
      )}
    </TopicCard>
  );
};

export default TotalDataAssetsWidget;
