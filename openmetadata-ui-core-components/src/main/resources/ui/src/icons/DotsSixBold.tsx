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

export const DotsSixBold: FC<Props> = ({
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
    <g clipPath="url(#a)" fill="currentColor">
      <path d="M4.688 8.438a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m5.312 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m5.313 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5M4.688 14.063a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m5.312 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m5.313 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5" />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
DotsSixBold.displayName = 'DotsSixBold';
