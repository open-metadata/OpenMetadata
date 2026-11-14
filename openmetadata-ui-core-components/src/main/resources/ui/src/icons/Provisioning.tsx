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

export const Provisioning: FC<Props> = ({
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
    <path
      d="M7.739 12.06H6.532c-1.124 0-1.685 0-2.142.138a3.22 3.22 0 0 0-2.146 2.146c-.139.457-.139 1.018-.139 2.141m10.06-10.864a3.621 3.621 0 1 1-7.243 0 3.621 3.621 0 0 1 7.243 0m2.417 5.758v3.31m0 0V18m0-3.31h3.31m-3.31 0h-3.31"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Provisioning.displayName = 'Provisioning';
