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

export const Star04: FC<Props> = ({
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="m12 2 2.012 5.231c.282.733.423 1.1.642 1.408q.294.413.707.707c.308.219.675.36 1.408.642L22 12l-5.231 2.012c-.733.282-1.1.423-1.408.642a3 3 0 0 0-.707.707c-.219.308-.36.675-.642 1.408L12 22l-2.012-5.231c-.282-.733-.423-1.1-.642-1.408a3 3 0 0 0-.707-.707c-.308-.219-.675-.36-1.408-.642L2 12l5.231-2.012c.733-.282 1.1-.423 1.408-.642a3 3 0 0 0 .707-.707c.219-.308.36-.675.642-1.408z" />
  </svg>
);
Star04.displayName = 'Star04';
