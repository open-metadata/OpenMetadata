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

export const ApiService: FC<Props> = ({
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
      d="M7.872 7.617 6 10l1.872 2.383m4.256-4.766L14 10l-1.872 2.383"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.333 3.777H4.667A2.667 2.667 0 0 0 2 6.444v7.111a2.667 2.667 0 0 0 2.667 2.667h10.666A2.667 2.667 0 0 0 18 13.555V6.444a2.667 2.667 0 0 0-2.667-2.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ApiService.displayName = 'ApiService';
