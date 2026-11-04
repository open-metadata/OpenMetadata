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
      d="M15.833 7.5A5.833 5.833 0 0 1 10 13.333M15.833 7.5A5.833 5.833 0 0 0 10 1.667M15.833 7.5H4.167M10 13.333A5.833 5.833 0 0 1 4.167 7.5M10 13.333A8.93 8.93 0 0 0 12.333 7.5 8.93 8.93 0 0 0 10 1.667m0 11.667a8.92 8.92 0 0 1-2.333-5.833A8.92 8.92 0 0 1 10 1.667m0 11.667v1.667M4.167 7.5A5.833 5.833 0 0 1 10 1.667m1.667 15a1.667 1.667 0 1 1-3.333 0m3.333 0A1.667 1.667 0 0 0 10 15m1.667 1.667H17.5m-9.167 0A1.667 1.667 0 0 1 10 15m-1.667 1.667H2.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Server05.displayName = 'Server05';
