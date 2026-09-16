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

export const Manage: FC<Props> = ({
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
      d="M10 10.813a.813.813 0 1 0 0-1.626.813.813 0 0 0 0 1.626m0-5.688A.813.813 0 1 0 10 3.5a.813.813 0 0 0 0 1.625M10 16.5a.813.813 0 1 0 0-1.625.813.813 0 0 0 0 1.625"
      fill="currentColor"
    />
    <path
      d="M10 10.813a.813.813 0 1 0 0-1.626.813.813 0 0 0 0 1.626m0-5.688A.813.813 0 1 0 10 3.5a.813.813 0 0 0 0 1.625M10 16.5a.813.813 0 1 0 0-1.625.813.813 0 0 0 0 1.625"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Manage.displayName = 'Manage';
