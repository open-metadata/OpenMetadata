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

export const DataQuality: FC<Props> = ({
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
      d="M14.997 4.727c0 1.505-2.846 2.724-6.358 2.724s-6.358-1.22-6.358-2.724m6.359 7.4c-3.512 0-6.359-1.22-6.359-2.725"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M9.842 17.389q-.585.051-1.203.052c-3.511 0-6.358-1.316-6.358-2.94V4.94C2.281 3.317 5.128 2 8.64 2s6.358 1.317 6.358 2.941v3.71"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.111 10.688h-6.095a.61.61 0 0 0-.61.609v1.63c0 1.85.951 3.533 2.457 4.5a2.23 2.23 0 0 0 2.4 0 5.35 5.35 0 0 0 2.458-4.5v-1.63a.61.61 0 0 0-.61-.61Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m12.898 13.72.869.827 2.027-1.93"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataQuality.displayName = 'DataQuality';
