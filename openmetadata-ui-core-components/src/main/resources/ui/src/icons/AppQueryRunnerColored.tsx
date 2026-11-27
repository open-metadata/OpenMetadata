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

export const AppQueryRunnerColored: FC<Props> = ({
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
      fill="url(#app-query-runner-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M17.95 10.8h-3.9c-2.145 0-3.217 0-3.884.667-.666.666-.666 1.739-.666 3.884v1.3c0 2.145 0 3.217.666 3.884.667.666 1.74.666 3.884.666h3.9c2.145 0 3.217 0 3.884-.666.666-.667.666-1.74.666-3.884v-1.3c0-2.145 0-3.218-.666-3.884-.667-.666-1.74-.666-3.884-.666m-8.124 2.601h12.35M16 18.602h2.6"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="m12.75 16 .797.687c.335.289.503.433.503.613s-.168.324-.503.613l-.797.687"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-query-runner-colored_a"
        x1={17.799}
        x2={32}
        y1={15.038}
        y2={43.25}>
        <stop stopColor="#FCB69F" />
        <stop offset={1} stopColor="#FFECD2" />
      </linearGradient>
    </defs>
  </svg>
);
AppQueryRunnerColored.displayName = 'AppQueryRunnerColored';
