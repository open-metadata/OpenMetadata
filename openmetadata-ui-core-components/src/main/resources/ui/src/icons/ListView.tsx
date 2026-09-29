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

export const ListView: FC<Props> = ({
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
      d="M7.48 3.863H18M7.48 10H18M7.48 16.137H18M2.329 3.864h-.11m.22 0a.22.22 0 1 1-.439 0 .22.22 0 0 1 .438 0M2.329 10h-.11m.22 0A.22.22 0 1 1 2 10a.22.22 0 0 1 .438 0m-.109 6.137h-.11m.22 0a.22.22 0 1 1-.439 0 .22.22 0 0 1 .438 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ListView.displayName = 'ListView';
