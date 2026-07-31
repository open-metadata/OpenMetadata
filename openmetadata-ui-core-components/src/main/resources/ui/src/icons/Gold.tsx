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
import type { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  size?: number;
}

export const Gold: FC<Props> = ({ size = 24, ...props }) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}>
    <path
      d="M5.22347 2H14.7757C15.3457 2 15.8924 2.22644 16.2955 2.6295C16.6985 3.03257 16.925 3.57924 16.925 4.14925V9.16418C16.925 13.3194 13.8682 16.2806 9.99959 18C6.13093 16.2806 3.07422 13.3194 3.07422 9.16418V4.14925C3.07422 3.57924 3.30066 3.03257 3.70372 2.6295C4.10678 2.22644 4.65345 2 5.22347 2Z"
      fill="url(#gold-gradient)"
      stroke="#C67E17"
      strokeLinejoin="round"
    />
    <mask
      height="16"
      id="gold-mask"
      maskUnits="userSpaceOnUse"
      style={{ maskType: 'luminance' }}
      width="14"
      x="3"
      y="2">
      <path
        d="M5.22347 2H14.7757C15.3457 2 15.8924 2.22644 16.2955 2.6295C16.6985 3.03257 16.925 3.57924 16.925 4.14925V9.16418C16.925 13.3194 13.8682 16.2806 9.99959 18C6.13093 16.2806 3.07422 13.3194 3.07422 9.16418V4.14925C3.07422 3.57924 3.30066 3.03257 3.70372 2.6295C4.10678 2.22644 4.65345 2 5.22347 2Z"
        fill="white"
      />
    </mask>
    <g mask="url(#gold-mask)">
      <path
        d="M10.0014 7.01574C13.2986 7.01574 15.9715 5.41199 15.9715 3.43365C15.9715 1.45532 13.2986 -0.148438 10.0014 -0.148438C6.70418 -0.148438 4.03125 1.45532 4.03125 3.43365C4.03125 5.41199 6.70418 7.01574 10.0014 7.01574Z"
        fill="white"
        opacity={0.3}
      />
      <path
        d="M10.0001 23.7337C13.9568 23.7337 17.1643 21.8092 17.1643 19.4352C17.1643 17.0612 13.9568 15.1367 10.0001 15.1367C6.04345 15.1367 2.83594 17.0612 2.83594 19.4352C2.83594 21.8092 6.04345 23.7337 10.0001 23.7337Z"
        fill="#E39A24"
        opacity={0.28}
      />
    </g>
    <path
      d="M9.99701 4.00781L10.8949 6.49617L13.5409 6.58214L11.4489 8.20602L12.1892 10.7469L9.99701 9.26154L7.80477 10.7469L8.54506 8.20602L6.45312 6.58214L9.0991 6.49617L9.99701 4.00781Z"
      fill="white"
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="gold-gradient"
        x1="3.07422"
        x2="3.07422"
        y1="2"
        y2="18">
        <stop stopColor="#FCD877" />
        <stop offset="1" stopColor="#E39A24" />
      </linearGradient>
    </defs>
  </svg>
);
Gold.displayName = 'Gold';
