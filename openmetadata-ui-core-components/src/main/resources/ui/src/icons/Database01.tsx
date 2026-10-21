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

export const Database01: FC<Props> = ({
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
      d="M17.5 4.167c0 1.381-3.358 2.5-7.5 2.5s-7.5-1.119-7.5-2.5m15 0c0-1.381-3.358-2.5-7.5-2.5s-7.5 1.119-7.5 2.5m15 0v11.667c0 1.383-3.333 2.5-7.5 2.5s-7.5-1.117-7.5-2.5V4.167M17.5 10c0 1.383-3.333 2.5-7.5 2.5S2.5 11.383 2.5 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Database01.displayName = 'Database01';
