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

export const ToolsCapabilities: FC<Props> = ({
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
      d="M15.459 8.789V5.834c0-1.342 0-2.013-.262-2.526a2.4 2.4 0 0 0-1.047-1.047C13.638 2 12.967 2 11.625 2H6.513C5.171 2 4.5 2 3.988 2.261c-.45.23-.817.596-1.047 1.047-.261.513-.261 1.184-.261 2.526v8.306c0 1.342 0 2.013.26 2.525.23.451.597.818 1.048 1.047.512.262 1.183.262 2.525.262H9.07m1.597-8.786H5.874m1.598 3.195H5.874m6.39-6.39h-6.39m8.749 10.66V18m0-1.347c.662 0 1.24-.358 1.552-.89m-1.552.89c-.662 0-1.24-.358-1.551-.89m3.103 0 1.142.666m-1.142-.667a1.79 1.79 0 0 0 0-1.81m-1.552-.89a1.795 1.795 0 0 0-1.551 2.7m0 0-1.142.667m2.693-3.367v-1.347m0 1.347c.662 0 1.24.358 1.552.89m0 0 1.142-.666m-4.245.666-1.142-.666"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ToolsCapabilities.displayName = 'ToolsCapabilities';
