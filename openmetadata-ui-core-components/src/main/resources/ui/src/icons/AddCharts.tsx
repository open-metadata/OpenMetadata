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

export const AddCharts: FC<Props> = ({
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
      d="M9.579 2.842H6.042c-1.415 0-2.122 0-2.663.275a2.53 2.53 0 0 0-1.104 1.104C2 4.762 2 5.47 2 6.884v7.074c0 1.415 0 2.122.275 2.663.243.475.629.861 1.104 1.104C3.92 18 4.627 18 6.042 18h7.074c1.415 0 2.122 0 2.662-.275a2.53 2.53 0 0 0 1.104-1.104c.276-.54.276-1.248.276-2.663V10.42m-4.21.842v3.369M6.21 9.579v5.053M9.579 6.21v8.42m5.895-7.578V2M18 4.526h-5.053"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AddCharts.displayName = 'AddCharts';
