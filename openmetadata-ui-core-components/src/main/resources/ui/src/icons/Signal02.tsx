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

export const Signal02: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M13.394 5.036a4.8 4.8 0 0 1 0 6.788m-6.788 0a4.8 4.8 0 0 1 0-6.788m-2.263 9.05a8 8 0 0 1 0-11.313m11.314 0a8 8 0 0 1 0 11.314M10 10.03a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2m0 0v7.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Signal02.displayName = 'Signal02';
