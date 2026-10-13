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

export const Building01: FC<Props> = ({
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
      d="M10.1 5.005H10m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0M4.398 7.602v8m3.2-8v8m4.804-8v8m3.2-8v8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.481 7.6H2.52a.526.526 0 0 1-.283-.964l5.148-3.384C8.654 2.417 9.29 2 10 2s1.346.417 2.616 1.252l5.148 3.384a.526.526 0 0 1-.283.964m-.249 9.036-.55-.566c-.225-.231-.338-.347-.48-.408-.144-.06-.303-.06-.621-.06H4.419c-.318 0-.477 0-.62.06-.143.061-.256.177-.48.408l-.55.566c-.566.581-.849.872-.75 1.119.1.247.5.247 1.3.247h13.363c.799 0 1.199 0 1.298-.247.1-.247-.183-.538-.748-1.12"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Building01.displayName = 'Building01';
