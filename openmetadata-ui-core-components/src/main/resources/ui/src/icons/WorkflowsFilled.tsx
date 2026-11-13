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

export const WorkflowsFilled: FC<Props> = ({
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
      d="M11.633 15.8H6.166a2 2 0 0 1-2-2V9.934"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m1.5 12.6 2.667-2.666L6.833 12.6m.534-7.467h5.467a2 2 0 0 1 2 2v3.866"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m17.5 8.332-2.667 2.667-2.667-2.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <mask height={5} id="a" maskUnits="userSpaceOnUse" width={5} x={2} y={3}>
      <path
        d="M5.3 3H3.033a1 1 0 0 0-1 1v2.267a1 1 0 0 0 1 1H5.3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1"
        fill="#fff"
        stroke="none"
      />
    </mask>
    <g mask="url(#a)">
      <path
        d="M5.3 3H3.033a1 1 0 0 0-1 1v2.267a1 1 0 0 0 1 1H5.3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={2.6}
      />
    </g>
    <mask height={5} id="b" maskUnits="userSpaceOnUse" width={5} x={12} y={13}>
      <path
        d="M15.966 13.668h-2.267a1 1 0 0 0-1 1v2.267a1 1 0 0 0 1 1h2.267a1 1 0 0 0 1-1v-2.267a1 1 0 0 0-1-1"
        fill="#fff"
        stroke="none"
      />
    </mask>
    <g mask="url(#b)">
      <path
        d="M15.966 13.668h-2.267a1 1 0 0 0-1 1v2.267a1 1 0 0 0 1 1h2.267a1 1 0 0 0 1-1v-2.267a1 1 0 0 0-1-1Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={2.6}
      />
    </g>
  </svg>
);
WorkflowsFilled.displayName = 'WorkflowsFilled';
