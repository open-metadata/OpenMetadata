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

export const BookOpen02: FC<Props> = ({
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
      d="M10 16.667H4.333c-.933 0-1.4 0-1.757-.182a1.67 1.67 0 0 1-.728-.728c-.181-.357-.181-.824-.181-1.757V6c0-.933 0-1.4.182-1.757a1.67 1.67 0 0 1 .728-.728c.356-.182.823-.182 1.756-.182h.333c1.867 0 2.8 0 3.513.363a3.33 3.33 0 0 1 1.457 1.457C10 5.867 10 6.8 10 8.667m0 8v-8m0 8h5.667c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.181-.357.181-.824.181-1.757V6c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728c-.356-.182-.823-.182-1.756-.182h-.333c-1.867 0-2.8 0-3.513.363a3.33 3.33 0 0 0-1.457 1.457C10 5.867 10 6.8 10 8.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
BookOpen02.displayName = 'BookOpen02';
