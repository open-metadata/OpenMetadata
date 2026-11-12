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

export const AiStudio: FC<Props> = ({
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
      d="M18 8.977v5.369a3 3 0 0 1-3 3H8.222m-3.222 0h.556M2 11.37V6a3 3 0 0 1 3-3h5.889M14 3h-.444M7.407 9.819a3 3 0 0 1-.267.06l-.003.001h-.005l-.033.007h-.006c-.124.024-.124.202 0 .225l.006.001.033.006h.005l.003.002a4 4 0 0 1 .267.06 3.42 3.42 0 0 1 2.472 2.679l.001.003.001.005.006.033v.006c.024.124.202.124.225 0l.001-.006.006-.033.001-.005v-.003a4 4 0 0 1 .061-.267q.027-.098.058-.192a3.42 3.42 0 0 1 2.584-2.273l.037-.007.003-.001.005-.001.033-.006.006-.001c.124-.023.124-.2 0-.224l-.006-.001-.018-.003-.015-.003-.005-.001h-.003a4 4 0 0 1-.458-.119 3.42 3.42 0 0 1-2.281-2.62l-.001-.004-.001-.005-.002-.011-.004-.022v-.006c-.024-.124-.202-.124-.225 0l-.001.006-.006.033v.005l-.002.003a4 4 0 0 1-.118.459 3.42 3.42 0 0 1-2.354 2.22Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AiStudio.displayName = 'AiStudio';
