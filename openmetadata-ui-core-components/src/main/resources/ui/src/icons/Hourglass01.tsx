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

export const Hourglass01: FC<Props> = ({
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
      d="M10 10 6.439 7.033c-.529-.442-.793-.662-.983-.932a2.5 2.5 0 0 1-.37-.789C5 4.993 5 4.648 5 3.96V1.667M10 10l3.561-2.967c.529-.442.793-.662.983-.932a2.5 2.5 0 0 0 .37-.789C15 4.993 15 4.648 15 3.96V1.667M10 10l-3.561 2.967c-.529.442-.793.662-.983.933a2.5 2.5 0 0 0-.37.789C5 15.008 5 15.352 5 16.04v2.293M10 10l3.561 2.967c.529.442.793.662.983.933a2.5 2.5 0 0 1 .37.789c.086.319.086.663.086 1.352v2.292M3.333 1.667h13.333M3.333 18.333h13.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Hourglass01.displayName = 'Hourglass01';
