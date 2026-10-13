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

export const AppDataInsightsReport: FC<Props> = ({
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
      d="m5.309 11.242 2.31-2.31a.827.827 0 0 1 1.17 0l1.31 1.312a.827.827 0 0 0 1.17 0l2.31-2.31"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.887 10.415v-.827c0-3.509 0-5.263-1.09-6.353s-2.844-1.09-6.353-1.09-5.264 0-6.354 1.09S2 6.079 2 9.588s0 5.264 1.09 6.354 2.845 1.09 6.354 1.09h.827"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m18 17.855-1.123-1.122m.374-1.871a2.245 2.245 0 1 1-4.49 0 2.245 2.245 0 0 1 4.49 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppDataInsightsReport.displayName = 'AppDataInsightsReport';
