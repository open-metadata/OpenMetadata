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

export const DataAssetRules: FC<Props> = ({
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
      d="M17.201 12v4.8c0 .663-1.433 1.2-3.2 1.2s-3.2-.537-3.2-1.2V12"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 2.4v.4c0 2.263 0 3.394.702 4.097.703.703 1.835.703 4.097.703h.4m.4 1.2c0-.571-.008-.875-.121-1.15-.122-.293-.353-.525-.816-.987l-3.79-3.79c-.399-.399-.598-.598-.845-.716a2 2 0 0 0-.158-.066C9.61 2 9.329 2 8.764 2 6.168 2 4.87 2 3.99 2.709a3.2 3.2 0 0 0-.482.483c-.71.879-.71 2.177-.71 4.773V11.6c0 3.018 0 4.526.938 5.463.85.85 2.172.93 4.663.937"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.999 13.2c1.767 0 3.2-.536 3.2-1.2 0-.662-1.433-1.2-3.2-1.2s-3.2.538-3.2 1.2c0 .664 1.433 1.2 3.2 1.2m3.202 1.198c0 .663-1.433 1.2-3.2 1.2s-3.2-.537-3.2-1.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataAssetRules.displayName = 'DataAssetRules';
