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

export const File06: FC<Props> = ({
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
      d="M11.667 1.892v3.441c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.092.412.092.878.092h3.442m-3.109 4.166H6.667m6.667 3.333H6.667m1.667-6.667H6.667m5-5.833H7.333c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093c-.273.535-.273 1.235-.273 2.635v8.667c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093c.534.271 1.234.271 2.634.271h5.333c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.273-.536.273-1.236.273-2.636V6.667z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
File06.displayName = 'File06';
