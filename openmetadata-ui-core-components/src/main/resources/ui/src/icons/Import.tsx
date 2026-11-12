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

export const Import: FC<Props> = ({
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
      d="M18.04 7.777h-16m16 0v5.76c0 1.344 0 2.016-.262 2.53-.23.45-.598.818-1.05 1.048-.513.262-1.185.262-2.529.262h-8.32c-1.344 0-2.016 0-2.53-.262a2.4 2.4 0 0 1-1.048-1.049c-.262-.513-.262-1.185-.262-2.53v-5.76m16 0v-.96c0-1.344 0-2.016-.262-2.529a2.4 2.4 0 0 0-1.048-1.049c-.514-.261-1.186-.261-2.53-.261H5.88c-1.344 0-2.016 0-2.53.261a2.4 2.4 0 0 0-1.048 1.049c-.262.513-.262 1.185-.262 2.53v.96"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m12.38 14.578 2-2-2-2m-4.618 0-2 2 2 2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Import.displayName = 'Import';
