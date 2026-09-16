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

export const Dashboards: FC<Props> = ({
  size = 24,
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
      d="M6.444 10.889v3.555m7.112-5.333v5.333M10 5.556v8.888M6.267 18h7.466c1.494 0 2.24 0 2.811-.29.502-.256.91-.664 1.165-1.166.291-.57.291-1.317.291-2.81V6.266c0-1.494 0-2.24-.29-2.811a2.67 2.67 0 0 0-1.166-1.165C15.974 2 15.227 2 13.734 2H6.266c-1.494 0-2.24 0-2.811.29-.502.256-.91.664-1.165 1.166C2 4.026 2 4.773 2 6.266v7.467c0 1.494 0 2.24.29 2.811.256.502.664.91 1.166 1.165.57.291 1.317.291 2.81.291"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Dashboards.displayName = 'Dashboards';
