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

export const Stars03: FC<Props> = ({
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
      d="M8.859 3.777a.2.2 0 0 1 .379 0l1.226 3.615a.2.2 0 0 0 .125.125l3.615 1.227a.2.2 0 0 1 0 .378L10.59 10.35a.2.2 0 0 0-.125.125L9.238 14.09a.2.2 0 0 1-.38 0l-1.226-3.615a.2.2 0 0 0-.125-.125L3.892 9.122a.2.2 0 0 1 0-.378l3.615-1.227a.2.2 0 0 0 .125-.125zm5.335 8.951a.2.2 0 0 1 .375 0l.39 1.071a.2.2 0 0 0 .12.12l1.071.39a.2.2 0 0 1 0 .376l-1.071.39a.2.2 0 0 0-.12.119l-.39 1.071a.2.2 0 0 1-.376 0l-.39-1.071a.2.2 0 0 0-.119-.12l-1.071-.39a.2.2 0 0 1 0-.375l1.071-.39a.2.2 0 0 0 .12-.12z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Stars03.displayName = 'Stars03';
