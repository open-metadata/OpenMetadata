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

export const AppDataInsightsReportColored: FC<Props> = ({
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
      fill="url(#app-data-insights-report-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="m12.12 17.026 1.91-1.91a.684.684 0 0 1 .968 0l1.085 1.084c.267.268.7.268.968 0l1.91-1.91"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M21.697 16.343v-.684c0-2.903 0-4.355-.901-5.257-.902-.902-2.354-.902-5.257-.902s-4.354 0-5.256.902-.902 2.354-.902 5.257 0 4.355.902 5.257 2.353.902 5.256.902h.684"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="m22.619 22.502-.93-.929m.31-1.548a1.857 1.857 0 1 1-3.714 0 1.857 1.857 0 0 1 3.715 0"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-data-insights-report-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#CE9FFC" />
        <stop offset={1} stopColor="#7367F0" />
      </linearGradient>
    </defs>
  </svg>
);
AppDataInsightsReportColored.displayName = 'AppDataInsightsReportColored';
