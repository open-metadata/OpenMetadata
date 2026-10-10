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

export const AppWeeklyInsightsDigest: FC<Props> = ({
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
      d="M5.37 14.634v-2.527m4.21 2.527v-7.58m4.21 7.58v-3.369m4.212-6.739a2.526 2.526 0 1 1-5.053 0 2.526 2.526 0 0 1 5.053 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.996 9.158S18 9.444 18 10c0 3.771 0 5.657-1.172 6.828S13.771 18 10 18s-5.657 0-6.828-1.172S2 13.771 2 10s0-5.657 1.172-6.828S6.229 2 10 2h.842"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppWeeklyInsightsDigest.displayName = 'AppWeeklyInsightsDigest';
