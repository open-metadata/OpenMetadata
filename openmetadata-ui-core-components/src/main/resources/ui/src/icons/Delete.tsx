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

export const Delete: FC<Props> = ({
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
      d="m16 4.8-.496 8.02c-.126 2.05-.19 3.075-.703 3.811a3.2 3.2 0 0 1-.96.903c-.767.467-1.794.467-3.847.467-2.055 0-3.083 0-3.85-.468a3.2 3.2 0 0 1-.961-.904c-.513-.738-.575-1.764-.7-3.816L4 4.801M2.8 4.8h14.4m-3.955 0L12.7 3.673c-.363-.748-.544-1.122-.857-1.356a1.6 1.6 0 0 0-.22-.137C11.276 2 10.86 2 10.028 2c-.852 0-1.278 0-1.63.187a1.6 1.6 0 0 0-.223.144c-.317.242-.494.63-.847 1.406L6.843 4.8m1.161 8.8V8.8M12 13.6V8.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Delete.displayName = 'Delete';
