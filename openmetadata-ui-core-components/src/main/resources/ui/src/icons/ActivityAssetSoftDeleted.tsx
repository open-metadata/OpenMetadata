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

export const ActivityAssetSoftDeleted: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <g stroke="currentColor">
      <path d="m9.233 2.604-.184 2.98m-6.686-2.98.277 4.59c.071 1.176.107 1.764.4 2.187.146.209.333.385.55.518.308.188.688.244 1.292.26M1.676 2.603h8.243m-2.264 0-.313-.645c-.208-.428-.311-.643-.49-.776a1 1 0 0 0-.126-.08C6.527 1 6.289 1 5.813 1c-.488 0-.732 0-.933.107a1 1 0 0 0-.128.082c-.181.14-.282.361-.485.805l-.277.609" />
      <circle cx={8.238} cy={8.915} r={2.085} />
      <path d="M7.469 8.914h1.538" />
    </g>
  </svg>
);
ActivityAssetSoftDeleted.displayName = 'ActivityAssetSoftDeleted';
