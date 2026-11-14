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

export const BooleanType: FC<Props> = ({
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
    viewBox="0 0 21 20"
    width={size}
    {...props}>
    <rect
      height={10.02}
      rx={2}
      stroke="currentColor"
      strokeWidth={1.3}
      width={10.02}
      x={2.5}
      y={2.48}
    />
    <path
      d="M8.48 12.609v2.911a2 2 0 0 0 2 2h6.02a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-3.825M9.076 5.918 7.51 7.485m0 0L5.934 9.061m1.575-1.576 1.576 1.576M7.51 7.485 5.942 5.918"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m11.91 13.733 1.093 1.093 3.088-3.088"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
BooleanType.displayName = 'BooleanType';
