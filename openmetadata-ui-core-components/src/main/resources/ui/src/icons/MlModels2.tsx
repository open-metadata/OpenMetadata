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

export const MlModels2: FC<Props> = ({
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
      d="M6.8 4a2.4 2.4 0 0 0-2.4 2.4c0 .633-.338 1.394-.808 1.819a2.4 2.4 0 0 0 1.155 4.139m1.254-1.021A2.41 2.41 0 0 0 4.4 13.6c0 .621.236 1.188.623 1.614.743.817 1.767 1.871 2.696 2.47A2 2 0 0 0 10.8 16V3.999a2 2 0 0 0-4 0m0 0a2 2 0 0 0 .8 1.6m9-1.397-1.215 1.214a2 2 0 0 1-1.414.586h-.772m2.8-1.8a.6.6 0 1 0 1.2 0 .6.6 0 0 0-1.2 0M16.6 15.8l-1.215-1.214A2 2 0 0 0 13.971 14h-.772m2.8 1.8a.6.6 0 1 1 1.2 0 .6.6 0 0 1-1.2 0m.601-5.802h-3.4m2.8 0a.6.6 0 1 0 1.2 0 .6.6 0 0 0-1.2 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MlModels2.displayName = 'MlModels2';
