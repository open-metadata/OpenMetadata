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

export const Lock01: FC<Props> = ({
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
      d="M14.167 8.333V6.667a4.167 4.167 0 0 0-8.334 0v1.667M10 12.084v1.667M7.333 17.5h5.333c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.273-.536.273-1.236.273-2.636v-1.167c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092c-.536-.273-1.236-.273-2.636-.273H7.333c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093c-.273.534-.273 1.234-.273 2.634V13.5c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093c.534.272 1.234.272 2.634.272"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Lock01.displayName = 'Lock01';
