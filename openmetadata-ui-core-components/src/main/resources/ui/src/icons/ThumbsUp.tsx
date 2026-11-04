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

export const ThumbsUp: FC<Props> = ({
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
      d="M5.833 18.333V9.167m-4.167 1.667v5.833a1.667 1.667 0 0 0 1.667 1.667h11.188a2.5 2.5 0 0 0 2.471-2.12l.898-5.833A2.5 2.5 0 0 0 15.419 7.5H12.5a.833.833 0 0 1-.833-.833V3.722a2.055 2.055 0 0 0-2.055-2.055.69.69 0 0 0-.625.407L6.054 8.672a.83.83 0 0 1-.762.495H3.333a1.667 1.667 0 0 0-1.667 1.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ThumbsUp.displayName = 'ThumbsUp';
