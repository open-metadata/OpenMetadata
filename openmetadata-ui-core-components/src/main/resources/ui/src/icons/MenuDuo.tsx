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

export const MenuDuo: FC<Props> = ({
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
      d="M18 5.333a3.333 3.333 0 1 0-6.666 0 3.333 3.333 0 0 0 6.667 0m-9.334 0a3.333 3.333 0 1 0-6.667 0 3.333 3.333 0 0 0 6.667 0M18 14.665a3.333 3.333 0 1 0-6.666 0 3.333 3.333 0 0 0 6.667 0m-9.334 0a3.333 3.333 0 1 0-6.667 0 3.333 3.333 0 0 0 6.667 0"
      fill="currentColor"
    />
  </svg>
);
MenuDuo.displayName = 'MenuDuo';
