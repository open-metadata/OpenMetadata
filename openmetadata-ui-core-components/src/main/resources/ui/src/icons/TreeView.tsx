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

export const TreeView: FC<Props> = ({
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
      d="M6.8 5.2c0-1.509 0-2.263.47-2.731C7.737 2 8.491 2 10 2s2.262 0 2.731.469.469 1.222.469 2.73 0 2.263-.469 2.731c-.469.469-1.223.469-2.73.469-1.509 0-2.263 0-2.732-.469-.468-.468-.468-1.222-.468-2.73M2 15.599c0-1.131 0-1.697.351-2.048.352-.352.917-.352 2.049-.352 1.13 0 1.696 0 2.048.352.351.351.351.917.351 2.048 0 1.13 0 1.697-.351 2.048-.352.351-.917.351-2.048.351s-1.697 0-2.049-.351S2 16.73 2 15.599m11.2-.004c0-1.131 0-1.697.35-2.048.352-.352.918-.352 2.049-.352s1.697 0 2.048.352c.351.351.351.917.351 2.048s0 1.697-.351 2.048-.917.351-2.048.351-1.697 0-2.048-.351c-.352-.351-.352-.917-.352-2.048"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.596 13.196c-.146-1.962-.962-2.4-3.721-2.4H8.12c-2.76 0-3.575.438-3.722 2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TreeView.displayName = 'TreeView';
