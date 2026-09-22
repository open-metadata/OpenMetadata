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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M6.8 3h-.6c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 4.52 3 5.08 3 6.2v11.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C10 19.48 10 18.92 10 17.8V6.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C8.48 3 7.92 3 6.8 3m11 0h-.6c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C14 4.52 14 5.08 14 6.2v11.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C15.52 21 16.08 21 17.2 21h.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8V6.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C19.48 3 18.92 3 17.8 3"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);
Columns01.displayName = 'Columns01';
