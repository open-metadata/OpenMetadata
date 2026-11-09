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

export const DistributionKeyOff: FC<Props> = ({
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
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth={1.3}>
      <path d="M3.756 15.418V3.801m2.494 9.901-2.493 2.493-2.494-2.493m7.153-9.429h10.319M1.264 9.96h17.472m-10.32 1.935h4.045M8.416 8.086h7.27m-7.27 7.621h2.814" />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
DistributionKeyOff.displayName = 'DistributionKeyOff';
