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

export const Comment: FC<Props> = ({
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
      d="M6.402 7.2h7.2m-7.2 3.2h4.4M2 8.798q0-.925.031-1.8c.067-1.898.1-2.847.873-3.626.772-.778 1.749-.82 3.701-.903A80 80 0 0 1 10 2.399c1.183 0 2.324.024 3.395.07 1.952.084 2.929.125 3.7.903.773.779.807 1.728.874 3.627a51 51 0 0 1 0 3.6c-.067 1.898-.1 2.847-.873 3.626-.772.778-1.749.82-3.701.903a77 77 0 0 1-1.82.056c-.592.01-.889.017-1.15.116s-.479.287-.917.663l-1.744 1.495a.584.584 0 0 1-.964-.443V15.33a.204.204 0 0 0-.195-.203c-1.952-.084-2.929-.125-3.7-.904-.773-.778-.807-1.727-.874-3.626A51 51 0 0 1 2 8.798"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Comment.displayName = 'Comment';
