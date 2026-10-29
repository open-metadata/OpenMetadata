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

export const Settings02: FC<Props> = ({
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
      d="m7.829 16.142.488 1.096a1.843 1.843 0 0 0 3.37 0l.487-1.096a2.02 2.02 0 0 1 2.058-1.186l1.192.127a1.843 1.843 0 0 0 1.686-2.918l-.706-.97A2.02 2.02 0 0 1 16.021 10c0-.428.136-.845.387-1.191l.706-.969a1.843 1.843 0 0 0-1.685-2.918l-1.192.127a2.03 2.03 0 0 1-1.225-.26 2.02 2.02 0 0 1-.833-.931l-.491-1.096a1.843 1.843 0 0 0-3.37 0l-.489 1.096a2.02 2.02 0 0 1-2.058 1.191l-1.195-.127A1.843 1.843 0 0 0 2.89 7.84l.706.969a2.025 2.025 0 0 1 0 2.382l-.706.969a1.842 1.842 0 0 0 .655 2.728 1.85 1.85 0 0 0 1.031.192l1.192-.127a2.03 2.03 0 0 1 2.062 1.192Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Settings02.displayName = 'Settings02';
