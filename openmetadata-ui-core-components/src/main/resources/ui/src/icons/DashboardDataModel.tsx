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

export const DashboardDataModel: FC<Props> = ({
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
      d="M10.003 9.273c.72 0 1.391-.289 2.731-.866l.967-.417c2.383-1.027 3.575-1.54 3.575-2.354 0-.813-1.192-1.326-3.575-2.353l-.967-.417C11.394 2.29 10.724 2 10.004 2c-.722 0-1.392.289-2.732.866l-.967.417C3.922 4.31 2.73 4.823 2.73 5.636S3.922 6.963 6.305 7.99l.967.417c1.34.577 2.01.866 2.731.866m0 0V18"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.276 5.637v8.727c0 .813-1.192 1.326-3.575 2.353l-.967.417c-1.34.578-2.01.866-2.73.866-.722 0-1.392-.288-2.732-.866l-.967-.417c-2.383-1.026-3.575-1.54-3.575-2.353V5.637"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DashboardDataModel.displayName = 'DashboardDataModel';
