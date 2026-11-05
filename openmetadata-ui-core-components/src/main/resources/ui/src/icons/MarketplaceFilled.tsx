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

export const MarketplaceFilled: FC<Props> = ({
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
      d="M6 2h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="M6 2h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="M4.667 8.667A2.667 2.667 0 0 0 7.333 6a2.667 2.667 0 0 0 5.334 0A2.667 2.667 0 1 0 18 6a3.5 3.5 0 0 0-3.5-3.5h-9A3.5 3.5 0 0 0 2 6a2.667 2.667 0 0 0 2.667 2.667"
      fill="currentColor"
    />
    <path d="M10 16v-2" stroke="currentColor" strokeWidth={1.5} />
    <path
      d="M6 2h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2 6c0 1.657 1.194 3 2.667 3s2.666-1.343 2.666-3c0 1.657 1.194 3 2.667 3s2.667-1.343 2.667-3c0 1.657 1.194 3 2.666 3C16.806 9 18 7.657 18 6m-8 10v-2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MarketplaceFilled.displayName = 'MarketplaceFilled';
