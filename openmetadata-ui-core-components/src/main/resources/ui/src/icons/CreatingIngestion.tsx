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

export const CreatingIngestion: FC<Props> = ({
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
      d="M5.186 15.884v.729h.729c.59 0 .885 0 1.15-.11.266-.11.475-.319.892-.736l4.748-4.748c.425-.425.637-.637.66-.898a1 1 0 0 0 0-.13c-.023-.26-.235-.473-.66-.898s-.637-.637-.898-.66a1 1 0 0 0-.13 0c-.26.023-.473.236-.897.66l-4.75 4.749c-.417.417-.626.626-.736.89-.11.266-.11.561-.11 1.152M10 9.875l1.925 1.925"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.15 16.66a8 8 0 1 1 7.884 1.042"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CreatingIngestion.displayName = 'CreatingIngestion';
