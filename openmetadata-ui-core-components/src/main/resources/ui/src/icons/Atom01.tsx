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

export const Atom01: FC<Props> = ({
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
      d="M10 10h.008m2.938 2.947c-3.905 3.905-8.39 5.752-10.017 4.125-1.628-1.628.219-6.112 4.124-10.018s8.39-5.752 10.017-4.125c1.628 1.627-.219 6.112-4.124 10.017Zm0-5.893c3.905 3.906 5.752 8.391 4.125 10.018-1.628 1.628-6.112-.219-10.018-4.125C3.148 9.042 1.301 4.557 2.928 2.93c1.628-1.628 6.113.219 10.018 4.125ZM10.416 10a.417.417 0 1 1-.833 0 .417.417 0 0 1 .833 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Atom01.displayName = 'Atom01';
