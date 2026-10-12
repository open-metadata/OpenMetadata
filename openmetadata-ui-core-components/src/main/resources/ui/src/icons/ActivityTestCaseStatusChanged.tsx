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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M15.54 7.467v-.781c0-2.21 0-3.314-.686-4S13.064 2 10.855 2H7.732c-2.209 0-3.313 0-3.999.686s-.686 1.79-.686 4v6.248c0 2.208 0 3.313.686 4 .686.685 1.79.685 3.999.685M6.172 9.03h3.123M6.172 5.906h6.247m1.32 6.123a2.296 2.296 0 0 1 1.994 3.436 2.3 2.3 0 0 1-1.994 1.157m1.994-3.436 1.22-.698m-1.22 2.977 1.22.698m-3.214-4.134a2.296 2.296 0 0 0-1.995 3.436 2.3 2.3 0 0 0 1.995 1.157m0 0v1.379m-1.995-4.815-1.22-.698m1.22 2.977-1.22.698m3.215-4.134V10.65"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityTestCaseStatusChanged.displayName = 'ActivityTestCaseStatusChanged';
