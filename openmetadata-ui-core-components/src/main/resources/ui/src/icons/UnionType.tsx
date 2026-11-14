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

export const UnionType: FC<Props> = ({
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
      d="M10.985 2H3.02a1 1 0 0 0-1 1v7.966a1 1 0 0 0 1 1h3.994a1 1 0 0 1 1 1V17a1 1 0 0 0 1 1h7.966a1 1 0 0 0 1-1V9.034a1 1 0 0 0-1-1h-3.995a1 1 0 0 1-1-1V3a1 1 0 0 0-1-1"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
UnionType.displayName = 'UnionType';
