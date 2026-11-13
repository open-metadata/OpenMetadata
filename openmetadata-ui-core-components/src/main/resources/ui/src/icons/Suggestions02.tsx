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

export const Suggestions02: FC<Props> = ({
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
      clipRule="evenodd"
      d="M2.468 5.89a4 4 0 0 0-.703-.19c-.15-.028-.15-.243 0-.27l.05-.01a4.1 4.1 0 0 0 3.077-2.604 4 4 0 0 0 .19-.703c.027-.15.243-.15.27 0l.009.05a4.1 4.1 0 0 0 2.237 2.92 4 4 0 0 0 1.07.347c.151.027.151.242 0 .27l-.049.008A4.1 4.1 0 0 0 5.7 7.946a4 4 0 0 0-.347 1.07c-.027.15-.243.15-.27 0l-.009-.05A4.1 4.1 0 0 0 2.468 5.89m5.021 5.34a7 7 0 0 0-.517-.118l-.007-.001-.01-.002-.064-.011-.012-.002c-.24-.046-.24-.39 0-.435l.012-.002.064-.012.01-.002.007-.001.07-.014a7 7 0 0 0 .819-.216 6.64 6.64 0 0 0 4.428-5.087l.001-.007.002-.01.011-.063.002-.013c.046-.24.39-.24.435 0l.002.012.012.064.002.01.001.007.014.07a7 7 0 0 0 .216.82 6.64 6.64 0 0 0 5.087 4.427l.007.001.01.002.064.011.011.003c.24.045.24.39 0 .435l-.01.002-.036.006-.03.005-.009.002-.007.001-.07.014a7 7 0 0 0-.82.216 6.64 6.64 0 0 0-4.427 5.087l-.001.007-.002.01-.004.022-.007.04-.003.014c-.045.24-.39.24-.435 0l-.002-.012-.011-.064-.002-.01-.001-.007-.014-.07a7 7 0 0 0-.216-.819 6.64 6.64 0 0 0-4.57-4.31m-3.314 4.61a2.59 2.59 0 0 1 2.064 2.089c.017.095.153.095.17 0l.006-.031a2.59 2.59 0 0 1 2.09-2.064c.094-.017.094-.153 0-.17l-.032-.006a2.59 2.59 0 0 1-2.064-2.09c-.017-.094-.153-.094-.17 0a2.6 2.6 0 0 1-.254.744 2.6 2.6 0 0 1-1.841 1.352c-.095.017-.095.153 0 .17z"
      fill="currentColor"
      fillRule="evenodd"
      stroke="none"
    />
  </svg>
);
Suggestions02.displayName = 'Suggestions02';
