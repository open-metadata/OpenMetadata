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

export const ActivityConversation: FC<Props> = ({
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
      d="M2 8.8q0-.925.031-1.8c.067-1.898.1-2.848.873-3.626.772-.778 1.749-.82 3.701-.903A80 80 0 0 1 10 2.4c1.183 0 2.324.024 3.395.07 1.952.083 2.929.125 3.7.903.773.778.807 1.728.874 3.627a51 51 0 0 1 0 3.6c-.067 1.898-.1 2.847-.873 3.625-.772.779-1.749.82-3.701.904q-.882.038-1.82.056c-.592.01-.889.017-1.15.116s-.479.287-.917.663L7.764 17.46a.584.584 0 0 1-.964-.444v-1.878l-.195-.008c-1.952-.084-2.929-.125-3.7-.904-.773-.778-.807-1.727-.874-3.626A51 51 0 0 1 2 8.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.098 8.8h-.1m-3.1 0h-.1m6.5 0h-.1m-3 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m-3.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0m6.4 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityConversation.displayName = 'ActivityConversation';
