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

export const Article: FC<Props> = ({
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
      d="M6.371 18h7.259a3 3 0 0 0 3-3V7a5 5 0 0 0-5-5H6.37a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.71 2v2.69a2 2 0 0 0 2 2h2.691M6.5 12.617h7.022M6.531 9.879h4.917M6.531 7.21h1.79"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Article.displayName = 'Article';
