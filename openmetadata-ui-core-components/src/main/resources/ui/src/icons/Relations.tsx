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

export const Relations: FC<Props> = ({
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
      d="M8.91 10.098a2.18 2.18 0 1 1-4.36 0 2.18 2.18 0 0 1 4.36 0Zm4.633-6.191a1.907 1.907 0 1 1-3.815 0 1.907 1.907 0 0 1 3.815 0Zm1.907 6.192a1.907 1.907 0 1 1-3.815 0 1.907 1.907 0 0 1 3.814 0Zm-1.907 5.991a1.907 1.907 0 1 1-3.815 0 1.907 1.907 0 0 1 3.815 0ZM7.717 8.228l2.978-3.048m-3.131 6.535 2.725 2.725M8.91 9.96h2.725"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Relations.displayName = 'Relations';
