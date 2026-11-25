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

export const AppMemoryReconciliationColored: FC<Props> = ({
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
      fill="url(#app-memory-reconciliation-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M14.845 22.5q.284-.001.553-.067c.461-.11.692-.164.972-.518.28-.355.28-.72.28-1.453v-9.139c0-.707 0-1.06-.379-1.44l-.003-.004c-.38-.379-.608-.379-1.062-.379a2.89 2.89 0 0 0-2.802 2.181A2.528 2.528 0 0 0 10.91 16a2.53 2.53 0 0 0 .81 4.145 3.25 3.25 0 0 0 3.126 2.355"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M16.649 14.05a2.6 2.6 0 0 1-2.6 2.6m2.601-.654h4.875m-1.3-5.686v.163m.325 0a.325.325 0 1 1-.65 0 .325.325 0 0 1 .65 0"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M20.225 10.473v.325c0 1.225 0 1.838-.38 2.219-.381.38-.994.38-2.22.38h-.975m3.575 8.126v-.325c0-1.226 0-1.839-.38-2.22-.381-.38-.994-.38-2.22-.38h-.975"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M20.225 21.687v-.163m.325 0a.325.325 0 1 0-.65 0 .325.325 0 0 0 .65 0m.974-5.69v.163m.325 0a.325.325 0 1 1-.65 0 .325.325 0 0 1 .65 0"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-memory-reconciliation-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={0}>
        <stop stopColor="#1570EF" />
        <stop offset={1} stopColor="#2E90FA" />
      </linearGradient>
    </defs>
  </svg>
);
AppMemoryReconciliationColored.displayName = 'AppMemoryReconciliationColored';
