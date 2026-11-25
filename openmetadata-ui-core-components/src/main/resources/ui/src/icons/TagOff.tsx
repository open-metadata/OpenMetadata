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

export const TagOff: FC<Props> = ({
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
      d="M3.388 11.286zc-.685-.685-1.027-1.027-1.208-1.462C2 9.388 2 8.904 2 7.935V5.16c0-1.489 0-2.234.463-2.696C2.925 2 3.67 2 5.159 2h2.776c.969 0 1.453 0 1.889.18s.777.523 1.462 1.208m3.258 3.258 1.086 1.086c1.58 1.58 2.37 2.37 2.37 3.351 0 .982-.79 1.771-2.37 3.35v.001l-1.196 1.197c-1.58 1.58-2.37 2.369-3.35 2.369-.982 0-1.772-.79-3.351-2.37l-1.087-1.086"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.8 5.6h-.2m.4 0a.4.4 0 1 1-.8 0 .4.4 0 0 1 .8 0M4.33 16.665l12.591-12.59"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TagOff.displayName = 'TagOff';
