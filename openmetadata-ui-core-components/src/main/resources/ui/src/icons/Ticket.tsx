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

export const Ticket: FC<Props> = ({
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
      d="M2.371 7.874c-.198 0-.38-.16-.37-.372.053-1.233.203-2.036.623-2.672.242-.365.542-.683.887-.939.934-.692 2.25-.692 4.883-.692h3.212c2.633 0 3.95 0 4.883.692.345.256.645.574.887.94.42.635.57 1.438.624 2.671.009.21-.173.372-.372.372-1.109 0-2.007.952-2.007 2.125s.898 2.125 2.007 2.125c.2 0 .38.162.372.372-.054 1.234-.204 2.037-.624 2.672a3.7 3.7 0 0 1-.887.94c-.934.691-2.25.691-4.883.691H8.394c-2.633 0-3.95 0-4.883-.691a3.7 3.7 0 0 1-.887-.94c-.42-.635-.57-1.438-.624-2.672-.009-.21.173-.372.371-.372 1.11 0 2.008-.951 2.008-2.125S3.48 7.874 2.37 7.874M7.6 3.2v1.133m0 12.466v-1.133m0-9.067v2.267m0 2.267v2.266"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Ticket.displayName = 'Ticket';
