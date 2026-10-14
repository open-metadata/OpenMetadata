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

export const FileLock02: FC<Props> = ({
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
      d="M16.667 8.333V5.667c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 0 0-1.092-1.092c-.536-.273-1.236-.273-2.636-.273H7.333c-1.4 0-2.1 0-2.635.273a2.5 2.5 0 0 0-1.092 1.093c-.273.534-.273 1.234-.273 2.634v8.667c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093c.534.271 1.234.271 2.634.271H8.75m2.083-9.166H6.667m2.5 3.333h-2.5m6.667-6.667H6.667m9.375 8.333v-1.458a1.458 1.458 0 1 0-2.917 0v1.459M13 17.5h3.167c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.412.091-.878V15.5c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.412-.091-.878-.091H13c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.411-.091.878v.667c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.411.091.878.091"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FileLock02.displayName = 'FileLock02';
