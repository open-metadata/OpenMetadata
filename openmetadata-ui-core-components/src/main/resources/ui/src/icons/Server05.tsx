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

export const Server05: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M19 9a7 7 0 0 1-7 7m7-7a7 7 0 0 0-7-7m7 7H5m7 7a7 7 0 0 1-7-7m7 7a10.7 10.7 0 0 0 2.8-7A10.7 10.7 0 0 0 12 2m0 14a10.7 10.7 0 0 1-2.8-7A10.7 10.7 0 0 1 12 2m0 14v2M5 9a7 7 0 0 1 7-7m2 18a2 2 0 1 1-4 0m4 0a2 2 0 0 0-2-2m2 2h7m-11 0a2 2 0 0 1 2-2m-2 2H3"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);
Server05.displayName = 'Server05';
