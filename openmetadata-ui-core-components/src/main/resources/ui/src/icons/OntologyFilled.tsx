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

export const OntologyFilled: FC<Props> = ({
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
      d="M12.361 10.082a2.48 2.48 0 1 1-4.961 0 2.48 2.48 0 0 1 4.961 0"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="M17.4 5.799a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0m-12-.797a1.4 1.4 0 1 1-2.801 0 1.4 1.4 0 0 1 2.801 0M6.201 15.4a1.4 1.4 0 1 1-2.801 0 1.4 1.4 0 0 1 2.801 0m8.799 0a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0m2.4-4a1.4 1.4 0 1 1-2.801 0 1.4 1.4 0 0 1 2.801 0"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.2}
    />
    <path
      d="m12.4 8.6 2-1.6M7.6 8.6 4.8 6.2m3.6 6L6 14.495m5.2-2.295 1.6 2m-.4-3.602 1.879.4"
      stroke="currentColor"
      strokeWidth={1.2}
    />
  </svg>
);
OntologyFilled.displayName = 'OntologyFilled';
