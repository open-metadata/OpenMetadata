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

export const ManageCharts: FC<Props> = ({
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
    <circle
      cx={4.422}
      cy={12.129}
      r={1.086}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={8.153}
      cy={6.301}
      r={1.086}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={11.975}
      cy={10.125}
      r={1.086}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={15.737}
      cy={4.422}
      r={1.086}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m5.113 11.021 2.25-3.391m4.04 1.572-2.22-2.22m3.422 2.22 2.257-3.909M2 16.66h16m-2.219.003V9.14m-3.806 7.52v-2.805m-3.823 2.806v-5.919m-3.73 5.918v-1.402"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ManageCharts.displayName = 'ManageCharts';
