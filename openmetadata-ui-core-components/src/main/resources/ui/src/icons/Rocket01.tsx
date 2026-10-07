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

export const Rocket01: FC<Props> = ({
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
      d="m10.87 9.196-7.807 7.806m8.643-13.937c1 .664 1.963 1.447 2.862 2.346a18.6 18.6 0 0 1 2.363 2.887m-9.14-1.653L5.43 5.858a.82.82 0 0 0-.791.152L2.29 7.997a.822.822 0 0 0 .247 1.398l2.224.82m5.023 5.023.82 2.224a.822.822 0 0 0 1.398.247l1.987-2.348a.82.82 0 0 0 .152-.79l-.787-2.363m2.73-10.185-4.03.672a2 2 0 0 0-1.137.609L5.484 9.113a3.823 3.823 0 0 0 5.404 5.403l5.808-5.434c.323-.301.537-.7.61-1.136l.671-4.032a1.643 1.643 0 0 0-1.891-1.891"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Rocket01.displayName = 'Rocket01';
