/*
 *  Copyright 2021 Collate
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

import React from 'react';
import { Area, AreaChart, Tooltip } from 'recharts';

type Props = {
  data: Array<{ date: Date | undefined; value: number | undefined }>;
  margin?: { top: number; left: number; right: number; bottom: number };
  toolTipPos?: { x: number; y: number };
  height?: number;
  className?: string;
  width?: number;
};
const TableProfilerGraph = ({
  data,
  margin,
  toolTipPos,
  height,
  className = '',
  width = 150,
}: Props) => {
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active: boolean;
    // eslint-disable-next-line
    payload: any;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="tw-py-1.5 tw-px-1 tw-bg-black tw-opacity-50 tw-rounded tw-text-white tw-text-xs tw-font-medium">
          <div>Value {payload[0].value}</div>
          <div>Date {payload[0].payload.date}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={className}>
      <AreaChart
        data={data}
        height={height ?? 40}
        margin={
          margin ?? {
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }
        }
        width={width}>
        <Tooltip
          content={CustomTooltip}
          cursor={{ stroke: '#FF4C3B', strokeWidth: 2 }}
          offset={20}
          position={toolTipPos ?? { x: 20, y: -40 }}
        />
        <Area
          dataKey="value"
          fill="#7147E8"
          fillOpacity="0.4"
          stroke="#7147E8"
          type="monotone"
        />
      </AreaChart>
    </div>
  );
};

export default TableProfilerGraph;
