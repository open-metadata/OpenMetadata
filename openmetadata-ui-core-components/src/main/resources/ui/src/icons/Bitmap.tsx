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

export const Bitmap: FC<Props> = ({
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
      d="M7.296 6.745a1.206 1.206 0 1 1-2.411 0 1.206 1.206 0 0 1 2.411 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m17.343 9.158.001 1.206c0 3.6 0 5.4-1.118 6.518-1.118 1.119-2.919 1.119-6.519 1.119s-5.4 0-6.518-1.119C2.07 15.764 2.07 13.964 2.07 10.364s0-5.4 1.119-6.519 2.918-1.118 6.518-1.118l1.206.001"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M4.08 17.598c3.515-4.2 7.456-9.74 13.262-5.995m.585-6.667L14.941 2l-2.935 2.986M14.97 2.02v5.932"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Bitmap.displayName = 'Bitmap';
