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

export const DataQualityAlarmUpstream: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M3.387 14.625v-3.787a5.05 5.05 0 0 1 9.494-2.397m-10.756 6.18h5.544M8.438 2v1.893m5.677.634-.947.947m-10.41-.947.947.947"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.3}
    />
    <path
      d="M8.438 8.313v2.524m0 1.823h.006"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.3}
    />
    <path
      d="M14.118 18a3.758 3.758 0 1 0 0-7.516 3.758 3.758 0 0 0 0 7.517"
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.3}
    />
    <path
      d="M14.116 12.742v3.007m-1.28-1.726 1.28-1.28 1.28 1.28"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
DataQualityAlarmUpstream.displayName = 'DataQualityAlarmUpstream';
