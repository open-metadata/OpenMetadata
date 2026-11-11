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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const DistributionKey: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M8.07 5.159c0-.656-.103-1.67.293-2.26.875-1.304 2.73-1.131 3.386.142.32.625.2 1.499.215 2.118m0 0c-.613-.034-2.824-.043-3.894 0-1.012 0-1.218.578-1.372 1.032-.143.511-.288 1.73-.066 3.067.167.851.818 1.226 1.378 1.273.535.046 2.795.028 3.45.028 1.013 0 1.647-.223 1.944-1.244.143-.795.182-2.215-.056-3.124-.315-.908-.95-1.032-1.384-1.032"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={4.088}
      cy={16.246}
      r={1.754}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={10}
      cy={16.246}
      r={1.754}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={15.91}
      cy={16.246}
      r={1.754}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.139 14.524v-3.961m-6.051 3.961v-1.981m.047 0h11.682m.093 1.981v-1.981"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DistributionKey.displayName = 'DistributionKey';
