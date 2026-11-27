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

export const AutoTiering: FC<Props> = ({
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
    viewBox="0 0 21 20"
    width={size}
    {...props}>
    <circle
      cx={3.892}
      cy={16.278}
      r={1.392}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={10.501}
      cy={16.278}
      r={1.392}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={17.108}
      cy={16.278}
      r={1.392}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.611 14.913V11.77M3.85 14.912V13.34m.04 0h13.181m.079 1.572V13.34m-2.618-8.584-.283-.491a.87.87 0 0 0-1.184-.32.865.865 0 0 1-1.301-.723.87.87 0 0 0-.87-.894h-.569a.865.865 0 0 0-.864.869.87.87 0 0 1-.869.856.83.83 0 0 1-.416-.116.87.87 0 0 0-1.184.32l-.304.499a.87.87 0 0 0 .316 1.184.87.87 0 0 1 0 1.505.865.865 0 0 0-.316 1.18l.287.495a.87.87 0 0 0 1.185.337.86.86 0 0 1 1.18.315c.075.126.115.27.117.416 0 .48.389.869.868.869h.57a.87.87 0 0 0 .869-.865.865.865 0 0 1 .868-.868.9.9 0 0 1 .416.116.87.87 0 0 0 1.185-.316l.299-.499a.865.865 0 0 0-.316-1.184.865.865 0 0 1 0-1.5.87.87 0 0 0 .316-1.181z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.808 6.693a1.197 1.197 0 1 1-2.394 0 1.197 1.197 0 0 1 2.394 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AutoTiering.displayName = 'AutoTiering';
