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

export const DashboardService: FC<Props> = ({
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
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth={1.3}>
      <path d="M9.02 3.668H5.676c-1.338 0-2.007 0-2.518.26-.45.23-.815.595-1.044 1.044-.26.511-.26 1.18-.26 2.518v6.69c0 1.337 0 2.006.26 2.517.229.45.594.815 1.044 1.044.51.26 1.18.26 2.518.26h6.689c1.338 0 2.007 0 2.518-.26.45-.229.815-.594 1.044-1.044.26-.511.26-1.18.26-2.518v-3.344m-3.982.796v3.185m-6.37-4.778v4.778M9.02 6.853v7.963m5.911-11.439a2.295 2.295 0 1 1 0 4.591m1.994-3.434 1.22-.698m-1.22 2.976 1.22.697m-3.214-4.132a2.295 2.295 0 1 0 0 4.591m0 0v1.378m-1.994-4.812-1.22-.698m1.22 2.976-1.22.697m3.214-4.132V2" />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
DashboardService.displayName = 'DashboardService';
