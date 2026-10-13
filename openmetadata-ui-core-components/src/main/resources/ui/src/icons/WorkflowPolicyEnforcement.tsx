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

export const WorkflowPolicyEnforcement: FC<Props> = ({
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
      d="m13.69 14.528-.444 1.737a.91.91 0 0 0 1.219 1.07.9.9 0 0 1 .677 0c.699.28 1.433-.337 1.266-1.071l-.406-1.785m1.2-2.08a2.4 2.4 0 1 1-4.8.001 2.4 2.4 0 0 1 4.8 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.4 8.4c0-3.017 0-4.526-.937-5.463S13.017 2 10.001 2h-.8c-3.017 0-4.526 0-5.463.937S2.801 5.383 2.801 8.4v3.2c0 3.017 0 4.525.937 5.462C4.675 18 6.184 18 9.201 18h1.6M6.402 6h6.4m-6.4 4h3.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowPolicyEnforcement.displayName = 'WorkflowPolicyEnforcement';
