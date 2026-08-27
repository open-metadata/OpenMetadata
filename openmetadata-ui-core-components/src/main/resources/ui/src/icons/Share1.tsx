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

export const Share1: FC<Props> = ({
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
      d="M7.895 3.938h-.843c-2.381 0-3.572 0-4.312.71S2 6.5 2 8.788v3.233c0 2.287 0 3.43.74 4.14s1.93.71 4.312.71h3.401c2.382 0 3.573 0 4.313-.71.479-.46.648-1.102.707-2.119"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.369 5.958V3.415c0-.158.133-.286.297-.286.08 0 .155.03.21.084l3.826 3.672a.96.96 0 0 1 .298.69.96.96 0 0 1-.298.69l-3.825 3.672a.3.3 0 0 1-.21.084.29.29 0 0 1-.298-.286V9.192h-2.467c-3.428 0-4.691 2.83-4.691 2.83V10c0-2.232 1.885-4.042 4.21-4.042z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Share1.displayName = 'Share1';
