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

export const ArticleFilled: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M3 5a3 3 0 0 1 3-3h5.259a5 5 0 0 1 5 5v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:stroke-bg-primary"
      d="M6.127 12.617h7.022M6.16 9.879h4.917M6.16 7.21h1.79M11.338 2v2.69a2 2 0 0 0 2 2h2.69"
      stroke="#fff"
      strokeWidth={1.3}
    />
  </svg>
);
ArticleFilled.displayName = 'ArticleFilled';
