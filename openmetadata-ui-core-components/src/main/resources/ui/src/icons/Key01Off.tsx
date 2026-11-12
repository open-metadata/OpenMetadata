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

export const Key01Off: FC<Props> = ({
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
      d="M14.909 7.623a4.076 4.076 0 0 0-8.153 0m-.877 2.915L2 14.418v2.038h2.038v-1.36h1.359v-1.358h1.359l2.398-2.399a4.1 4.1 0 0 0 1.678.36 4.06 4.06 0 0 0 2.85-1.161m-1.491-4.272-.68.679M2 8.11h16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Key01Off.displayName = 'Key01Off';
