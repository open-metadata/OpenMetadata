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

export const ActivityAssetCreated: FC<Props> = ({
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
      d="M15.6 10.8v-4c0-2.263 0-3.394-.702-4.097C14.195 2 13.063 2 10.8 2H7.6c-2.263 0-3.394 0-4.097.703S2.8 4.537 2.8 6.8v6.4c0 2.262 0 3.393.703 4.096s1.834.703 4.097.703h4M6 9.2h3.2M6 6h6.4m4.802 9.601h-2.4m0 0h-2.4m2.4 0v2.4m0-2.4v-2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityAssetCreated.displayName = 'ActivityAssetCreated';
