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

export const Brackets: FC<Props> = ({
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
      d="M15.475 16.667a1.905 1.905 0 0 0 1.906-1.905v-3.809l.952-.953-.952-.952v-3.81a1.904 1.904 0 0 0-1.906-1.905m-10.951 0a1.904 1.904 0 0 0-1.905 1.905v3.809L1.667 10l.953.953v3.809a1.904 1.904 0 0 0 1.904 1.905"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Brackets.displayName = 'Brackets';
