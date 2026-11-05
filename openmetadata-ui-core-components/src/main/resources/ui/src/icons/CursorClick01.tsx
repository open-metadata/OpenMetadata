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

export const CursorClick01: FC<Props> = ({
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
      d="M7.5 2.917v-1.25m-3.283 2.55-.884-.884m.883 7.5-.883.884m7.5-7.5.884-.884M2.917 7.5h-1.25m11.553 5.992-2.076 3.856c-.237.441-.356.661-.498.717a.42.42 0 0 1-.376-.037c-.129-.082-.202-.322-.35-.8L7.038 7.871c-.12-.39-.18-.586-.132-.717a.42.42 0 0 1 .248-.247c.132-.048.328.012.718.132l9.357 2.883c.478.148.717.221.8.35a.42.42 0 0 1 .037.375c-.056.143-.276.262-.717.499l-3.856 2.077a1 1 0 0 0-.127.075.4.4 0 0 0-.068.068 1 1 0 0 0-.075.128Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CursorClick01.displayName = 'CursorClick01';
