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

export const Scales02: FC<Props> = ({
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
      d="M10 3.602v12.8m-4 0h8M3.6 6h12.8M3.6 6 2 10.8M3.6 6l1.6 4.8m-3.2 0a1.6 1.6 0 0 0 3.2 0M16.4 6l-1.6 4.8M16.4 6l1.6 4.8m-3.2 0a1.6 1.6 0 0 0 3.2 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Scales02.displayName = 'Scales02';
