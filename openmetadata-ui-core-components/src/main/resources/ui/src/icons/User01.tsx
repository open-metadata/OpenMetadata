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

export const User01: FC<Props> = ({
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
      d="M16.667 17.5c0-1.163 0-1.744-.143-2.218a3.33 3.33 0 0 0-2.222-2.222c-.473-.143-1.054-.143-2.218-.143H7.917c-1.163 0-1.744 0-2.218.143a3.33 3.33 0 0 0-2.222 2.223c-.144.473-.144 1.054-.144 2.217M13.75 6.25a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
User01.displayName = 'User01';
