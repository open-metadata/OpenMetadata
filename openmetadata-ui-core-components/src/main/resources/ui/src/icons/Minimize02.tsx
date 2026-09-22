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

export const Minimize02: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M3 8h.2c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.31-1.311C8 5.72 8 4.88 8 3.2V3M3 16h.2c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.31 1.311C8 18.28 8 19.12 8 20.8v.2m8-18v.2c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.31 1.311C18.28 8 19.12 8 20.8 8h.2m-5 13v-.2c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.31-1.311C18.28 16 19.12 16 20.8 16h.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Minimize02.displayName = 'Minimize02';
