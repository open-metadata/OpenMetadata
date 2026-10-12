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

export const ActivityOwnerChanged: FC<Props> = ({
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
      d="M7.806 11.522H6.663c-1.063 0-1.595 0-2.027.13a3.05 3.05 0 0 0-2.032 2.032c-.131.432-.131.964-.131 2.027m9.523-10.283a3.428 3.428 0 1 1-6.856-.001 3.428 3.428 0 0 1 6.856 0m2.24 6.455a2.352 2.352 0 1 1 0 4.706m2.043-3.52 1.251-.715m-1.25 3.05 1.25.714m-3.294-4.235a2.352 2.352 0 1 0 0 4.706m0 0V18m-2.043-4.932-1.252-.715m1.251 3.05-1.25.714m3.294-4.235v-1.411"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityOwnerChanged.displayName = 'ActivityOwnerChanged';
