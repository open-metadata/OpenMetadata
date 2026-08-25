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

export const Logs: FC<Props> = ({
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
      d="M15.045 9.969V5.643c0-1.275 0-1.913-.248-2.4a2.28 2.28 0 0 0-.995-.995C13.315 2 12.677 2 11.402 2H6.545c-1.275 0-1.913 0-2.4.248a2.28 2.28 0 0 0-.995.995c-.248.487-.248 1.125-.248 2.4v7.893c0 1.275 0 1.912.248 2.4.219.428.567.776.995.994.487.248 1.125.248 2.4.248h2.808m1.139-8.348H5.938m1.518 3.036H5.938m6.071-6.071H5.938"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.192 14.206v.892l.692.377m2.21-.377a2.903 2.903 0 1 1-5.805 0 2.903 2.903 0 0 1 5.806 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Logs.displayName = 'Logs';
