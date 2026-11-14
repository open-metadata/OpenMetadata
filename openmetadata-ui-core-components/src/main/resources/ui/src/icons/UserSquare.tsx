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

export const UserSquare: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <rect
      height={16}
      rx={2}
      stroke="currentColor"
      strokeWidth={1.3}
      width={16}
      x={2}
      y={2}
    />
    <path
      d="M13.977 14.476a3.74 3.74 0 0 0-3.482-3.447L10 10.996a23 23 0 0 0-.497.019c-1.84.09-3.338 1.624-3.48 3.46m5.965-6.959a1.988 1.988 0 1 1-3.976 0 1.988 1.988 0 0 1 3.976 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
UserSquare.displayName = 'UserSquare';
