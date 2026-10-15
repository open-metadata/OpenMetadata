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

export const CheckVerified01: FC<Props> = ({
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
      d="m7.5 10 1.667 1.667 3.75-3.75M6.112 3.183a3.2 3.2 0 0 0 1.817-.753 3.19 3.19 0 0 1 4.143 0c.511.436 1.147.7 1.817.753a3.19 3.19 0 0 1 2.929 2.929 3.2 3.2 0 0 0 .753 1.817 3.19 3.19 0 0 1 0 4.143 3.2 3.2 0 0 0-.753 1.817 3.19 3.19 0 0 1-2.929 2.929 3.2 3.2 0 0 0-1.817.753 3.19 3.19 0 0 1-4.143 0 3.2 3.2 0 0 0-1.817-.753 3.19 3.19 0 0 1-2.929-2.929 3.2 3.2 0 0 0-.753-1.817 3.19 3.19 0 0 1 0-4.143c.436-.511.7-1.147.753-1.817a3.19 3.19 0 0 1 2.929-2.929"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CheckVerified01.displayName = 'CheckVerified01';
