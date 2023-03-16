/*
 *  Copyright 2022 Collate.
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

import { isString, toString } from 'lodash';
import React from 'react';
import { LegendProps } from 'recharts';
import { getStatisticsDisplayValue } from './CommonUtils';

export const tooltipFormatter = (
  value: string | number,
  tickFormatter?: string
) => {
  if (isString(value)) {
    return value;
  }

  return (
    <>
      {tickFormatter
        ? `${value.toFixed(2)}${tickFormatter}`
        : getStatisticsDisplayValue(value)}
    </>
  );
};

export const renderColorfulLegendText: LegendProps['formatter'] = (
  value,
  entry
) => <span style={{ color: entry?.color }}>{value}</span>;

export const axisTickFormatter = (value: number, tickFormatter?: string) => {
  return tickFormatter
    ? `${value}${tickFormatter}`
    : toString(getStatisticsDisplayValue(value));
};

export const updateActiveChartFilter = (
  dataKey: string,
  prevActiveKeys: string[]
) => {
  const updatedData = [...prevActiveKeys, dataKey];
  if (prevActiveKeys.length && prevActiveKeys.includes(dataKey)) {
    return prevActiveKeys.filter((activeKey) => activeKey !== dataKey);
  }

  return updatedData;
};
