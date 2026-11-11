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

export const Kpi: FC<Props> = ({
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
      d="M10.002 13.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2m6.398 3.202c1.005-1.338 1.6-3 1.6-4.8 0-1.138-.238-2.22-.666-3.2m-13.735 8a8 8 0 0 1 9.6-12.134M11.203 10.4l4.4-4.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Kpi.displayName = 'Kpi';
