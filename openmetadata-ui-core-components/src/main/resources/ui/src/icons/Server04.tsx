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

export const Server04: FC<Props> = ({
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
      d="m18.333 8.75-.395-3.162c-.155-1.241-.233-1.861-.525-2.328a2.5 2.5 0 0 0-1.069-.944c-.5-.232-1.125-.232-2.375-.232H6.031c-1.25 0-1.875 0-2.375.232a2.5 2.5 0 0 0-1.069.944c-.292.467-.37 1.088-.525 2.328L1.667 8.75m2.917 3.333h10.833m-10.833 0a2.917 2.917 0 1 1 0-5.833h10.833a2.917 2.917 0 1 1 0 5.833m-10.833 0a2.917 2.917 0 1 0 0 5.833h10.833a2.917 2.917 0 1 0 0-5.833M5 9.167h.008M5 15h.008M10 9.167h5M10 15h5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Server04.displayName = 'Server04';
