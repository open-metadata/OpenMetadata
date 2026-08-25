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

export const SortBy: FC<Props> = ({
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
      d="M9.113 8.223h6.222m-6.222 3.554h4.445m-4.445 3.555h2.667M9.113 4.668h8.889M5.555 16.057c-.35.393-1.28 1.945-1.777 1.945m0 0c-.498 0-1.428-1.552-1.778-1.945m1.778 1.945v-5.334M2 3.945C2.35 3.55 3.28 2 3.778 2m0 0c.498 0 1.428 1.551 1.777 1.945M3.778 2v5.334"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SortBy.displayName = 'SortBy';
