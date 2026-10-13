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

export const WorkflowDetectFieldChange: FC<Props> = ({
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
      d="M2.598 2.5v15M4.383 3.23H8.14m-3.757 6.891h5.833m-5.833 6.574H8.14m6.787-13.461 2.325 2.27a.48.48 0 0 1 0 .691l-2.325 2.27m2.415-2.652h-6.444m2.472 5.722-2.325 2.27a.48.48 0 0 0 0 .691l2.324 2.27m-2.414-2.652h6.443"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowDetectFieldChange.displayName = 'WorkflowDetectFieldChange';
