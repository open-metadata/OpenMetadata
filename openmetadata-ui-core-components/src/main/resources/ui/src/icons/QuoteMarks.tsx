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

export const QuoteMarks: FC<Props> = ({
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
      d="M11.6 13.198c0-1.508 0-2.262.469-2.73.468-.47 1.222-.47 2.731-.47s2.263 0 2.731.47c.469.468.469 1.222.469 2.73s0 2.263-.469 2.732c-.468.468-1.223.468-2.731.468-1.509 0-2.263 0-2.731-.468-.469-.469-.469-1.223-.469-2.732"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.6 14v-3.586c0-3.178 2.013-5.873 4.8-6.814"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2 13.198c0-1.508 0-2.262.469-2.73.469-.47 1.223-.47 2.731-.47 1.509 0 2.263 0 2.732.47.468.468.468 1.222.468 2.73s0 2.263-.468 2.732c-.469.468-1.223.468-2.732.468-1.508 0-2.262 0-2.731-.468S2 14.707 2 13.198"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2 14v-3.586C2 7.236 4.014 4.541 6.8 3.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
QuoteMarks.displayName = 'QuoteMarks';
