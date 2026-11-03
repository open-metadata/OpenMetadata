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

export const BookOpen01: FC<Props> = ({
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
      d="m10 17.5-.083-.125c-.579-.868-.868-1.302-1.25-1.617a3.3 3.3 0 0 0-1.148-.614C7.044 15 6.523 15 5.479 15H4.333c-.933 0-1.4 0-1.757-.182a1.67 1.67 0 0 1-.728-.728c-.181-.357-.181-.823-.181-1.757V5.167c0-.933 0-1.4.182-1.757a1.67 1.67 0 0 1 .728-.728C2.933 2.5 3.4 2.5 4.333 2.5h.333c1.867 0 2.8 0 3.513.363A3.33 3.33 0 0 1 9.636 4.32C10 5.033 10 5.967 10 7.833m0 9.667V7.833m0 9.667.083-.125c.579-.868.868-1.302 1.25-1.617a3.3 3.3 0 0 1 1.148-.614c.475-.144.997-.144 2.04-.144h1.146c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.181-.357.181-.823.181-1.757V5.167c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728C17.067 2.5 16.6 2.5 15.667 2.5h-.333c-1.867 0-2.8 0-3.513.363a3.33 3.33 0 0 0-1.457 1.457C10 5.033 10 5.967 10 7.833"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
BookOpen01.displayName = 'BookOpen01';
