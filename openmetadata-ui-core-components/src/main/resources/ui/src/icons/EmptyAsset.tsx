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

export const EmptyAsset: FC<Props> = ({
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
      d="M13.549 7.602V4.477C13.549 3.11 11.152 2 8.194 2 5.237 2 2.84 3.109 2.84 4.477v8.05c0 1.24 1.967 2.266 4.535 2.449"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.549 4.293c0 1.267-2.397 2.295-5.355 2.295-2.957 0-5.354-1.028-5.354-2.295m0 3.937c0 1.149 1.967 2.1 4.536 2.269m9.571 1.273-3.58 2.017m0 0L9.79 11.772m3.579 2.017v4.059m3.79-2.325v-3.468c0-.146 0-.22-.022-.285a.4.4 0 0 0-.09-.155c-.046-.05-.109-.086-.235-.158l-3.116-1.756a1 1 0 0 0-.242-.114.4.4 0 0 0-.17 0 1 1 0 0 0-.242.114l-3.116 1.756c-.126.072-.19.107-.235.158a.4.4 0 0 0-.09.155c-.022.066-.022.139-.022.285v3.468c0 .146 0 .22.021.285q.03.087.09.155c.046.051.11.086.236.158l3.116 1.756a.9.9 0 0 0 .242.114.4.4 0 0 0 .17 0 1 1 0 0 0 .241-.113h.001l3.116-1.757c.126-.072.19-.107.235-.158a.4.4 0 0 0 .09-.155c.022-.065.022-.139.022-.285m-.758-4.05-3.034 2.239m0 0-3.035-2.24m3.035 2.24v3.61"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EmptyAsset.displayName = 'EmptyAsset';
