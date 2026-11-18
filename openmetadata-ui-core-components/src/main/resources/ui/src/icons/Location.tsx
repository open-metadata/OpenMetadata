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

export const Location: FC<Props> = ({
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
      d="M11.202 17.529A1.76 1.76 0 0 1 10 18a1.76 1.76 0 0 1-1.203-.471c-2.955-2.784-6.916-7.01-4.985-11.526C4.856 3.563 7.363 2 10 2s5.144 1.562 6.188 4.003c1.93 4.51-2.022 8.752-4.985 11.526Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.604 8.698a2.605 2.605 0 1 1-5.21 0 2.605 2.605 0 0 1 5.21 0Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Location.displayName = 'Location';
