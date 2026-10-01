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

export const Variable01: FC<Props> = ({
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
      d="M16.325 17.2A16.2 16.2 0 0 0 18 10c0-2.586-.603-5.03-1.675-7.2m-12.65 0A16.2 16.2 0 0 0 2 10a16.2 16.2 0 0 0 1.675 7.2m9.964-9.9h-.072c-.523 0-1.02.23-1.36.63l-4.3 5.042c-.34.4-.836.629-1.359.629h-.072m.896-6.3h1.115c.4 0 .751.266.861.653l1.42 4.994c.11.386.46.653.86.653h1.116"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Variable01.displayName = 'Variable01';
