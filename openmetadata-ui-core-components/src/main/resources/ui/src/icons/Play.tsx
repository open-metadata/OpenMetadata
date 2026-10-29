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

export const Play: FC<Props> = ({
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
      d="M4.167 4.158c0-.81 0-1.214.168-1.438a.83.83 0 0 1 .615-.329c.279-.017.617.208 1.29.657l8.763 5.842c.557.372.835.557.932.791a.83.83 0 0 1 0 .638c-.097.233-.375.419-.932.79L6.24 16.951c-.674.45-1.011.674-1.29.658a.83.83 0 0 1-.615-.329c-.168-.224-.168-.63-.168-1.438z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Play.displayName = 'Play';
