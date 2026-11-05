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

export const Home01: FC<Props> = ({
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
      d="M2.5 8.804c0-.478 0-.717.062-.938a1.7 1.7 0 0 1 .265-.542c.136-.183.325-.331.703-.625l5.653-4.396c.293-.228.439-.342.6-.385a.83.83 0 0 1 .436 0c.162.043.308.158.601.385l5.653 4.396c.378.294.567.442.703.625.121.163.21.347.265.542.062.221.062.46.062.938v6.029c0 .933 0 1.4-.182 1.757a1.67 1.67 0 0 1-.728.728c-.36.182-.826.182-1.76.182H5.167c-.933 0-1.4 0-1.757-.182a1.67 1.67 0 0 1-.728-.728c-.182-.357-.182-.823-.182-1.757z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Home01.displayName = 'Home01';
