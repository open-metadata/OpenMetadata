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

export const Workflow: FC<Props> = ({
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
      d="M12.133 15.335H6.666a2 2 0 0 1-2-2V9.47"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2 12.135 4.667 9.47l2.666 2.666m.534-7.468h5.467a2 2 0 0 1 2 2v3.867"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m18 7.867-2.667 2.667-2.667-2.667"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <mask height={5} id="a" maskUnits="userSpaceOnUse" width={5} x={2} y={2}>
      <path
        d="M5.8 2.535H3.533a1 1 0 0 0-1 1v2.267a1 1 0 0 0 1 1H5.8a1 1 0 0 0 1-1V3.535a1 1 0 0 0-1-1"
        fill="#fff"
      />
    </mask>
    <g mask="url(#a)">
      <path
        d="M3.533 2.535H5.8a1 1 0 0 1 1 1v2.267a1 1 0 0 1-1 1H3.533a1 1 0 0 1-1-1V3.535a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={2.6}
      />
    </g>
    <mask height={5} id="b" maskUnits="userSpaceOnUse" width={5} x={13} y={13}>
      <path
        d="M16.466 13.203h-2.267a1 1 0 0 0-1 1v2.267a1 1 0 0 0 1 1h2.267a1 1 0 0 0 1-1v-2.267a1 1 0 0 0-1-1"
        fill="#fff"
      />
    </mask>
    <g mask="url(#b)">
      <path
        d="M14.2 13.203h2.266a1 1 0 0 1 1 1v2.267a1 1 0 0 1-1 1h-2.267a1 1 0 0 1-1-1v-2.267a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={2.6}
      />
    </g>
  </svg>
);
Workflow.displayName = 'Workflow';
