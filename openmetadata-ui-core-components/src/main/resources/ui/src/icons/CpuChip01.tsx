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

export const CpuChip01: FC<Props> = ({
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
      d="M7.5 1.667v1.667m5-1.667v1.667m-5 13.333v1.667m5-1.667v1.667m4.167-10.833h1.667m-1.667 4.167h1.667M1.667 7.5h1.667m-1.667 4.167h1.667m4 5h5.333c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.272-.536.272-1.236.272-2.636V7.333c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092c-.536-.273-1.236-.273-2.636-.273H7.333c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093c-.273.534-.273 1.234-.273 2.634v5.333c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093c.534.273 1.234.273 2.634.273Zm1.5-4.167h2.333c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.412.091-.878V8.834c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.092-.412-.092-.878-.092H8.834c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.092.178-.092.412-.092.878v2.333c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.092.412.092.878.092Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CpuChip01.displayName = 'CpuChip01';
