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

export const Duplicate: FC<Props> = ({
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
    <rect
      rx={2.5}
      stroke="currentColor"
      strokeDasharray="2.6 2.6"
      strokeWidth={1.3}
      x={2.004}
      y={6.391}
    />
    <path
      d="M4.668 5.991V4.5a2.5 2.5 0 0 1 2.5-2.5h8.333A2.5 2.5 0 0 1 18 4.5v8.333a2.5 2.5 0 0 1-2.5 2.5h-1.497"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.336 2.001h7.666a3 3 0 0 1 3 3v7.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Duplicate.displayName = 'Duplicate';
