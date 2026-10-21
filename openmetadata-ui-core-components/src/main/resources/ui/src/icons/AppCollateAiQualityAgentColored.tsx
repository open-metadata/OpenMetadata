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

export const AppCollateAiQualityAgentColored: FC<Props> = ({
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
      fill="url(#app-collate-ai-quality-agent-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M20.493 14.559v-2.024c0-1.062 0-1.593-.213-2a1.93 1.93 0 0 0-.853-.828c-.418-.207-.965-.207-2.058-.207h-4.166c-1.094 0-1.64 0-2.059.207a1.93 1.93 0 0 0-.853.829c-.213.406-.213.937-.213 2v6.575c0 1.063 0 1.594.213 2 .187.357.486.647.853.829.418.207.965.207 2.059.207h2.408m-.604-6.956h-2.325m1.302 2.53h-1.302m5.207-5.06h-5.207"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M21.454 16.86h-4.7a.47.47 0 0 0-.47.47v1.257a4.12 4.12 0 0 0 2.82 3.913 4.12 4.12 0 0 0 2.82-3.913v-1.258a.47.47 0 0 0-.47-.47"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="m18.203 19.202.67.638 1.563-1.488"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-quality-agent-colored_a"
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
AppCollateAiQualityAgentColored.displayName = 'AppCollateAiQualityAgentColored';
