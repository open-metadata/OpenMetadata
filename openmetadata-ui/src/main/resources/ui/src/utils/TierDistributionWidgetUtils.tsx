/*
 *  Copyright 2025 Collate.
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
import { t } from 'i18next';
import { sortBy } from 'lodash';
import React from 'react';
import { BarProps } from 'recharts';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';

export const getTierDistributionData = (
  chartsData: DataInsightCustomChartResult
): DataInsightCustomChartResult['results'] => {
  const data = sortBy(chartsData.results, 'day').reverse();

  const lastDay = data[0].day;

  const lastDayData = data.filter((chart) => chart.day === lastDay);

  const lastDayModifiedData = lastDayData.map((chart) => ({
    ...chart,
    group:
      chart.group === 'NoTier'
        ? t('label.no-entity', { entity: t('label.tier') })
        : chart.group.replace(/^Tier./g, ''),
  }));

  const noTierData = lastDayModifiedData.filter(
    (chart) => chart.group === t('label.no-entity', { entity: t('label.tier') })
  );

  const otherTierData = lastDayModifiedData.filter(
    (chart) => chart.group !== t('label.no-entity', { entity: t('label.tier') })
  );

  return [...noTierData, ...sortBy(otherTierData, 'group')];
};

export const getBarPathWithRoundedCorner = (
  x: number,
  y: number,
  width: number,
  height: number
) => {
  if (height === 0) {
    return '';
  }

  const radius = 4;

  return `M${x + radius},${y + height}
      H${x + width - radius}
      Q${x + width},${y + height} ${x + width},${y + height - radius}
      V${y + radius}
      Q${x + width},${y} ${x + width - radius},${y}
      H${x + radius}
      Q${x},${y} ${x},${y + radius}
      V${y + height - radius}
      Q${x},${y + height} ${x + radius},${y + height}
      Z`;
};

export const RoundedCornerBar = (
  props: Pick<BarProps, 'fill' | 'x' | 'y' | 'width' | 'height'>
) => {
  const { fill, x, y, width, height } = props;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null;
  }

  return (
    <path
      d={getBarPathWithRoundedCorner(x, y, width, height)}
      fill={fill}
      stroke="none"
    />
  );
};
