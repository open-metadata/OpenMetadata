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

export const DataObservability: FC<Props> = ({
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
      d="M15.52 3.998a5.6 5.6 0 1 0-.101 8.097"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.2 6.677c.903-.557 2.013-1.08 3.002-1.08.99 0 2.1.523 3.003 1.08 1.015.625 1.015 2.016 0 2.642-.903.557-2.014 1.079-3.003 1.079s-2.1-.522-3.003-1.08c-1.014-.625-1.014-2.016 0-2.641Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle cx={13.202} cy={7.999} fill="currentColor" r={0.8} stroke="none" />
    <path
      d="M5.605 12 7.6 13.995l-3.192 3.192a1.41 1.41 0 1 1-1.995-1.995zm1.195.8.8-.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataObservability.displayName = 'DataObservability';
