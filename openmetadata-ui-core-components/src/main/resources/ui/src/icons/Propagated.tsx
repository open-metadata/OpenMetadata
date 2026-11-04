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

export const Propagated: FC<Props> = ({
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
      d="M2.8 15.6c0 1.131 0 1.697.352 2.048.352.352.917.352 2.049.352s1.697 0 2.048-.352c.352-.35.352-.917.352-2.048s0-1.697-.352-2.048c-.351-.352-.917-.352-2.048-.352s-1.697 0-2.049.352c-.351.351-.351.917-.351 2.048M2.8 4.4c0 1.132 0 1.698.352 2.05.352.35.917.35 2.049.35s1.697 0 2.048-.35c.352-.352.352-.918.352-2.05 0-1.13 0-1.696-.352-2.048-.351-.351-.917-.351-2.048-.351s-1.697 0-2.049.351c-.351.352-.351.917-.351 2.049m9.599 9.597c0 1.132 0 1.697.352 2.049.351.351.917.351 2.048.351s1.697 0 2.049-.351c.351-.352.351-.917.351-2.049 0-1.13 0-1.697-.351-2.048-.352-.351-.917-.351-2.049-.351s-1.697 0-2.048.35c-.352.352-.352.918-.352 2.05M5.201 6.8v6.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.801 11.598a2.4 2.4 0 0 0-2.4-2.4h-4.8a2.4 2.4 0 0 1-2.4-2.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Propagated.displayName = 'Propagated';
