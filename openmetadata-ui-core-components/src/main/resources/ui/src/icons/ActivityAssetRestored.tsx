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

export const ActivityAssetRestored: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <g stroke="currentColor">
      <path d="M1.277 7.648A5.002 5.002 0 0 0 11 6a5 5 0 0 0-5-5C3.944 1 2.055 2.486 1.383 4.056" />
      <path d="M6 3.223V6l1.667 1.112M3.499 4.191s-2.046.31-2.357 0c-.31-.31 0-2.357 0-2.357" />
    </g>
  </svg>
);
ActivityAssetRestored.displayName = 'ActivityAssetRestored';
