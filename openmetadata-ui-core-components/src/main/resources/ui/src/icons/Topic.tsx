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

export const Topic: FC<Props> = ({
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
      d="M10 11.795a1.798 1.798 0 1 0 0-3.596 1.798 1.798 0 0 0 0 3.595M6.405 6.403a5.393 5.393 0 0 0 0 7.19m7.19 0a5.393 5.393 0 0 0 0-7.19M4.158 4.156a8.99 8.99 0 0 0 0 11.685m11.684 0a8.99 8.99 0 0 0 0-11.685"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Topic.displayName = 'Topic';
