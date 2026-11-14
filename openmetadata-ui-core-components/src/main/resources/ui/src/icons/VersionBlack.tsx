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

export const VersionBlack: FC<Props> = ({
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
      d="M2.8 15.6c0 1.13 0 1.696.352 2.048.352.351.917.351 2.049.351s1.697 0 2.048-.351c.352-.352.352-.917.352-2.049s0-1.697-.352-2.048c-.351-.352-.917-.352-2.048-.352s-1.697 0-2.049.352c-.351.351-.351.917-.351 2.048Zm0-11.2c0 1.131 0 1.697.352 2.049s.917.351 2.049.351 1.697 0 2.048-.351c.352-.352.352-.918.352-2.049s0-1.697-.352-2.049C6.898 2 6.332 2 5.201 2s-1.697 0-2.049.351c-.351.352-.351.918-.351 2.049Zm9.6 0c0 1.131 0 1.697.352 2.049.351.351.917.351 2.048.351s1.697 0 2.049-.351c.351-.352.351-.918.351-2.049s0-1.697-.351-2.049C16.497 2 15.932 2 14.8 2s-1.697 0-2.048.351c-.352.352-.352.918-.352 2.049ZM5.201 6.8v6.4m0-3.2h6.4c1.509 0 2.263 0 2.732-.468.468-.468.468-1.223.468-2.731"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
VersionBlack.displayName = 'VersionBlack';
