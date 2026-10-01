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

export const PieChart01: FC<Props> = ({
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
      d="M17.38 13.11A8.008 8.008 0 1 1 6.8 2.654M17.403 6.93c.32.774.517 1.592.584 2.425.016.206.024.308-.016.401a.42.42 0 0 1-.177.19c-.089.049-.2.049-.422.049h-6.727c-.224 0-.336 0-.422-.044a.4.4 0 0 1-.175-.175c-.044-.085-.044-.198-.044-.422V2.63c0-.223 0-.334.048-.423a.42.42 0 0 1 .191-.176c.093-.041.196-.033.401-.016a8.01 8.01 0 0 1 6.759 4.917"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PieChart01.displayName = 'PieChart01';
