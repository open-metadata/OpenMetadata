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

export const Edit05: FC<Props> = ({
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
      d="M9.167 3.333h-3.5c-1.4 0-2.1 0-2.635.273A2.5 2.5 0 0 0 1.94 4.699c-.273.534-.273 1.234-.273 2.634v7c0 1.4 0 2.1.273 2.635a2.5 2.5 0 0 0 1.093 1.093c.534.272 1.234.272 2.634.272h7c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 0 0 1.093-1.092c.272-.536.272-1.236.272-2.636v-3.5m-10 2.5h1.396c.408 0 .611 0 .803-.046q.256-.063.483-.2c.168-.103.312-.247.6-.535l7.968-7.969a1.768 1.768 0 0 0-2.5-2.5l-7.969 7.969c-.288.288-.433.433-.535.6a1.7 1.7 0 0 0-.2.483c-.046.192-.046.395-.046.803z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Edit05.displayName = 'Edit05';
