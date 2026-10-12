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

export const WorkflowRevertChanges: FC<Props> = ({
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
      d="M10 17.5A7.5 7.5 0 1 0 3.505 6.25"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2.5 2.5v1.065c0 1.827 0 2.74.59 3.24.589.499 1.49.348 3.291.048L7.5 6.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowRevertChanges.displayName = 'WorkflowRevertChanges';
