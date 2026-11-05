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

export const Columns01: FC<Props> = ({
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
      d="M5.667 2.5h-.5c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.182.357-.182.823-.182 1.757v9.667c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.357.181.823.181 1.757.181h.5c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.181-.357.181-.823.181-1.757V5.167c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728C7.067 2.5 6.6 2.5 5.667 2.5m9.167 0h-.5c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.182.357-.182.823-.182 1.757v9.667c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.356.181.823.181 1.756.181h.5c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.182-.357.182-.823.182-1.757V5.167c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728c-.357-.182-.823-.182-1.757-.182Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Columns01.displayName = 'Columns01';
