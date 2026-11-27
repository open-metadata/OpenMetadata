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

export const CodeOutline: FC<Props> = ({
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
      d="M5.676 7.84A5.24 5.24 0 0 1 7.7 9.632a1.27 1.27 0 0 1 0 1.425 5.3 5.3 0 0 1-2.025 1.783m5.681 0h3.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.497 18.67h5c4.167 0 5.834-1.666 5.834-5.833v-5c0-4.166-1.667-5.833-5.834-5.833h-5c-4.166 0-5.833 1.667-5.833 5.833v5c0 4.167 1.667 5.834 5.833 5.834"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CodeOutline.displayName = 'CodeOutline';
