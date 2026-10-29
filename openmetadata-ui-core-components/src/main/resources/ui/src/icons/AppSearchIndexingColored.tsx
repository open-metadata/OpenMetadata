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

export const AppSearchIndexingColored: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 32 32"
    width={size}
    {...props}>
    <rect
      fill="url(#app-search-indexing-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M9.5 13.95h2.737M9.5 17.371h2.737M9.5 10.527h10.948m.023 8.919 2.029 2.029m-1.027-4.448a3.421 3.421 0 1 0-6.842 0 3.421 3.421 0 0 0 6.842 0"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-search-indexing-colored_a"
        x1={32}
        x2={32}
        y1={32}
        y2={0}>
        <stop stopColor="#6A85B6" />
        <stop offset={1} stopColor="#BAC8E0" />
      </linearGradient>
    </defs>
  </svg>
);
AppSearchIndexingColored.displayName = 'AppSearchIndexingColored';
