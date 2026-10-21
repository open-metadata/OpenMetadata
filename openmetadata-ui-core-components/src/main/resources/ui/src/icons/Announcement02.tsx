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

export const Announcement02: FC<Props> = ({
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
      d="m3.333 11.667 1.313 5.249c.037.148.055.221.077.286a1.67 1.67 0 0 0 1.444 1.125c.067.006.143.006.296.006.19 0 .286 0 .367-.008a1.67 1.67 0 0 0 1.498-1.497c.008-.08.008-.175.008-.367V4.583m7.083 6.667a2.917 2.917 0 1 0 0-5.833m-6.875-.833H5.417a3.75 3.75 0 0 0 0 7.5h3.125c1.472 0 3.273.789 4.662 1.547.811.442 1.217.663 1.482.63a.79.79 0 0 0 .576-.342c.156-.217.156-.653.156-1.522V4.272c0-.87 0-1.305-.156-1.522a.79.79 0 0 0-.576-.342c-.266-.032-.671.188-1.482.63-1.389.758-3.19 1.547-4.662 1.547Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Announcement02.displayName = 'Announcement02';
