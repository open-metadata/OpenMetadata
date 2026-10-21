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

export const AppDataInsightsColored: FC<Props> = ({
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
      fill="url(#app-data-insights-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M12.579 20.105v-1.368M16 20.105v-2.052m3.421 2.052v-3.42M9.5 16c0-3.064 0-4.596.952-5.548S12.936 9.5 16 9.5s4.596 0 5.548.952.952 2.484.952 5.548 0 4.596-.952 5.548-2.484.952-5.548.952-4.596 0-5.548-.952S9.5 19.064 9.5 16"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M11.889 15.644c1.474.05 4.818-.173 6.72-3.192m-1.247-.364 1.284-.207c.156-.02.386.104.442.25l.34 1.122"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-data-insights-colored_a"
        x1={32}
        x2={32}
        y1={32}
        y2={0}>
        <stop stopColor="#FA71CD" />
        <stop offset={1} stopColor="#C471F5" />
      </linearGradient>
    </defs>
  </svg>
);
AppDataInsightsColored.displayName = 'AppDataInsightsColored';
