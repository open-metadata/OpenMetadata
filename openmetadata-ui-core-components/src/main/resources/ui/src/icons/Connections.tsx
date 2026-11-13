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

export const Connections: FC<Props> = ({
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
      d="M6 16.93A8 8 0 0 1 2 10a8 8 0 1 1 16 0c0 3.384-2.1 6.277-5.069 7.446C11.39 18.053 10 16.656 10 15v-.51"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.928 10.435c0-1.108.898-2.005 2.005-2.005h4.009c1.107 0 2.005.897 2.005 2.005a4.01 4.01 0 1 1-8.019 0Zm2.006-2.008V5.922m4.007 2.505V5.922"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Connections.displayName = 'Connections';
