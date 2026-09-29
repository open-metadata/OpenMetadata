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

export const AssetsOwned: FC<Props> = ({
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
      d="M8.935 6.574c3.368 0 6.098-1.024 6.098-2.287S12.303 2 8.935 2c-3.369 0-6.1 1.024-6.1 2.287s2.731 2.287 6.1 2.287m-3.81 2.168c.459.138.971.252 1.525.336m2.285 2.834c-3.369 0-6.1-1.024-6.1-2.287m2.29 4.453c.459.138.971.252 1.525.336"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.033 4.285v5.337m-6.098 7.623c-3.369 0-6.1-1.024-6.1-2.287V4.285m11.245 8.077v-1.538m0 5.637V18m3.074-5.383-1.299.758m-3.54 2.068a2.049 2.049 0 0 0 3.821-1.03 2.049 2.049 0 0 0-3.816-1.041m-1.308 2.832 1.302-.76m0 0a2.04 2.04 0 0 1-.277-1.032c0-.38.103-.736.283-1.041m4.841 2.827-1.3-.76M11.02 12.61l1.301.76"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AssetsOwned.displayName = 'AssetsOwned';
