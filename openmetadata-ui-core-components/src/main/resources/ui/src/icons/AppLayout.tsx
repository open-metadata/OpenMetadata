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

export const AppLayout: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 89 89"
    width={size}
    {...props}>
    <path
      d="M0 28C0 12.536 12.536 0 28 0h33c15.464 0 28 12.536 28 28v33c0 15.464-12.536 28-28 28H28C12.536 89 0 76.464 0 61z"
      fill="#FFF6ED"
    />
    <path
      d="M35.75 55.75V47m0-5v-8.75m8.75 22.5V44.5m0-5v-6.25m8.75 22.5V49.5m0-5V33.25M32 47h7.5m1.25-7.5h7.5m1.25 10H57"
      stroke="#C4320A"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);
AppLayout.displayName = 'AppLayout';
