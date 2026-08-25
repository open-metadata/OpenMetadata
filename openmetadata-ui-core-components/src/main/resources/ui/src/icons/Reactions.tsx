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

export const Reactions: FC<Props> = ({
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
      d="M17.085 8.857q.151.74.153 1.524a7.619 7.619 0 1 1-6.095-7.467M15.71 2v4.571m2.291-2.29H13.43"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.57 12.668a3.8 3.8 0 0 0 3.048 1.524 3.8 3.8 0 0 0 3.047-1.524m-.285-5.041v.403m-5.524-.403v.403m.286-.127c0-.315-.128-.571-.286-.571s-.286.256-.286.571c0 .316.128.572.286.572s.286-.256.286-.572m5.523 0c0-.315-.127-.571-.285-.571s-.286.256-.286.571c0 .316.128.572.286.572s.285-.256.285-.572"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Reactions.displayName = 'Reactions';
