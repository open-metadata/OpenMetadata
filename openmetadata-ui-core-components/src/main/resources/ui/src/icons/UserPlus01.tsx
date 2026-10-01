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

export const UserPlus01: FC<Props> = ({
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
      d="M10 12.8H6.4c-1.116 0-1.675 0-2.129.139a3.2 3.2 0 0 0-2.133 2.133C2 15.526 2 16.084 2 17.2m13.6 0v-4.8m-2.4 2.4H18m-6-8.4a3.6 3.6 0 1 1-7.2 0 3.6 3.6 0 0 1 7.2 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
UserPlus01.displayName = 'UserPlus01';
