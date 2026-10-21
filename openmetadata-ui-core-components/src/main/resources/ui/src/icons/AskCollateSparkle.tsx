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

export const AskCollateSparkle: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 10 10"
    width={size}
    {...props}>
    <mask
      height={10}
      id="ask-collate-sparkle_b"
      maskUnits="userSpaceOnUse"
      width={11}
      x={0}
      y={0}>
      <path
        d="M4.427.614c.06-.213.411-.213.471 0l.38 1.337a3.66 3.66 0 0 0 2.53 2.527l1.338.386h-.007a.25.25 0 0 1 .179.24.245.245 0 0 1-.179.24l-1.338.385a3.67 3.67 0 0 0-2.53 2.528l-.378 1.337a.24.24 0 0 1-.234.18.25.25 0 0 1-.232-.18l-.38-1.337a3.67 3.67 0 0 0-2.529-2.528L.18 5.344a.25.25 0 0 1-.18-.24c0-.114.073-.213.18-.24l1.338-.386A3.67 3.67 0 0 0 4.047 1.95zM8.211.058c.022-.077.151-.077.173 0l.138.49c.13.45.476.796.926.924l.49.14h-.003a.09.09 0 0 1 .066.089.09.09 0 0 1-.066.087l-.49.14a1.34 1.34 0 0 0-.924.926l-.14.49a.09.09 0 0 1-.085.065.09.09 0 0 1-.085-.065l-.139-.49a1.34 1.34 0 0 0-.926-.925l-.489-.141a.09.09 0 0 1-.065-.087.09.09 0 0 1 .065-.088l.489-.14a1.34 1.34 0 0 0 .926-.925z"
        fill="#D9D9D9"
      />
    </mask>
    <g filter="url(#ask-collate-sparkle_a)" mask="url(#ask-collate-sparkle_b)">
      <path
        d="M9.594 7.29c2.64-2.721 2.611-7.032-.066-9.628S2.541-4.832-.099-2.11s-2.61 7.033.067 9.63c2.676 2.595 6.986 2.493 9.626-.23"
        fill="url(#ask-collate-sparkle_c)"
      />
      <path
        d="M9.594 7.29c2.64-2.721 2.611-7.032-.066-9.628S2.541-4.832-.099-2.11s-2.61 7.033.067 9.63c2.676 2.595 6.986 2.493 9.626-.23"
        fill="url(#ask-collate-sparkle_d)"
      />
      <path
        d="M9.594 7.29c2.64-2.721 2.611-7.032-.066-9.628S2.541-4.832-.099-2.11s-2.61 7.033.067 9.63c2.676 2.595 6.986 2.493 9.626-.23"
        fill="url(#ask-collate-sparkle_e)"
        opacity={0.85}
      />
      <path
        d="M9.594 7.29c2.64-2.721 2.611-7.032-.066-9.628S2.541-4.832-.099-2.11s-2.61 7.033.067 9.63c2.676 2.595 6.986 2.493 9.626-.23"
        fill="url(#ask-collate-sparkle_f)"
      />
    </g>
    <defs>
      <radialGradient
        cx={0}
        cy={0}
        gradientTransform="matrix(4.30216 -4.43577 4.36184 4.23046 .885 1.141)"
        gradientUnits="userSpaceOnUse"
        id="ask-collate-sparkle_d"
        r={1}>
        <stop stopColor="#AFF" stopOpacity={0.9} />
        <stop offset={1} stopColor="#AFF" stopOpacity={0} />
      </radialGradient>
      <radialGradient
        cx={0}
        cy={0}
        gradientTransform="matrix(4.30216 -4.43577 4.36184 4.23046 .885 1.141)"
        gradientUnits="userSpaceOnUse"
        id="ask-collate-sparkle_f"
        r={1}>
        <stop stopColor="#AFF" stopOpacity={0.9} />
        <stop offset={1} stopColor="#AFF" stopOpacity={0} />
      </radialGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="ask-collate-sparkle_c"
        x1={-2.96}
        x2={12.426}
        y1={1.81}
        y2={3.622}>
        <stop stopColor="#0EF" />
        <stop offset={0.3} stopColor="#0AF" />
        <stop offset={0.6} stopColor="#42F" />
        <stop offset={1} stopColor="#C4F" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="ask-collate-sparkle_e"
        x1={-2.96}
        x2={12.426}
        y1={1.81}
        y2={3.622}>
        <stop stopColor="#0EF" />
        <stop offset={0.3} stopColor="#0AF" />
        <stop offset={0.6} stopColor="#42F" />
        <stop offset={1} stopColor="#C4F" />
      </linearGradient>
      <filter
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
        height={17.621}
        id="ask-collate-sparkle_a"
        width={17.615}
        x={-4.06}
        y={-6.22}>
        <feFlood floodOpacity={0} result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feGaussianBlur
          result="effect1_foregroundBlur_22821_1383"
          stdDeviation={1}
        />
      </filter>
    </defs>
  </svg>
);
AskCollateSparkle.displayName = 'AskCollateSparkle';
