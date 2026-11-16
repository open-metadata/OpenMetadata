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

export const MetricFilled: FC<Props> = ({
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
      d="M4.862 5.673a1.431 1.431 0 1 1-2.862 0 1.431 1.431 0 0 1 2.862 0M18 3.802a1.431 1.431 0 1 1-2.863 0 1.431 1.431 0 0 1 2.862 0m-6.867 5.274a1.431 1.431 0 1 1-2.863 0 1.431 1.431 0 0 1 2.863 0"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m4.627 6.5 3.77 2.177m2.611-.143 4.505-3.776M3.158 17.626v-6.52m13.222 6.518v-9.98m-8.816 9.98v-5.206m4.406 5.208v-6.52"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MetricFilled.displayName = 'MetricFilled';
