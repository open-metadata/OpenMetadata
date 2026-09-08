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

export const SecurityService: FC<Props> = ({
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
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth={1.3}>
      <path d="M5.603 10.242H3.209a1.94 1.94 0 0 1-1.94-1.939V3.939A1.94 1.94 0 0 1 3.21 2h13.576a1.94 1.94 0 0 1 1.94 1.94v4.363a1.94 1.94 0 0 1-1.94 1.94H14.39M4.664 6.074h.01m3.384 0h4.364m.289 6.594h-5.43c-.643 0-1.164.52-1.164 1.164v3.006c0 .642.521 1.163 1.164 1.163h5.43c.643 0 1.164-.52 1.164-1.163v-3.006c0-.643-.521-1.164-1.164-1.164" />
      <path d="M7.766 12.667v-1.163a2.23 2.23 0 1 1 4.46 0v1.163" />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="currentColor" />
      </clipPath>
    </defs>
  </svg>
);
SecurityService.displayName = 'SecurityService';
