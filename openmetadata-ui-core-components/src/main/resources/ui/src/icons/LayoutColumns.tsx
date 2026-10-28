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

export const LayoutColumns: FC<Props> = ({
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
      d="M5.417 3.75h1.667a1.667 1.667 0 0 1 1.667 1.667v9.167a1.667 1.667 0 0 1-1.667 1.667H5.417a1.667 1.667 0 0 1-1.667-1.667V5.417A1.667 1.667 0 0 1 5.417 3.75m7.5 0h1.667a1.667 1.667 0 0 1 1.667 1.667v9.167a1.667 1.667 0 0 1-1.667 1.667h-1.667a1.667 1.667 0 0 1-1.667-1.667V5.417a1.667 1.667 0 0 1 1.667-1.667"
      stroke="currentColor"
      strokeWidth={1.67}
    />
  </svg>
);
LayoutColumns.displayName = 'LayoutColumns';
