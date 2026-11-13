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

export const Lock01: FC<Props> = ({
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
      d="M13.603 7.6v-2a3.6 3.6 0 1 0-7.2 0v2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.202 7.598h-2.4c-1.868 0-2.802 0-3.51.378A3.2 3.2 0 0 0 3.98 9.289c-.378.707-.378 1.642-.377 3.51 0 1.867 0 2.8.378 3.508a3.2 3.2 0 0 0 1.313 1.313c.707.378 1.641.378 3.509.378h2.4c1.867 0 2.801 0 3.508-.378a3.2 3.2 0 0 0 1.314-1.313c.378-.707.378-1.641.378-3.51 0-1.867 0-2.8-.378-3.508a3.2 3.2 0 0 0-1.314-1.313c-.707-.378-1.64-.378-3.509-.378"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.603 12.8a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Lock01.displayName = 'Lock01';
