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

export const AppOnboardingColored: FC<Props> = ({
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
    <rect fill="url(#app-onboarding-colored_a)" height={32} rx={6} width={32} />
    <path
      d="m14.402 11.227-1.663.827c-2.16 1.074-3.239 1.61-3.239 2.487 0 .876 1.08 1.413 3.239 2.486l1.663.827c.786.391 1.18.587 1.598.587s.812-.196 1.598-.587l1.663-.827c2.16-1.073 3.239-1.61 3.239-2.486s-1.08-1.413-3.24-2.487l-1.662-.827c-.786-.39-1.18-.586-1.598-.586s-.812.195-1.598.586"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M12.1 16.813v2.591c.02.46.273.875.67 1.098a15 15 0 0 0 .529.265 6.42 6.42 0 0 0 5.402 0c.103-.049.21-.103.425-.212a1.32 1.32 0 0 0 .772-1.151c.002-.028.002-.057.002-.117v-2.474m2.6-2.273v4.224"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-onboarding-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#B39FFF" />
        <stop offset={1} stopColor="#6A1ED2" />
      </linearGradient>
    </defs>
  </svg>
);
AppOnboardingColored.displayName = 'AppOnboardingColored';
