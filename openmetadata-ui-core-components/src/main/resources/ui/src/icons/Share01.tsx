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

export const Share01: FC<Props> = ({
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
      d="M17.614 10.533c.214-.183.32-.275.36-.384a.44.44 0 0 0 0-.297c-.04-.11-.146-.201-.36-.385L10.18 3.095c-.37-.316-.553-.474-.71-.478a.44.44 0 0 0-.35.162c-.1.12-.1.364-.1.85v3.769A8.48 8.48 0 0 0 2 15.749v.537a10 10 0 0 1 7.02-3.591v3.677c0 .486 0 .729.1.85a.44.44 0 0 0 .35.161c.157-.004.34-.162.71-.478z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Share01.displayName = 'Share01';
