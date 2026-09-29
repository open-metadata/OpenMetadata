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

export const Approver: FC<Props> = ({
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
      d="M8.72 12.566H7.474c-1.157 0-1.736 0-2.207.143a3.32 3.32 0 0 0-2.211 2.211c-.143.471-.143 1.05-.143 2.207m10.625-1.945.7.592 1.582-1.3m-2.54-8.543a3.732 3.732 0 1 1-7.464 0 3.732 3.732 0 0 1 7.464 0m4.65 8.99a3.279 3.279 0 1 1-6.557 0 3.279 3.279 0 0 1 6.558 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Approver.displayName = 'Approver';
