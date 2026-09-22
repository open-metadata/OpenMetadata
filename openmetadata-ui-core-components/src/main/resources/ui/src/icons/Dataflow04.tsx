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

export const Dataflow04: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M4 18v-.2c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C6.28 13 7.12 13 8.8 13h6.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C20 15.28 20 16.12 20 17.8v.2M4 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m16 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m0 0V8M6 8h12c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 6.398 21 5.932 21 5s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C19.398 2 18.932 2 18 2H6c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C3 3.602 3 4.068 3 5s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 8 5.068 8 6 8"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);
Dataflow04.displayName = 'Dataflow04';
