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

export const MessageDotsCircle: FC<Props> = ({
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
      d="M6.25 10h.008M10 10h.008m3.742 0h.008M10 17.5a7.5 7.5 0 1 0-6.952-4.68c.068.167.102.25.117.318a.8.8 0 0 1 .02.183c0 .069-.012.144-.037.294l-.494 2.965c-.052.311-.077.467-.029.578a.42.42 0 0 0 .218.218c.113.048.268.023.578-.029l2.965-.494c.15-.025.225-.037.294-.037a.8.8 0 0 1 .183.02c.067.015.15.049.317.117A7.5 7.5 0 0 0 10 17.5M6.667 10a.417.417 0 1 1-.833 0 .417.417 0 0 1 .833 0m3.75 0a.417.417 0 1 1-.833 0 .417.417 0 0 1 .833 0m3.75 0a.417.417 0 1 1-.833 0 .417.417 0 0 1 .833 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MessageDotsCircle.displayName = 'MessageDotsCircle';
