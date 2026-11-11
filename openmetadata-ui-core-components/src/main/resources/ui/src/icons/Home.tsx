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

export const Home: FC<Props> = ({
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
      d="M3.6 16.004V9.786a2 2 0 0 1 .53-1.356l4.4-4.767a2 2 0 0 1 2.94 0l4.4 4.767a2 2 0 0 1 .53 1.356v6.218a1 1 0 0 1-1 1h-2.8a1 1 0 0 1-1-1V13.41a1 1 0 0 0-1-1H9.4a1 1 0 0 0-1 1v2.595a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m2 10.605 6.54-6.977a2 2 0 0 1 2.92 0L18 10.605"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Home.displayName = 'Home';
