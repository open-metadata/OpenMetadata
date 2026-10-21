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

export const AppSupportColored: FC<Props> = ({
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
    <rect fill="url(#app-support-colored_a)" height={32} rx={6} width={32} />
    <path
      d="M22.5 16a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M19.61 15.998a3.611 3.611 0 1 1-7.221 0 3.611 3.611 0 0 1 7.222 0M16 12.389V9.5m0 10.111V22.5m3.611-6.5H22.5m-10.111 0H9.5"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-support-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#72EDF2" />
        <stop offset={1} stopColor="#5151E5" />
      </linearGradient>
    </defs>
  </svg>
);
AppSupportColored.displayName = 'AppSupportColored';
