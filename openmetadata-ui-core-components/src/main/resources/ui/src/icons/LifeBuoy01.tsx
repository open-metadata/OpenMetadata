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

export const LifeBuoy01: FC<Props> = ({
  size = 20,
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
      d="M7.613 7.613 4.108 4.108m0 11.785 3.533-3.532m4.744.027 3.506 3.506m0-11.785-3.533 3.533M18.333 10c0 4.603-3.731 8.333-8.333 8.333S1.667 14.603 1.667 10 5.398 1.667 10 1.667 18.333 5.398 18.333 10m-5 0a3.333 3.333 0 1 1-6.667 0 3.333 3.333 0 0 1 6.667 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LifeBuoy01.displayName = 'LifeBuoy01';
