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

export const TestCase2: FC<Props> = ({
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
      d="m7.602 11.202 1.6 1.6 3.2-3.2M11.997 2h-4a1.2 1.2 0 1 0 0 2.4h4a1.2 1.2 0 0 0 0-2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.202 3.2c1.243.037 1.984.175 2.497.688.703.703.703 1.835.703 4.097V13.2c0 2.263 0 3.394-.703 4.097S13.864 18 11.602 18h-3.2c-2.263 0-3.395 0-4.097-.703s-.703-1.834-.703-4.097V7.985c0-2.262 0-3.394.703-4.097.513-.513 1.254-.651 2.497-.689"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TestCase2.displayName = 'TestCase2';
