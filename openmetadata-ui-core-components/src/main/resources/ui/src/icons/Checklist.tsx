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

export const Checklist: FC<Props> = ({
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
      d="M13.6 2v2.4M6.4 2v2.4M10 2v2.4m.8-1.2H9.2c-2.64 0-3.96 0-4.78.82S3.6 6.16 3.6 8.8v3.6c0 2.64 0 3.959.82 4.78.82.82 2.14.82 4.78.82h1.6c2.64 0 3.96 0 4.78-.82.82-.821.82-2.14.82-4.78V8.8c0-2.64 0-3.96-.82-4.78s-2.14-.82-4.78-.82"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m6.4 9.2.8.8 1.6-2m2.4 6h2.4m-2.4-4.8h2.4M7.3 14h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Checklist.displayName = 'Checklist';
