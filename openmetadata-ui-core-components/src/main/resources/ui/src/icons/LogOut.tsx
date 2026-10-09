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

export const LogOut: FC<Props> = ({
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
      d="M11.687 10H3.266m4.23 5.053c.04.92.156 1.507.502 1.959q.203.264.467.466c.68.522 1.668.522 3.643.522s2.963 0 3.643-.522q.264-.202.466-.466c.522-.68.522-1.668.522-3.644V6.632c0-1.976 0-2.963-.522-3.644a2.5 2.5 0 0 0-.466-.466C15.071 2 14.083 2 12.108 2s-2.963 0-3.643.522a2.5 2.5 0 0 0-.467.466c-.346.452-.463 1.039-.502 1.96"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M9.582 12.946s2.947-2.171 2.947-2.948-2.947-2.947-2.947-2.947"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LogOut.displayName = 'LogOut';
