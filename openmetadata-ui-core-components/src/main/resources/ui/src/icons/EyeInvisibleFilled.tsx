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

export const EyeInvisibleFilled: FC<Props> = ({
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
      d="M3.43 3.426 16.574 16.57"
      stroke="currentColor"
      strokeWidth={1.333}
    />
    <path
      clipRule="evenodd"
      d="M5.18 5.785a9 9 0 0 0-.883.753A11 11 0 0 0 2.106 9.54a1.05 1.05 0 0 0 0 .916 11 11 0 0 0 2.19 3.002C5.575 14.688 7.457 15.84 10 15.84a7.8 7.8 0 0 0 4.097-1.14l-2.88-2.88a2.19 2.19 0 0 1-3.039-3.038zM16.328 12.8a11 11 0 0 0 1.567-2.344 1.05 1.05 0 0 0 0-.917 11 11 0 0 0-2.191-3.002c-1.279-1.23-3.16-2.382-5.704-2.382a8 8 0 0 0-2.05.265z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);
EyeInvisibleFilled.displayName = 'EyeInvisibleFilled';
