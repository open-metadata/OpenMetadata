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

export const WorkflowDataCompleteness: FC<Props> = ({
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
      d="M9.2 12.4c-3.534 0-6.4-1.075-6.4-2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.6 4.398v5.2m-12.8-5.2v11.2c0 1.326 2.866 2.4 6.4 2.4q.202 0 .4-.004"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M9.2 6.8c3.535 0 6.4-1.075 6.4-2.4S12.736 2 9.2 2C5.667 2 2.8 3.075 2.8 4.4s2.866 2.4 6.4 2.4M6 6.8v1.6m0 3.998v1.6m8 4.004a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.848 14.8s.599.108.851.852c0 0 .639-1.277 1.703-1.703"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowDataCompleteness.displayName = 'WorkflowDataCompleteness';
