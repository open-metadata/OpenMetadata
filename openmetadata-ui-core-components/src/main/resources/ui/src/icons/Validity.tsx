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

export const Validity: FC<Props> = ({
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
      d="m14.485 7.267.97-.647c.512-.342 1.135-.507 1.644-.854a2.061 2.061 0 1 0-2.862-2.863c-.347.51-.512 1.132-.854 1.645l-.646.97m1.748 1.749-1.748-1.749m1.748 1.749L15.843 9.4a1.58 1.58 0 0 1-.216 1.97.79.79 0 0 1-1.119 0L8.634 5.494a.79.79 0 0 1 0-1.12 1.58 1.58 0 0 1 1.968-.216l2.135 1.359m.463 8.399a5.718 5.718 0 1 1-7.115-7.115"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6 12.934s.5 0 1 1.067c0 0 1.588-2.667 3-3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Validity.displayName = 'Validity';
