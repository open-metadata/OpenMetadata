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

export const SearchSettings: FC<Props> = ({
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
      d="m14 14.89 3.111 3.112m-1.776-7.114a5.333 5.333 0 1 0-10.667 0 5.333 5.333 0 0 0 10.667 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.903 7.333c.435-.18.781-.526.962-.962C18 6.045 18 5.495 18 4.667c0-.829 0-1.243-.135-1.57a1.78 1.78 0 0 0-.962-.962C16.576 2 16.162 2 15.333 2H4.667c-.829 0-1.243 0-1.57.135-.435.18-.781.527-.962.962C2 3.424 2 3.838 2 4.667c0 .828 0 1.378.135 1.704.18.436.527.782.962.962"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SearchSettings.displayName = 'SearchSettings';
