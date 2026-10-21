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

export const Users01: FC<Props> = ({
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
      d="M18.333 17.5v-1.667a3.335 3.335 0 0 0-2.5-3.228m-2.916-9.862a3.334 3.334 0 0 1 0 6.182m1.25 8.575c0-1.553 0-2.33-.254-2.942a3.33 3.33 0 0 0-1.803-1.804c-.613-.254-1.39-.254-2.943-.254h-2.5c-1.553 0-2.33 0-2.942.254a3.33 3.33 0 0 0-1.805 1.803c-.253.613-.253 1.39-.253 2.943M11.25 5.833a3.333 3.333 0 1 1-6.667 0 3.333 3.333 0 0 1 6.667 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Users01.displayName = 'Users01';
