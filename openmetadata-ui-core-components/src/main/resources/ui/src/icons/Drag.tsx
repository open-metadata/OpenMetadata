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

export const Drag: FC<Props> = ({
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
      d="M10 2v8m-8 0h8m8.001 0H10m0 8v-8M7.332 4.667l1.516-1.735C9.39 2.31 9.662 2 9.998 2c.338 0 .61.31 1.152.932l1.515 1.735m0 10.665-1.515 1.735c-.543.621-.814.932-1.151.932s-.609-.31-1.151-.932l-1.516-1.735m8-8 1.735 1.516c.621.542.932.814.932 1.15 0 .338-.31.61-.932 1.152l-1.735 1.515m-10.665 0L2.932 11.15C2.31 10.607 2 10.336 2 9.999s.31-.609.932-1.151l1.735-1.516"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Drag.displayName = 'Drag';
