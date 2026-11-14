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

export const Trigger: FC<Props> = ({
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
      d="M7.334 12.728V9.876m0 0V6.42c0-.513.447-.889.97-.889s.942.376.942.889l.042 3.162m-1.954.294c-.838.745-1.756 1.606-1.877 1.847-.566.843-.521 1.599.441 2.89a28 28 0 0 0 1.387 1.705c.499.482.364 1.134.364 1.68m1.64-8.416v1.578m0-1.578c.446-.525 1.646-.338 1.898.734m.023.841v-.625a1 1 0 0 0-.02-.202l-.003-.014m0 0 .013.068m-.013-.068c.132-.68 1.606-.585 1.882.482m0 0q.032.124.041.268v.714m-.041-.982c.427-.301.923-.15 1.143-.046.702.244.854.889.837 1.11 0 .935.117 2.886-.271 3.654-.385.836-1.032 1.067-1.057 1.832v.648m-.652-7.198"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.168 7.719a3.196 3.196 0 1 1 4.332-.376"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Trigger.displayName = 'Trigger';
