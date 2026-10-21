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

export const Dataflow01: FC<Props> = ({
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
      d="M14.167 16.667H14c-1.4 0-2.1 0-2.635-.272a2.5 2.5 0 0 1-1.092-1.092C10 14.767 10 14.067 10 12.667V7.333c0-1.4 0-2.1.273-2.635a2.5 2.5 0 0 1 1.093-1.092C11.9 3.333 12.6 3.333 14 3.333h.167m0 13.333a1.667 1.667 0 1 0 3.333 0 1.667 1.667 0 0 0-3.333 0m0-13.333a1.667 1.667 0 1 0 3.333 0 1.667 1.667 0 0 0-3.333 0M5.833 10h8.333m-8.333 0A1.667 1.667 0 1 1 2.5 10a1.667 1.667 0 0 1 3.333 0m8.333 0a1.667 1.667 0 1 0 3.333 0 1.667 1.667 0 0 0-3.333 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Dataflow01.displayName = 'Dataflow01';
