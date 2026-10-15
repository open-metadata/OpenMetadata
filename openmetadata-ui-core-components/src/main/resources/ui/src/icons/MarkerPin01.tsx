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

export const MarkerPin01: FC<Props> = ({
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
      d="M10 10.833a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 18.333c3.333-3.333 6.667-6.318 6.667-10a6.667 6.667 0 1 0-13.333 0c0 3.682 3.333 6.667 6.667 10Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MarkerPin01.displayName = 'MarkerPin01';
