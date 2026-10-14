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

export const LayersThree01: FC<Props> = ({
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
      d="m1.667 10 8.035 4.018c.109.055.164.083.222.093q.076.015.153 0a.8.8 0 0 0 .222-.092L18.333 10M1.667 14.167l8.035 4.018c.109.055.164.083.222.093q.077.015.153 0a.8.8 0 0 0 .222-.092l8.034-4.019M1.667 5.833l8.035-4.017a.8.8 0 0 1 .222-.092.4.4 0 0 1 .153 0 1 1 0 0 1 .222.092l8.034 4.017-8.035 4.018a1 1 0 0 1-.222.093.4.4 0 0 1-.153 0 .8.8 0 0 1-.222-.092z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LayersThree01.displayName = 'LayersThree01';
