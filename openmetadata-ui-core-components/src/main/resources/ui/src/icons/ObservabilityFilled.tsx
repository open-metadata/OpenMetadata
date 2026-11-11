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

export const ObservabilityFilled: FC<Props> = ({
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
    viewBox="0 0 21 21"
    width={size}
    {...props}>
    <g clipPath="url(#a)">
      <path
        d="M17.649 2.75a7 7 0 1 0-.126 10.12"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M14.75 4.75c-1.413 0-3.026.854-4.223 1.65-.992.66-.992 2.04 0 2.7 1.197.796 2.81 1.65 4.224 1.65s3.027-.854 4.224-1.65c.991-.66.991-2.04 0-2.7-1.197-.796-2.81-1.65-4.224-1.65Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path d="M14.75 8.75a1 1 0 1 0 0-2 1 1 0 0 0 0 2" fill="currentColor" />
      <path
        d="M7.75 15.244 5.256 12.75l-3.99 3.99a1.763 1.763 0 0 0 2.494 2.494z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path d="m6.75 13.75 1-1" stroke="currentColor" strokeWidth={1.5} />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h21v21H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
ObservabilityFilled.displayName = 'ObservabilityFilled';
