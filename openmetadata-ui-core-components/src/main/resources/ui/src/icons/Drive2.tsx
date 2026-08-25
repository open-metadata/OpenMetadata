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

export const Drive2: FC<Props> = ({
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
      d="M14.753 8.8h.018a3.6 3.6 0 0 1 0 7.2h-8.4a4 4 0 0 1-.384-7.982m8.766.782q.018-.198.018-.4a4.4 4.4 0 0 0-8.784-.382m8.766.782a4.4 4.4 0 0 1-.988 2.4M5.987 8.018Q6.177 8 6.371 8c.9 0 1.732.298 2.4.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Drive2.displayName = 'Drive2';
