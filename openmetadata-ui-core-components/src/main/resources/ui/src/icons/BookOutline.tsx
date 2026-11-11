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

export const BookOutline: FC<Props> = ({
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
    viewBox="0 0 20 21"
    width={size}
    {...props}>
    <path
      d="M3.2 15.3V6.5c0-3.2.8-4 4-4h5.6c3.2 0 4 .8 4 4v8c0 .112 0 .224-.009.336"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.48 12.898H16.8v2.8c0 1.544-1.257 2.8-2.8 2.8H6a2.803 2.803 0 0 1-2.8-2.8v-.52a2.284 2.284 0 0 1 2.28-2.28M6.799 6.5h6.4m-6.4 2.8h4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
BookOutline.displayName = 'BookOutline';
