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

export const ExpandRight: FC<Props> = ({
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
      d="M16.647 12V8c0-3.333-1.333-4.666-4.667-4.666h-4c-3.333 0-4.667 1.333-4.667 4.667v4c0 3.333 1.334 4.666 4.667 4.666h4c3.333 0 4.667-1.333 4.667-4.666M11.98 3.334v13.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.314 8.293 9.02 10l-1.706 1.706"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ExpandRight.displayName = 'ExpandRight';
