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

export const Marketplace: FC<Props> = ({
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
    <rect
      height={16}
      rx={4}
      stroke="currentColor"
      strokeWidth={1.3}
      width={16}
      x={2}
      y={2}
    />
    <path
      d="M2 6c0 1.657 1.194 3 2.667 3s2.666-1.343 2.666-3c0 1.657 1.194 3 2.667 3s2.667-1.343 2.667-3c0 1.657 1.194 3 2.666 3C16.806 9 18 7.657 18 6m-8 10v-2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Marketplace.displayName = 'Marketplace';
