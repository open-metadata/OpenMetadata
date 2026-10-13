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

export const Pencil01: FC<Props> = ({
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
      d="m2 18 4.594-1.767c.293-.113.44-.17.578-.243q.183-.099.348-.226c.123-.096.234-.207.457-.43l9.337-9.337a2.341 2.341 0 1 0-3.31-3.311l-9.338 9.337a5 5 0 0 0-.43.457q-.127.165-.226.348c-.074.138-.13.285-.243.578zm0 0 1.704-4.43c.122-.317.183-.475.287-.548a.4.4 0 0 1 .314-.066c.125.024.245.144.485.384l1.87 1.87c.24.24.36.36.384.485a.4.4 0 0 1-.066.314c-.073.104-.231.165-.548.287z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Pencil01.displayName = 'Pencil01';
