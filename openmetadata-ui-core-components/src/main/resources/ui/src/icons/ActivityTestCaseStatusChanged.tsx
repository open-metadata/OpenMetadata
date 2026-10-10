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

export const ActivityTestCaseStatusChanged: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <path
      d="M9.467 4.417V3.93c0-1.38 0-2.071-.429-2.5S7.918 1 6.538 1H4.585c-1.38 0-2.07 0-2.5.429-.429.429-.429 1.12-.429 2.5v3.906c0 1.38 0 2.07.43 2.5.428.429 1.119.429 2.5.429m-.976-5.37h1.952M3.61 3.441h3.906m.822 3.827a1.435 1.435 0 1 1 0 2.871m1.247-2.148.763-.436m-.763 1.861.763.436m-2.01-2.584a1.435 1.435 0 1 0 0 2.871m0 0v.862M7.091 7.99l-.763-.436m.763 1.861-.763.436m2.01-2.584v-.862"
      stroke="currentColor"
    />
  </svg>
);
ActivityTestCaseStatusChanged.displayName = 'ActivityTestCaseStatusChanged';
