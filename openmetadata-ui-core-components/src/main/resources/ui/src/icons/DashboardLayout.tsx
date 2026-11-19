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

export const DashboardLayout: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <g
      clipPath="url(#a)"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}>
      <rect height={9.595} rx={1} width={6.807} x={2} y={2.129} />
      <rect
        height={9.595}
        rx={1}
        transform="matrix(1 0 0 -1 11.193 17.875)"
        width={6.807}
      />
      <rect height={3.866} rx={1} width={6.807} x={2} y={14.008} />
      <rect
        height={3.866}
        rx={1}
        transform="matrix(1 0 0 -1 11.193 5.996)"
        width={6.807}
      />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
DashboardLayout.displayName = 'DashboardLayout';
