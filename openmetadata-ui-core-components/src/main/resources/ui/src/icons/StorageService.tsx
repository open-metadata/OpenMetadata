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

export const StorageService: FC<Props> = ({
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
      d="M10 7.136c3.818 0 6.913-1.15 6.913-2.568S13.818 2 10 2 3.086 3.15 3.086 4.568 6.18 7.136 10 7.136"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M3.086 4.566v10.865c0 1.432 3.091 2.568 6.914 2.568s6.913-1.136 6.913-2.568V4.566"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M3.086 10c0 1.432 3.091 2.568 6.914 2.568s6.913-1.136 6.913-2.568"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StorageService.displayName = 'StorageService';
