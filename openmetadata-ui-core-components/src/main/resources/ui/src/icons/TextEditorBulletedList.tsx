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

export const TextEditorBulletedList: FC<Props> = ({
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
      d="M7.637 4.246H17.5M7.637 10H17.5m-9.863 5.75H17.5M2.808 4.245h-.103m.206 0a.205.205 0 1 1-.411 0 .205.205 0 0 1 .411 0m-.103 5.753h-.103m.206 0a.205.205 0 1 1-.41 0 .205.205 0 0 1 .41 0m-.103 5.754h-.103m.206 0a.205.205 0 1 1-.41 0 .205.205 0 0 1 .41 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
TextEditorBulletedList.displayName = 'TextEditorBulletedList';
