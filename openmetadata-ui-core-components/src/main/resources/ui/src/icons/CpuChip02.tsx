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

export const CpuChip02: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M9 2v3m6-3v3M9 19v3m6-3v3m4-13h3m-3 5h3M2 9h3m-3 5h3m4.8 5h4.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C19 16.72 19 15.88 19 14.2V9.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C16.72 5 15.88 5 14.2 5H9.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C5 7.28 5 8.12 5 9.8v4.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C7.28 19 8.12 19 9.8 19"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CpuChip02.displayName = 'CpuChip02';
