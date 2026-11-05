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
      d="M10.167 9.261c.721 0 1.391-.289 2.731-.866l.967-.417c2.383-1.027 3.575-1.54 3.575-2.353s-1.192-1.327-3.575-2.354l-.967-.417c-1.34-.577-2.01-.866-2.73-.866s-1.392.289-2.732.866l-.967.417c-2.383 1.027-3.574 1.54-3.574 2.354 0 .813 1.191 1.326 3.574 2.353l.967.417c1.34.577 2.01.866 2.731.866m0 0v8.727"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.44 5.625v8.727c0 .813-1.192 1.327-3.575 2.354l-.967.416c-1.34.578-2.01.867-2.73.867s-1.392-.29-2.732-.867l-.967-.416c-2.383-1.027-3.574-1.54-3.574-2.354V5.625"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DashboardDataModel.displayName = 'DashboardDataModel';
