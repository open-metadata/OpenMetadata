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

export const Export: FC<Props> = ({
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
      <path d="M2 14.445c0 .827 0 1.24.09 1.58.247.92.966 1.638 1.886 1.885.34.09.753.09 1.58.09h8.888c.827 0 1.24 0 1.58-.09a2.67 2.67 0 0 0 1.885-1.886c.091-.339.091-.752.091-1.579M6 6s2.946-4 4-4 4 4 4 4m-4-3.112v10.667" />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" stroke="none" />
      </clipPath>
    </defs>
  </svg>
);
Export.displayName = 'Export';
