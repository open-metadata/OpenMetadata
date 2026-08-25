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

export const TestSuite: FC<Props> = ({
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
      d="M16.222 2.5H3.778C2.796 2.5 2 3.34 2 4.375v11.25c0 1.035.796 1.875 1.778 1.875h12.444c.982 0 1.778-.84 1.778-1.875V4.375c0-1.036-.796-1.875-1.778-1.875"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m4.8 7.002 1.4 1.4 2.8-2.8m-4.2 7.4 1.4 1.4 2.8-2.8m3-4.6h3.2m-3.2 6h3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TestSuite.displayName = 'TestSuite';
