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

export const Youtube: FC<Props> = ({
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
    <rect
      height={11.606}
      rx={3}
      stroke="currentColor"
      strokeWidth={1.3}
      width={16}
      x={2}
      y={4.195}
    />
    <path
      d="M8.965 8.127v3.738a.273.273 0 0 0 .414.232l2.997-1.87a.27.27 0 0 0 .095-.363.3.3 0 0 0-.095-.1L9.38 7.895a.273.273 0 0 0-.414.232Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Youtube.displayName = 'Youtube';
