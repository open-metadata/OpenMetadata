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

export const Ldap: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M14.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10.286 3.5h3.428C15.79 3.5 16 4.425 16 6s-.211 2.5-2.286 2.5h-3.428C8.21 8.5 8 7.575 8 6s.211-2.5 2.286-2.5Z"
      fill="#4E5BA6"
      stroke="#4E5BA6"
    />
    <path
      d="M4 14.5c.248-1.623 1.245-2 3.988-2h8.027c2.743 0 3.737.377 3.985 2"
      stroke="#4E5BA6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 16.5c0-.943 0-1.414.293-1.707S3.057 14.5 4 14.5s1.414 0 1.707.293S6 15.557 6 16.5s0 1.414-.293 1.707S4.943 18.5 4 18.5s-1.414 0-1.707-.293S2 17.443 2 16.5Zm16 0c0-.943 0-1.414.293-1.707S19.057 14.5 20 14.5s1.414 0 1.707.293.293.764.293 1.707 0 1.414-.293 1.707-.764.293-1.707.293-1.414 0-1.707-.293S18 17.443 18 16.5Z"
      fill="#4E5BA6"
      stroke="#4E5BA6"
    />
    <path
      d="M12 8.5v7"
      stroke="#4E5BA6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
Ldap.displayName = 'Ldap';
