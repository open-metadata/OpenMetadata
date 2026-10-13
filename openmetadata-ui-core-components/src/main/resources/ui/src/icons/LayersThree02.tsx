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

export const LayersThree02: FC<Props> = ({
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
      d="M5.977 7.988 2.31 9.821a.2.2 0 0 0 0 .358l7.402 3.7c.105.054.158.08.213.09q.075.015.149 0a1 1 0 0 0 .214-.09l7.401-3.7a.2.2 0 0 0 0-.358l-3.666-1.833m-8.047 4.024L2.31 13.845a.2.2 0 0 0 0 .358l7.402 3.7c.105.053.158.08.213.09q.075.015.149 0a1 1 0 0 0 .214-.09l7.401-3.7a.2.2 0 0 0 0-.358l-3.666-1.833m-4.31-2.156-7.402-3.7a.2.2 0 0 1 0-.359l7.402-3.7a1 1 0 0 1 .213-.09q.075-.015.149 0c.055.01.108.037.214.09l7.401 3.7a.2.2 0 0 1 0 .358l-7.4 3.701a1 1 0 0 1-.214.09q-.075.013-.149 0a1 1 0 0 1-.213-.09"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LayersThree02.displayName = 'LayersThree02';
