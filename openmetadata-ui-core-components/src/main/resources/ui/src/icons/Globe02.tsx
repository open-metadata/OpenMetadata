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

export const Globe02: FC<Props> = ({
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
      d="M10 1.667A12.75 12.75 0 0 1 13.333 10 12.75 12.75 0 0 1 10 18.333m0-16.667a12.75 12.75 0 0 0-3.333 8.333A12.75 12.75 0 0 0 10 18.332m0-16.667C5.398 1.667 1.667 5.398 1.667 10S5.398 18.333 10 18.333m0-16.667a8.333 8.333 0 0 1 0 16.666M2.083 7.5h15.833m-15.833 5h15.833"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Globe02.displayName = 'Globe02';
