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

export const OpenIncidents: FC<Props> = ({
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
      d="M11.54 17.2H8.46c-3.704 0-5.556 0-6.239-1.204-.682-1.205.265-2.802 2.16-5.996l1.54-2.597C7.74 4.335 8.65 2.801 10 2.801s2.26 1.534 4.08 4.602L15.62 10c1.894 3.194 2.842 4.791 2.159 5.996s-2.535 1.205-6.24 1.205M9.996 7.602v3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.1 13.802H10m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
OpenIncidents.displayName = 'OpenIncidents';
