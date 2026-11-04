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

export const ArticleSettings: FC<Props> = ({
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
    viewBox="4 4 32 32"
    width={size}
    {...props}>
    <path
      d="M23 5.404V11.6c0 .84 0 1.26.163 1.581a1.5 1.5 0 0 0 .656.656c.32.163.74.163 1.581.163h6.196M26 21.5H14m12 6H14m3-12h-3M23 5h-7.8c-2.52 0-3.78 0-4.743.49A4.5 4.5 0 0 0 8.49 7.457C8 8.42 8 9.68 8 12.2v15.6c0 2.52 0 3.78.49 4.743a4.5 4.5 0 0 0 1.967 1.967c.963.49 2.223.49 4.743.49h9.6c2.52 0 3.78 0 4.743-.49a4.5 4.5 0 0 0 1.967-1.967C32 31.58 32 30.32 32 27.8V14z"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);
ArticleSettings.displayName = 'ArticleSettings';
