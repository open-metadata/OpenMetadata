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

export const ChangeHierarchy: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="m17.202 17.202-1.5-1.5m.7-1.7a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0M15.6 4.4c0 1.325-2.865 2.4-6.4 2.4-3.534 0-6.4-1.075-6.4-2.4S5.667 2 9.2 2s6.4 1.075 6.4 2.4M2.8 10c0 1.224 2.444 2.234 5.6 2.381"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M9.2 17.998c-3.534 0-6.4-1.074-6.4-2.4v-11.2m12.8 0v4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ChangeHierarchy.displayName = 'ChangeHierarchy';
