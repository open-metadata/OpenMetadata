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

export const Struct: FC<Props> = ({
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
      d="M2 16.4c0-.753 0-1.13.234-1.365.235-.234.612-.234 1.366-.234h.8c.754 0 1.131 0 1.366.234.234.234.234.611.234 1.366 0 .754 0 1.131-.234 1.366C5.53 18 5.154 18 4.4 18h-.8c-.754 0-1.131 0-1.366-.235C2 17.533 2 17.156 2 16.402Zm12 0c0-.753 0-1.13.234-1.365.235-.234.612-.234 1.366-.234h.8c.754 0 1.131 0 1.366.234.234.234.234.611.234 1.366 0 .754 0 1.131-.234 1.366C17.53 18 17.154 18 16.4 18h-.8c-.754 0-1.131 0-1.366-.235C14 17.533 14 17.156 14 16.402Zm2-2c0-2.647-.518-3.2-3-3.2h-1m-8 3.2c0-2.647.518-3.2 3-3.2h1M10 6v3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.4 2h3.2c1.453 0 1.6.74 1.6 2s-.147 2-1.6 2H8.4c-1.45 0-1.6-.74-1.6-2s.149-2 1.6-2Zm3.6 9.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Struct.displayName = 'Struct';
