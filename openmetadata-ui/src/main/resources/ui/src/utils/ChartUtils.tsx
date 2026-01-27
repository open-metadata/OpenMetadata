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

import { isNumber, isString } from 'lodash';
import type { SVGProps } from 'react';
import type { Props as CartesianGridProps } from 'recharts/types/cartesian/CartesianGrid';
import { digitFormatter, getStatisticsDisplayValue } from './CommonUtils';

export const tooltipFormatter = (
  value: string | number,
  tickFormatter?: string
): string | number => {
  if (isString(value)) {
    return value;
  }

  return tickFormatter
    ? `${value.toFixed(2)}${tickFormatter}`
    : getStatisticsDisplayValue(value) ?? 0;
};

export const axisTickFormatter = (value: number, tickFormatter?: string) => {
  return tickFormatter ? `${value}${tickFormatter}` : digitFormatter(value);
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

export const percentageFormatter = (value?: number) => {
  return value ? `${value}%` : '';
};

type HorizontalGridLineProps = SVGProps<SVGLineElement> & {
  y?: number;
  height?: number;
};

/**
 * Builds a renderer that hides the outermost horizontal grid lines while keeping Recharts types happy.
 */
export const createHorizontalGridLineRenderer = (
  epsilon = 0.5
): NonNullable<CartesianGridProps['horizontal']> => {
  return (gridLineProps) => {
    const { x1, x2, y1, y2, y, height, stroke, key, strokeDasharray } =
      gridLineProps as HorizontalGridLineProps & {
        x1?: number;
        x2?: number;
        index?: number;
        key?: string | number;
        strokeDasharray?: string;
      };

    const isTopBoundary =
      isNumber(y1) && isNumber(y) && Math.abs(y1 - y) < epsilon;

    const isBottomBoundary =
      isNumber(y1) &&
      isNumber(y) &&
      isNumber(height) &&
      Math.abs(y1 - (y + height)) < epsilon;

    const nextStroke = isTopBoundary || isBottomBoundary ? 'none' : stroke;

    return (
      <line
        fill="none"
        key={key}
        stroke={nextStroke}
        strokeDasharray={strokeDasharray}
        x1={x1}
        x2={x2}
        y1={y1}
        y2={y2}
      />
    );
  };
};
