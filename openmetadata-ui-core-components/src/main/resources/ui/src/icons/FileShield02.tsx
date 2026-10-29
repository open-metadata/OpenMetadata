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

export const FileShield02: FC<Props> = ({
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
      d="M11.667 9.167h-5M8.334 12.5H6.667m6.667-6.667H6.667m10 2.5V5.667c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092c-.536-.273-1.236-.273-2.636-.273H7.333c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093c-.273.534-.273 1.234-.273 2.634v8.667c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093c.534.271 1.234.271 2.634.271h3.083m4.583-.833s2.5-1.192 2.5-2.979v-2.085l-1.823-.652a2 2 0 0 0-1.355 0l-1.821.652v2.085c0 1.787 2.5 2.979 2.5 2.979Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FileShield02.displayName = 'FileShield02';
