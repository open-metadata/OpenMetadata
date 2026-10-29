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

export const Edit03: FC<Props> = ({
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
      d="M10 16.667h7.5m-15 0h1.396c.408 0 .611 0 .803-.046q.257-.063.482-.2c.168-.103.312-.247.6-.535L16.25 5.417a1.768 1.768 0 0 0-2.5-2.5L3.281 13.386c-.288.288-.433.433-.535.6a1.7 1.7 0 0 0-.2.482c-.046.192-.046.396-.046.804z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Edit03.displayName = 'Edit03';
