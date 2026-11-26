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

export const PermissionDebugger: FC<Props> = ({
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
      d="m12.947 15.051 3.79-3.79m-.843 1.264.842.842m-3.368 2.947a1.684 1.684 0 1 1-3.368 0 1.684 1.684 0 0 1 3.368 0M11.684 4.947a2.947 2.947 0 1 1-5.895 0 2.947 2.947 0 0 1 5.895 0m-8.42 10.527v-1.709c0-1.046.47-2.072 1.422-2.506 1.162-.529 2.554-.837 4.051-.837 1.214 0 2.36.203 3.368.561"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PermissionDebugger.displayName = 'PermissionDebugger';
