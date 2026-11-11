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

export const VideoRecorder: FC<Props> = ({
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
      d="M9.2 6.8h1.6M2 9.202c0-2.64 0-3.96.82-4.78s2.14-.82 4.78-.82h.8c2.64 0 3.96 0 4.78.82s.82 2.14.82 4.78v1.6c0 2.64 0 3.96-.82 4.78s-2.14.82-4.78.82h-.8c-2.64 0-3.96 0-4.78-.82S2 13.442 2 10.802zm12-1.676.1-.083c1.693-1.396 2.54-2.095 3.22-1.758S18 7.14 18 9.376v1.251c0 2.236 0 3.353-.68 3.69-.68.338-1.527-.36-3.22-1.757l-.1-.083"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
VideoRecorder.displayName = 'VideoRecorder';
