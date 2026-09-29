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

export const StoredProcedure: FC<Props> = ({
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
      d="M7.474 4.105H6.21a2.105 2.105 0 0 0-2.106 2.106v1.684A2.105 2.105 0 0 1 2 10a2.105 2.105 0 0 1 2.105 2.105v1.685a2.105 2.105 0 0 0 2.106 2.105h1.263m5.053-11.79h1.264a2.105 2.105 0 0 1 2.105 2.106v1.684A2.105 2.105 0 0 0 18 10a2.105 2.105 0 0 0-2.105 2.105v1.685a2.105 2.105 0 0 1-2.106 2.105h-1.263"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StoredProcedure.displayName = 'StoredProcedure';
