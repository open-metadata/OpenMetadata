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

export const TestCase: FC<Props> = ({
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
      d="M7.453 2v5.3L3.07 14.84A2.038 2.038 0 0 0 4.803 18h10.395a2.038 2.038 0 0 0 1.732-3.16L12.548 7.3V2M6.434 2h7.133"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m8.164 13.72 1.63 1.63 3.058-3.057"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TestCase.displayName = 'TestCase';
