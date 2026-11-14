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

export const Successful: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      className="tw:fill-bg-primary"
      d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16"
      fill="#fff"
    />
    <path
      d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <mask height={8} id="a" maskUnits="userSpaceOnUse" width={8} x={6} y={6}>
      <path d="M14 6H6v8h8z" fill="#fff" />
    </mask>
    <g mask="url(#a)">
      <path
        d="M13.333 9.697v.306a3.334 3.334 0 1 1-1.977-3.046m1.977.378L9.999 10.67l-1-1"
        stroke="currentColor"
        strokeWidth={1.125}
      />
    </g>
  </svg>
);
Successful.displayName = 'Successful';
