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

export const Compass03: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.178 7.013c.39-.13.586-.196.716-.15a.4.4 0 0 1 .242.243c.047.13-.018.325-.149.716l-1.19 3.57a1 1 0 0 1-.087.214.4.4 0 0 1-.104.104 1 1 0 0 1-.214.087l-3.57 1.19c-.39.13-.586.196-.716.15a.4.4 0 0 1-.242-.243c-.047-.13.018-.325.149-.716l1.19-3.57c.037-.112.055-.167.087-.214a.4.4 0 0 1 .104-.104c.047-.032.102-.05.214-.087z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Compass03.displayName = 'Compass03';
