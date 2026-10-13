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

export const ThumbsUp: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M7 22V11m-5 2v7a2 2 0 0 0 2 2h13.426a3 3 0 0 0 2.965-2.544l1.077-7A3 3 0 0 0 18.503 9H15a1 1 0 0 1-1-1V4.466A2.466 2.466 0 0 0 11.534 2a.82.82 0 0 0-.75.488l-3.52 7.918A1 1 0 0 1 6.35 11H4a2 2 0 0 0-2 2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ThumbsUp.displayName = 'ThumbsUp';
