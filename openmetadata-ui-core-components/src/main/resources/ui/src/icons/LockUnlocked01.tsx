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

export const LockUnlocked01: FC<Props> = ({
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
    <path
      d="M11.6 12.8a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0M6.4 7.6v-2A3.6 3.6 0 0 1 10 2c1.568 0 2.706 1.002 3.2 2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.2 7.602H8.8c-1.868 0-2.802 0-3.51.377a3.2 3.2 0 0 0-1.313 1.314C3.6 10 3.6 10.934 3.6 12.803c0 1.867 0 2.8.378 3.507a3.2 3.2 0 0 0 1.313 1.314c.707.378 1.641.378 3.509.378h2.4c1.867 0 2.8 0 3.508-.378a3.2 3.2 0 0 0 1.313-1.314c.378-.707.378-1.64.378-3.508s0-2.802-.378-3.509a3.2 3.2 0 0 0-1.313-1.314c-.707-.377-1.641-.377-3.509-.377"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LockUnlocked01.displayName = 'LockUnlocked01';
