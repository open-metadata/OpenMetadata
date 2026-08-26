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

export const DatabaseSchema: FC<Props> = ({
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
    viewBox="0 0 18 18"
    width={size}
    {...props}>
    <path
      d="M10.425.648H6.869a.89.89 0 0 0-.889.89v2.666c0 .49.398.889.89.889h3.555a.89.89 0 0 0 .889-.889V1.537a.89.89 0 0 0-.89-.889M5.093 12.203H1.537a.89.89 0 0 0-.889.889v2.667c0 .49.398.889.89.889h3.555a.89.89 0 0 0 .889-.89v-2.666a.89.89 0 0 0-.89-.889m10.668 0h-3.555a.89.89 0 0 0-.889.889v2.667c0 .49.398.889.89.889h3.555a.89.89 0 0 0 .889-.89v-2.666a.89.89 0 0 0-.89-.889"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.65 5.094v4m-5.334 3.11v-3.11h10.667v3.11"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DatabaseSchema.displayName = 'DatabaseSchema';
