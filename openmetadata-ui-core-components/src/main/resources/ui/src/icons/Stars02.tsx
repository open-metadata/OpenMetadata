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

export const Stars02: FC<Props> = ({
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
      d="M3.75 18.333v-4.167m0-8.333V1.667M1.667 3.75h4.167m-4.167 12.5h4.167M10.833 2.5 9.388 6.258c-.235.611-.352.917-.536 1.173a2.5 2.5 0 0 1-.588.589c-.257.183-.563.3-1.173.535L3.333 10l3.758 1.445c.611.235.917.353 1.173.536.228.162.427.361.589.588.183.257.3.563.535 1.173l1.445 3.758 1.445-3.758c.235-.611.353-.917.536-1.173a2.5 2.5 0 0 1 .588-.589c.257-.182.563-.3 1.173-.535L18.333 10l-3.758-1.445c-.611-.235-.917-.352-1.173-.535a2.5 2.5 0 0 1-.588-.589c-.183-.257-.3-.563-.536-1.173z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Stars02.displayName = 'Stars02';
