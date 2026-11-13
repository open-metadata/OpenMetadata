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

export const MlModelService: FC<Props> = ({
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
      d="M10 2c2.22 0 4.02 1.8 4.02 4.02 0 .37.305.662.664.754a2.682 2.682 0 0 1-.663 5.278H6.649A3.35 3.35 0 0 1 5.566 5.53a.87.87 0 0 0 .558-.585A4.02 4.02 0 0 1 10 2m0 10.05v2.681m0 0H4.976m5.026 0h5.025"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.48 17.999a1.005 1.005 0 1 0 0-2.01 1.005 1.005 0 0 0 0 2.01m4.52 0a1.005 1.005 0 1 0 0-2.01 1.005 1.005 0 0 0 0 2.01m4.52 0a1.005 1.005 0 1 0 0-2.01 1.005 1.005 0 0 0 0 2.01"
      fill="currentColor"
    />
  </svg>
);
MlModelService.displayName = 'MlModelService';
