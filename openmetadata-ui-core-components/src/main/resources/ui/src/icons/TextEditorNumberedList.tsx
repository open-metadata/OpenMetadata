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

export const TextEditorNumberedList: FC<Props> = ({
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
      d="M9.168 5h8.333m-8.333 5h8.333m-8.333 5h8.333M2.5 12.5h1.25c.232 0 .348 0 .445.02a1 1 0 0 1 .786.785c.019.097.019.213.019.445s0 .348-.02.445a1 1 0 0 1-.785.786C4.098 15 3.982 15 3.75 15s-.349 0-.445.02a1 1 0 0 0-.786.785c-.019.097-.019.213-.019.445V17c0 .236 0 .354.073.427s.191.073.427.073h2m-2.5-15h1a.25.25 0 0 1 .25.25V7.5m0 0H2.5m1.25 0H5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TextEditorNumberedList.displayName = 'TextEditorNumberedList';
