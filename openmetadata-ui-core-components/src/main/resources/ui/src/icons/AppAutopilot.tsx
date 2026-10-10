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

export const AppAutopilot: FC<Props> = ({
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
      d="m13.024 10.724 2.681 1.05c1.547.605 2.32.908 2.295 1.388-.026.48-.833.7-2.447 1.14-.48.131-.721.197-.888.363-.166.167-.232.407-.363.888-.44 1.614-.66 2.421-1.14 2.447s-.783-.748-1.388-2.295l-1.05-2.681c-.633-1.62-.95-2.43-.54-2.84s1.22-.093 2.84.54"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.2 9.2V6.8c0-2.263 0-3.394-.702-4.097C15.795 2 14.663 2 12.4 2H6.8c-2.263 0-3.394 0-4.097.703S2 4.537 2 6.8v4c0 2.263 0 3.395.703 4.098s1.834.703 4.097.703h1.6M2 5.2h15.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppAutopilot.displayName = 'AppAutopilot';
