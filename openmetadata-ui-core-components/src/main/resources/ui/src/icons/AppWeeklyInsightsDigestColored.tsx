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

export const AppWeeklyInsightsDigestColored: FC<Props> = ({
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
      fill="url(#app-weekly-insights-digest-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M11.555 20.444v-2.425m4.042 2.425v-7.276m4.042 7.276V17.21m4.041-6.464a2.425 2.425 0 1 1-4.85 0 2.425 2.425 0 0 1 4.85 0"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M23.677 15.192s.003.274.003.808c0 3.62 0 5.43-1.124 6.556C21.43 23.68 19.62 23.68 16 23.68s-5.43 0-6.555-1.124S8.32 19.62 8.32 16s0-5.43 1.125-6.555S12.38 8.32 16 8.32h.809"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-weekly-insights-digest-colored_a"
        x1={48}
        x2={16}
        y1={16}
        y2={-16}>
        <stop stopColor="#764BA2" />
        <stop offset={1} stopColor="#667EEA" />
      </linearGradient>
    </defs>
  </svg>
);
AppWeeklyInsightsDigestColored.displayName = 'AppWeeklyInsightsDigestColored';
