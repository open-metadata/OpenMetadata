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

export const DataProduct: FC<Props> = ({
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
      d="M10 9.273c.72 0 1.39-.289 2.73-.866l.967-.417c2.384-1.027 3.575-1.54 3.575-2.354 0-.813-1.191-1.326-3.575-2.353l-.967-.417C11.39 2.29 10.72 2 10 2s-1.392.289-2.732.866l-.967.417C3.918 4.31 2.727 4.823 2.727 5.636S3.918 6.963 6.3 7.99l.967.417c1.34.577 2.01.866 2.731.866m0 0V18M6.234 3.336l8.29 4.27"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.272 5.637v8.727c0 .813-1.191 1.326-3.575 2.353l-.967.417c-1.34.578-2.01.866-2.73.866s-1.392-.288-2.732-.866l-.967-.417c-2.383-1.026-3.574-1.54-3.574-2.353V5.637"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataProduct.displayName = 'DataProduct';
