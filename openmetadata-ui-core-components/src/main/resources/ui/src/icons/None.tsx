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

export const None: FC<Props> = ({
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
      d="M5.223 2h9.553a2.15 2.15 0 0 1 2.149 2.15v5.014c0 4.155-3.057 7.117-6.925 8.836-3.87-1.72-6.926-4.68-6.926-8.836V4.15A2.15 2.15 0 0 1 5.224 2Z"
      fill="url(#none_a)"
      stroke="#D5D7DA"
    />
    <mask id="none_b" maskUnits="userSpaceOnUse" x={3} y={2}>
      <path
        d="M5.223 2h9.553a2.15 2.15 0 0 1 2.149 2.15v5.014c0 4.155-3.057 7.117-6.925 8.836-3.87-1.72-6.926-4.68-6.926-8.836V4.15A2.15 2.15 0 0 1 5.224 2"
        fill="#fff"
      />
    </mask>
    <g mask="url(#none_b)">
      <path
        d="M10.001 7.016c3.298 0 5.97-1.604 5.97-3.582 0-1.979-2.672-3.582-5.97-3.582s-5.97 1.603-5.97 3.582 2.673 3.582 5.97 3.582"
        fill="#fff"
        opacity={0.3}
      />
      <path
        d="M10 23.734c3.957 0 7.164-1.925 7.164-4.299S13.957 15.137 10 15.137s-7.164 1.924-7.164 4.298S6.043 23.734 10 23.734"
        fill="#EDEEF2"
        opacity={0.28}
      />
    </g>
    <path
      d="m9.997 4.008.898 2.488 2.646.086-2.092 1.624.74 2.54-2.192-1.484-2.192 1.485.74-2.541-2.092-1.624L9.1 6.496z"
      fill="#A4A7AE"
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="none_a"
        x1={3.074}
        x2={3.074}
        y1={2}
        y2={18}>
        <stop stopColor="#fff" />
        <stop offset={1} stopColor="#EDEEF2" />
      </linearGradient>
    </defs>
  </svg>
);
None.displayName = 'None';
