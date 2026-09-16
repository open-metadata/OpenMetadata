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

export const Size: FC<Props> = ({
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
      d="M11.596 18.002a1.6 1.6 0 0 1-1.6-1.6m4.8 1.6a1.6 1.6 0 0 0 1.6-1.6m-4.8-4.8a1.6 1.6 0 0 0-1.6 1.6m4.8-1.6a1.6 1.6 0 0 1 1.6 1.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.798 2.4v.4c0 2.263 0 3.394.703 4.097s1.834.703 4.097.703h.4m.4 1.2c0-.572-.008-.875-.122-1.15-.122-.294-.353-.525-.816-.987l-3.789-3.79c-.399-.399-.598-.598-.846-.716a2 2 0 0 0-.158-.066C10.41 2 10.127 2 9.562 2c-2.596 0-3.894 0-4.773.709a3.2 3.2 0 0 0-.482.482c-.71.88-.71 2.178-.71 4.774v3.716c0 3.017 0 4.526.938 5.463.522.523 1.223.754 2.263.856"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Size.displayName = 'Size';
