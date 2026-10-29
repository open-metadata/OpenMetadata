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

export const GridDotsOuter: FC<Props> = ({
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
      d="M6.25 10h.008m7.492 0h.008M10 10h.008M10 13.75h.008M10 6.25h.008M2.5 6.5v7c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093C4.4 17.5 5.1 17.5 6.5 17.5h7c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.272-.536.272-1.236.272-2.636v-7c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092C15.6 2.5 14.9 2.5 13.5 2.5h-7c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093C2.5 4.4 2.5 5.1 2.5 6.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
GridDotsOuter.displayName = 'GridDotsOuter';
