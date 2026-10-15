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

export const PlayCircle: FC<Props> = ({
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
      d="M10 18.333c4.603 0 8.333-3.731 8.333-8.333S14.603 1.667 10 1.667 1.667 5.398 1.667 10 5.398 18.333 10 18.333"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.917 7.471c0-.397 0-.597.083-.707a.42.42 0 0 1 .303-.166c.138-.01.306.098.641.313l3.933 2.529c.291.187.436.28.486.398a.42.42 0 0 1 0 .325c-.05.118-.195.212-.486.398L8.944 13.09c-.335.215-.503.323-.641.313A.42.42 0 0 1 8 13.236c-.083-.11-.083-.309-.083-.707z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PlayCircle.displayName = 'PlayCircle';
