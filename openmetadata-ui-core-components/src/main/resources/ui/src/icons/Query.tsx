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

export const Query: FC<Props> = ({
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
      d="M4.583 3.332h10.834c1.15 0 2.083.933 2.083 2.083v9.167c0 1.15-.933 2.083-2.083 2.083H4.583A2.083 2.083 0 0 1 2.5 14.582V5.415c0-1.15.933-2.083 2.083-2.083"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m5.834 7.914 2.5 2.083-2.5 2.084m5 .419h3.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Query.displayName = 'Query';
