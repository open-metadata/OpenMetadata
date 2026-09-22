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

export const CheckVerified01: FC<Props> = ({
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="m9 12 2 2 4.5-4.5M7.334 3.819a3.83 3.83 0 0 0 2.18-.904 3.83 3.83 0 0 1 4.972 0c.613.523 1.376.84 2.18.904a3.83 3.83 0 0 1 3.515 3.515 3.82 3.82 0 0 0 .904 2.18 3.83 3.83 0 0 1 0 4.972 3.83 3.83 0 0 0-.904 2.18 3.83 3.83 0 0 1-3.515 3.515 3.83 3.83 0 0 0-2.18.904 3.83 3.83 0 0 1-4.972 0 3.83 3.83 0 0 0-2.18-.904 3.83 3.83 0 0 1-3.515-3.515 3.83 3.83 0 0 0-.904-2.18 3.83 3.83 0 0 1 0-4.972c.523-.613.84-1.376.904-2.18a3.83 3.83 0 0 1 3.515-3.515" />
  </svg>
);
CheckVerified01.displayName = 'CheckVerified01';
