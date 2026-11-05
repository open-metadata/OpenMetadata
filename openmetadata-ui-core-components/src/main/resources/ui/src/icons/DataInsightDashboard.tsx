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

export const DataInsightDashboard: FC<Props> = ({
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
      d="M17.157 9.579v.842c0 3.573 0 5.36-1.109 6.47C14.938 18 13.152 18 9.579 18s-5.36 0-6.47-1.11S2 13.994 2 10.421s0-5.36 1.11-6.469c1.11-1.11 2.896-1.11 6.469-1.11h.842m2.544 1.705a3.19 3.19 0 0 1 2.486 2.486c.005.024.04.024.045 0a3.19 3.19 0 0 1 2.486-2.486c.024-.005.024-.04 0-.045a3.19 3.19 0 0 1-2.486-2.486c-.005-.024-.04-.024-.045 0a3.19 3.19 0 0 1-2.486 2.486c-.024.005-.024.04 0 .045"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m5.625 13.044 2.352-2.352a.84.84 0 0 1 1.19 0l1.336 1.336a.84.84 0 0 0 1.191 0l2.352-2.352"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataInsightDashboard.displayName = 'DataInsightDashboard';
